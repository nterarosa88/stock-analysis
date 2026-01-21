import sys
import os
from typing import Optional

# Add parent directory to path to import kiwoom.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from kiwoom import KiwoomREST
from backend.database import get_db
from datetime import datetime
import cx_Oracle
import time

# Configuration
API_KEY = "zSGJpwoiewyrt0S2axli2D6hFuLne84twWNl925BDiQ"
SECRET_KEY = "keLe2y_lHLfcSqP-ArylTkzE2hd1S3aScp8Tnn0Dx1w"
ACCOUNT_NO = "39645031"

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:5173",  # React (Vite) default port
    "http://localhost:3000",  # React (CRA) default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Kiwoom Client
kiwoom = KiwoomREST(API_KEY, SECRET_KEY, ACCOUNT_NO)

@app.on_event("startup")
async def startup_event():
    print("Logging in to Kiwoom...")
    kiwoom.login() # Uncomment if login is required on startup

@app.get("/")
def read_root():
    return {"message": "Welcome to Rich Brother API"}

@app.get("/api/stock/list")
def get_stock_list(market: str, stock_name: Optional[str] = None):
    data = kiwoom.get_stock_list(market)
    
    if stock_name and data:
        import re
        if '%' in stock_name:
            # SQL LIKE behavior
            parts = stock_name.split('%')
            escaped_parts = [re.escape(p) for p in parts]
            pattern_str = ".*".join(escaped_parts)
            pattern = f"^{pattern_str}$"
            regex = re.compile(pattern, re.IGNORECASE)
            data = [item for item in data if regex.match(item['name'])]
        else:
            # Substring match
            stock_name_lower = stock_name.lower()
            data = [item for item in data if stock_name_lower in item['name'].lower()]
            
    return {"result": data}

@app.get("/api/stock/price/{code}")
def get_stock_price(code: str, next_key: Optional[str] = None):
    data = kiwoom.get_daily_price(code, next_key=next_key)
    return data if data else {"list": [], "next_key": None}

@app.get("/api/stock/info/{code}")
def get_stock_info(code: str):
    data = kiwoom.get_stock_info(code)
    return {"result": data}

@app.get("/api/stock/search")
def search_stocks(
    code: Optional[str] = None,
    name: Optional[str] = None,
    market_cap_min: Optional[int] = None,
    market_cap_max: Optional[int] = None,
    market_type: Optional[str] = None,
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Base query
        # Calculate Market Cap: TSHOSD (Shares) * PRVDY_LAST_PRC (Price)
        # Use NVL to handle potential NULLs
        query = """
            SELECT 
                CLS_CD, 
                CLS_NM, 
                (NVL(TSHOSD, 0) * NVL(PRVDY_LAST_PRC, 0)) as MKT_CAP, 
                PRVDY_LAST_PRC, 
                MRKT_NM, 
                TPBIZ_NM, 
                UPDT_YMD
            FROM TTST01M
            WHERE 1=1
        """
        params = {}

        if code:
            query += " AND CLS_CD LIKE :code"
            params["code"] = f"%{code}%"
        
        if name:
            query += " AND CLS_NM LIKE :name"
            params["name"] = f"%{name}%"
            
        if market_type:
            if market_type == '0': # KOSPI
                query += " AND MRKT_SE_CD = '0'" 
            elif market_type == '10': # KOSDAQ
                query += " AND MRKT_SE_CD = '10'"
            elif market_type == '8': # ETF
                query += " AND MRKT_SE_CD = '8'"
        
        # Market Cap Filter (Input is in 100 Billions = 100,000,000,000)
        if market_cap_min is not None:
            min_val = market_cap_min * 100000000000
            query += " AND (NVL(TSHOSD, 0) * NVL(PRVDY_LAST_PRC, 0)) >= :min_val"
            params["min_val"] = min_val
            
        if market_cap_max is not None:
            max_val = market_cap_max * 100000000000
            query += " AND (NVL(TSHOSD, 0) * NVL(PRVDY_LAST_PRC, 0)) <= :max_val"
            params["max_val"] = max_val

        query += " ORDER BY MKT_CAP DESC" # Default sort by Market Cap

        print(f"Executing Search Query: {query}")
        print(f"Params: {params}")

        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "code": row[0],
                "name": row[1],
                "market_cap": row[2],
                "last_price": row[3],
                "market": row[4],
                "sector": row[5],
                "update_date": row[6]
            })
            
        return {"result": results}

    except Exception as e:
        print(f"Error searching stocks: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

class StockSyncRequest(BaseModel):
    market: str

@app.post("/api/stock/sync")
def sync_stock_list(request: StockSyncRequest, db: cx_Oracle.Connection = Depends(get_db)):
    market = request.market
    print(f"Syncing stock list for market: {market}")
    
    # 1. Fetch data from Kiwoom
    data = kiwoom.get_stock_list_full(market)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch data from Kiwoom API")
    
    print(f"Fetched {len(data)} items from Kiwoom.")
    
    # 2. Prepare data for DB
    current_date = datetime.now().strftime("%Y%m%d")
    db_data = []
    
    print(f"Checking data for potential column overflow (CLS_STTS max 20)...")
    for item in data:
        cls_stts = item.get("state", "")
        # Check for potential overflow (assuming 20 bytes/chars limit)
        # Printing items with long state strings
        if len(cls_stts.encode('utf-8')) > 20: 
             print(f"[WARNING] CLS_STTS too long: '{cls_stts}' (Length: {len(cls_stts)}, Bytes: {len(cls_stts.encode('utf-8'))}) - Code: {item.get('code')}, Name: {item.get('name')}")

        db_data.append({
            "CLS_CD": item.get("code", ""),
            "CLS_NM": item.get("name", ""),
            "TSHOSD": item.get("listCount", ""),
            "SPVS_SE": item.get("auditInfo", ""),
            "LSTG_YMD": item.get("regDay", ""),
            "PRVDY_LAST_PRC": item.get("lastPrice", ""),
            "CLS_STTS": cls_stts,
            "MRKT_SE_CD": item.get("marketCode", ""),
            "MRKT_NM": item.get("marketName", ""),
            "TPBIZ_NM": item.get("upName", ""),
            "CO_SZ_CLSF": item.get("upSizeName", ""),
            "CO_CLSF": item.get("companyClassName", ""),
            "IVST_CTN_CLS_CD": item.get("orderWarning", ""),
            "NTX_PSBLTY_YN": item.get("nxtEnable", ""),
            "UPDT_YMD": current_date
        })
        
    # 3. Merge into DB
    merge_sql = """
    MERGE INTO TTST01M T
    USING DUAL ON (T.CLS_CD = :CLS_CD)
    WHEN MATCHED THEN
        UPDATE SET
            CLS_NM = :CLS_NM,
            TSHOSD = :TSHOSD,
            SPVS_SE = :SPVS_SE,
            LSTG_YMD = :LSTG_YMD,
            PRVDY_LAST_PRC = :PRVDY_LAST_PRC,
            CLS_STTS = :CLS_STTS,
            MRKT_SE_CD = :MRKT_SE_CD,
            MRKT_NM = :MRKT_NM,
            TPBIZ_NM = :TPBIZ_NM,
            CO_SZ_CLSF = :CO_SZ_CLSF,
            CO_CLSF = :CO_CLSF,
            IVST_CTN_CLS_CD = :IVST_CTN_CLS_CD,
            NTX_PSBLTY_YN = :NTX_PSBLTY_YN,
            UPDT_YMD = :UPDT_YMD
    WHEN NOT MATCHED THEN
        INSERT (
            CLS_CD, CLS_NM, TSHOSD, SPVS_SE, LSTG_YMD, PRVDY_LAST_PRC,
            CLS_STTS, MRKT_SE_CD, MRKT_NM, TPBIZ_NM, CO_SZ_CLSF, CO_CLSF,
            IVST_CTN_CLS_CD, NTX_PSBLTY_YN, UPDT_YMD
        ) VALUES (
            :CLS_CD, :CLS_NM, :TSHOSD, :SPVS_SE, :LSTG_YMD, :PRVDY_LAST_PRC,
            :CLS_STTS, :MRKT_SE_CD, :MRKT_NM, :TPBIZ_NM, :CO_SZ_CLSF, :CO_CLSF,
            :IVST_CTN_CLS_CD, :NTX_PSBLTY_YN, :UPDT_YMD
        )
    """
    
    cursor = db.cursor()
    try:
        cursor.executemany(merge_sql, db_data)
        db.commit()
        print(f"Merged {len(db_data)} records into TTST01M.")
        return {"status": "success", "count": len(db_data)}
    except Exception as e:
        db.rollback()
        print(f"Error merging data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.post("/api/stock/daily-price/sync")
def sync_daily_price(db: cx_Oracle.Connection = Depends(get_db)):
    print("Starting daily price sync...")
    
    # 1. Get all stock codes from TTST01M
    cursor = db.cursor()
    try:
        cursor.execute("SELECT CLS_CD FROM TTST01M")
        stocks = cursor.fetchall() # List of tuples [('005930',), ...]
        stock_codes = [s[0] for s in stocks]
        print(f"Found {len(stock_codes)} stocks to process.")
    except Exception as e:
        print(f"Error fetching stock list: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

    total_count = len(stock_codes)
    processed_count = 0
    
    # 2. Loop and fetch/merge
    # We will commit every 10 stocks to avoid long transactions
    cursor = db.cursor()
    
    merge_sql = """
    MERGE INTO TTST02L T
    USING DUAL ON (T.CLS_CD = :CLS_CD AND T.YMD = :YMD)
    WHEN MATCHED THEN
        UPDATE SET
            BGNG_PRC = :BGNG_PRC,
            HGHST_PRC = :HGHST_PRC,
            LOWST_PRC = :LOWST_PRC,
            LAST_PRC = :LAST_PRC,
            DLNG_NOCS = :DLNG_NOCS,
            DLNG_AMT = :DLNG_AMT
    WHEN NOT MATCHED THEN
        INSERT (
            CLS_CD, YMD, BGNG_PRC, HGHST_PRC, LOWST_PRC, LAST_PRC, DLNG_NOCS, DLNG_AMT
        ) VALUES (
            :CLS_CD, :YMD, :BGNG_PRC, :HGHST_PRC, :LOWST_PRC, :LAST_PRC, :DLNG_NOCS, :DLNG_AMT
        )
    """
    
    try:
        for code in stock_codes:
            processed_count += 1
            print(f"[{processed_count}/{total_count}] Processing {code}...")
            
            # Fetch latest DB record (A value)
            latest_record = None
            try:
                # Use a new cursor or existing one? existing one is fine if we fetchall first or use separate cursor
                # We are inside a loop over stock_codes which is a list, so cursor is free?
                # No, cursor is used for executemany later. We should use a separate cursor for reading.
                read_cursor = db.cursor()
                read_cursor.execute("""
                    SELECT CLS_CD, YMD, BGNG_PRC, HGHST_PRC, LOWST_PRC, LAST_PRC
                    FROM (
                        SELECT CLS_CD, YMD, BGNG_PRC, HGHST_PRC, LOWST_PRC, LAST_PRC,
                               ROW_NUMBER() OVER (PARTITION BY CLS_CD ORDER BY YMD DESC) AS RN
                        FROM TTST02L
                        WHERE CLS_CD = :CLS_CD
                    )
                    WHERE RN = 1
                """, {"CLS_CD": code})
                row = read_cursor.fetchone()
                if row:
                    latest_record = {
                        "CLS_CD": row[0],
                        "YMD": row[1],
                        "BGNG_PRC": row[2],
                        "HGHST_PRC": row[3],
                        "LOWST_PRC": row[4],
                        "LAST_PRC": row[5]
                    }
                read_cursor.close()
            except Exception as e:
                print(f"Error fetching latest record for {code}: {e}")

            # Fetch history (1095 days)
            # get_daily_price_history handles rate limiting internally (sleeps 0.25s)
            prices = kiwoom.get_daily_price_history(code, target_days=1095, latest_db_record=latest_record)
            
            if not prices:
                continue
                
            db_data = []
            for p in prices:
                # Remove commas if present and convert to absolute integer
                open_prc = abs(int(p.get('open', '0').replace(',', '')))
                high_prc = abs(int(p.get('high', '0').replace(',', '')))
                low_prc = abs(int(p.get('low', '0').replace(',', '')))
                close_prc = abs(int(p.get('close', '0').replace(',', '')))
                vol = int(p.get('volume', '0').replace(',', ''))
                amt = int(p.get('amount', '0').replace(',', ''))
                
                db_data.append({
                    "CLS_CD": code,
                    "YMD": p.get('date', ''),
                    "BGNG_PRC": open_prc,
                    "HGHST_PRC": high_prc,
                    "LOWST_PRC": low_prc,
                    "LAST_PRC": close_prc,
                    "DLNG_NOCS": vol,
                    "DLNG_AMT": amt
                })
            
            if db_data:
                cursor.executemany(merge_sql, db_data)
                
            # Commit every 10 stocks
            if processed_count % 10 == 0:
                db.commit()
                
            # Extra sleep not needed as get_daily_price_history sleeps, 
            # but if it returns empty immediately (e.g. error), we should sleep to be safe.
            # But get_daily_price_history sleeps at start of loop.
            # So if we call it again for next stock, it will sleep first.
            
        db.commit()
        return {"status": "success", "processed": processed_count}
        
    except Exception as e:
        db.rollback()
        print(f"Error during daily price sync: {e}")
        # We don't raise here to allow partial success? No, let's raise.
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")
    finally:
        cursor.close()


@app.get("/api/analysis/breakout120")
def get_breakout_120(
    year_month: str, 
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Columns from requirements
        query = """
            SELECT 
                YMD, CLS_CD, CLS_NM, MRKT_SE_CD, MRKT_NM, 
                MRKT_CAP, UP_RATE, LAST_PRC, A_120_DISP, B_120_DISP, 
                C_PERIOD, TPBIZ_NM, 
                (SELECT MEMO_CN FROM TTST01M WHERE CLS_CD = TTSTA1L.CLS_CD) as MEMO_CN, 
                UP_RT_120_LOW, 
                UP_RT_5D, UP_RT_10D, UP_RT_20D, UP_RT_60D, 
                UP_RT_120D, UP_RT_222D
            FROM TTSTA1L
            WHERE YMD LIKE :ymd || '%'
            AND C_PERIOD > 30
            AND MRKT_CAP > 1
            ORDER BY YMD DESC
        """
        
        # year_month format expected: YYYYMM
        params = {"ymd": year_month}
        
        print(f"Executing Breakout 120 Query for {year_month}")
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "ymd": row[0],
                "code": row[1],
                "name": row[2],
                "market_code": row[3],
                "market_name": row[4],
                "market_cap": row[5],
                "up_rate": row[6],
                "last_price": row[7],
                "a_120_disp": row[8],
                "b_120_disp": row[9],
                "c_period": row[10],
                "sector": row[11],
                "memo": row[12],
                "up_rate_120_low": row[13],
                "up_rate_5d": row[14],
                "up_rate_10d": row[15],
                "up_rate_20d": row[16],
                "up_rate_60d": row[17],
                "up_rate_120d": row[18],
                "up_rate_222d": row[19]
            })
            
            # Handle CLOB if necessary
            if hasattr(results[-1]["memo"], 'read'):
                results[-1]["memo"] = results[-1]["memo"].read()
            
        return {"result": results}

    except Exception as e:
        print(f"Error fetching breakout 120 data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.get("/api/analysis/breakout120v2")
def get_breakout_120_v2(
    year_month: str, 
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Columns from requirements
        query = """
            SELECT 
                YMD, CLS_CD, CLS_NM, MRKT_SE_CD, MRKT_NM, 
                MRKT_CAP, UP_RATE, LAST_PRC, A_120_DISP, B_120_DISP, 
                C_PERIOD, TPBIZ_NM, 
                (SELECT MEMO_CN FROM TTST01M WHERE CLS_CD = TTSTA2L.CLS_CD) as MEMO_CN, 
                UP_RT_120_LOW, 
                UP_RT_5D, UP_RT_10D, UP_RT_20D, UP_RT_60D, 
                UP_RT_120D, UP_RT_222D
            FROM TTSTA2L
            WHERE YMD LIKE :ymd || '%'
            AND C_PERIOD > 30
            AND MRKT_CAP <= 1
            ORDER BY YMD DESC
        """
        
        # year_month format expected: YYYYMM
        params = {"ymd": year_month}
        
        print(f"Executing Breakout 120 V2 Query for {year_month}")
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "ymd": row[0],
                "code": row[1],
                "name": row[2],
                "market_code": row[3],
                "market_name": row[4],
                "market_cap": row[5],
                "up_rate": row[6],
                "last_price": row[7],
                "a_120_disp": row[8],
                "b_120_disp": row[9],
                "c_period": row[10],
                "sector": row[11],
                "memo": row[12],
                "up_rate_120_low": row[13],
                "up_rate_5d": row[14],
                "up_rate_10d": row[15],
                "up_rate_20d": row[16],
                "up_rate_60d": row[17],
                "up_rate_120d": row[18],
                "up_rate_222d": row[19]
            })
            
        return {"result": results}

    except Exception as e:
        print(f"Error fetching breakout 120 v2 data: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.get("/api/inquiry/returns")
def get_stock_returns(
    code: str = None,
    name: str = None,
    market_cap_min: float = None,
    market_cap_max: float = None,
    market_type: str = None, # 'STOCK' (0,10) or 'ETF' (8)
    return_type: str = None, # '1D', '5D', '10D', '20D', '60D', '120D', '240D'
    return_val: float = None,
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Base SQL provided by user
        sql_with = """
        WITH YEAR_CLOSE_DATA AS (
            SELECT
                CLS_CD,
                SUBSTR(YMD, 1, 4) AS YYYY,
                MAX(LAST_PRC) KEEP (DENSE_RANK LAST ORDER BY YMD) AS YEAR_CLOSE_PRC
            FROM
                TTST02L
            GROUP BY
                CLS_CD, SUBSTR(YMD, 1, 4)
        ),
        BASE_DATA AS (
            SELECT
                CLS_CD,
                YMD,
                LAST_PRC,
                LAG(LAST_PRC, 1)   OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_1D_AGO,
                LAG(LAST_PRC, 5)   OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_5D_AGO,
                LAG(LAST_PRC, 10)  OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_10D_AGO,
                LAG(LAST_PRC, 20)  OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_20D_AGO,
                LAG(LAST_PRC, 60)  OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_60D_AGO,
                LAG(LAST_PRC, 120) OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_120D_AGO,
                LAG(LAST_PRC, 240) OVER (PARTITION BY CLS_CD ORDER BY YMD) AS PRICE_240D_AGO,
                ROW_NUMBER() OVER (PARTITION BY CLS_CD ORDER BY YMD DESC) AS RN
            FROM
                TTST02L
        ),
        ANALYZED_DATA AS (
            SELECT
                B.CLS_CD,
                B.YMD,
                M.CLS_NM,
                M.MRKT_NM,
                M.LSTG_YMD,
                M.MRKT_SE_CD,
                M.MEMO_CN,
                TRUNC((NVL(M.TSHOSD, 0) * NVL(B.LAST_PRC, 0)) / 1000000000000, 2) AS MARKET_CAP_TRIL,
                B.LAST_PRC,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_1D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_1D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_5D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_5D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_10D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_10D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_20D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_20D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_60D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_60D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_120D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_120D,
                TRUNC(((B.LAST_PRC / NULLIF(B.PRICE_240D_AGO, 0)) - 1) * 100, 2) AS ERNRT_PRD_240D,
                TRUNC(((B.LAST_PRC / NULLIF(Y1.YEAR_CLOSE_PRC, 0)) - 1) * 100, 2) AS ERNRT_YTD,
                TRUNC(((Y1.YEAR_CLOSE_PRC / NULLIF(Y2.YEAR_CLOSE_PRC, 0)) - 1) * 100, 2) AS ERNRT_LAST_YR
            FROM
                BASE_DATA B
                INNER JOIN TTST01M M ON B.CLS_CD = M.CLS_CD
                LEFT JOIN YEAR_CLOSE_DATA Y1 ON B.CLS_CD = Y1.CLS_CD AND TO_NUMBER(SUBSTR(B.YMD, 1, 4)) - 1 = TO_NUMBER(Y1.YYYY)
                LEFT JOIN YEAR_CLOSE_DATA Y2 ON B.CLS_CD = Y2.CLS_CD AND TO_NUMBER(SUBSTR(B.YMD, 1, 4)) - 2 = TO_NUMBER(Y2.YYYY)
            WHERE
                B.RN = 1
        )
        SELECT
            CLS_CD, CLS_NM, MRKT_NM, MARKET_CAP_TRIL, LAST_PRC,
            ERNRT_PRD_1D, ERNRT_PRD_5D, ERNRT_PRD_10D, ERNRT_PRD_20D,
            ERNRT_PRD_60D, ERNRT_PRD_120D, ERNRT_PRD_240D, ERNRT_YTD, ERNRT_LAST_YR,
            LSTG_YMD, YMD, MEMO_CN
        FROM
            ANALYZED_DATA
        WHERE 1=1
        """

        # Dynamic Filters
        params = {}
        
        if code:
            sql_with += " AND CLS_CD LIKE :code || '%'"
            params["code"] = code
        
        if name:
            sql_with += " AND CLS_NM LIKE '%' || :name || '%'"
            params["name"] = name
            
        if market_cap_min is not None:
            sql_with += " AND MARKET_CAP_TRIL >= :market_cap_min"
            params["market_cap_min"] = market_cap_min
            
        if market_cap_max is not None:
            sql_with += " AND MARKET_CAP_TRIL <= :market_cap_max"
            params["market_cap_max"] = market_cap_max

        if market_type:
            # market_type: 'STOCK' -> 0, 10; 'ETF' -> 8
            if market_type == 'STOCK':
                sql_with += " AND MRKT_SE_CD IN ('0', '10')"
            elif market_type == 'ETF':
                sql_with += " AND MRKT_SE_CD = '8'"
        
        if return_type:
            # Map return_type to column name
            col_map = {
                '1D': 'ERNRT_PRD_1D',
                '5D': 'ERNRT_PRD_5D',
                '10D': 'ERNRT_PRD_10D',
                '20D': 'ERNRT_PRD_20D',
                '60D': 'ERNRT_PRD_60D',
                '120D': 'ERNRT_PRD_120D',
                '240D': 'ERNRT_PRD_240D'
            }
            if return_type in col_map:
                col_name = col_map[return_type]
                # Requirement: Exclude if return value is missing
                sql_with += f" AND {col_name} IS NOT NULL"
                
                if return_val is not None:
                    sql_with += f" AND {col_name} >= :return_val"
                    params["return_val"] = return_val

        # Sorting: Descending order by selected return rate period, or default by CLS_NM
        if return_type:
            col_map = {
                '1D': 'ERNRT_PRD_1D',
                '5D': 'ERNRT_PRD_5D',
                '10D': 'ERNRT_PRD_10D',
                '20D': 'ERNRT_PRD_20D',
                '60D': 'ERNRT_PRD_60D',
                '120D': 'ERNRT_PRD_120D',
                '240D': 'ERNRT_PRD_240D'
            }
            if return_type in col_map:
                col_name = col_map[return_type]
                sql_with += f" ORDER BY {col_name} DESC"
            else:
                 sql_with += " ORDER BY CLS_NM"
        else:
             sql_with += " ORDER BY CLS_NM"

        print(f"Executing Stock Returns Query")
        cursor.execute(sql_with, params)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            results.append({
                "code": row[0],
                "name": row[1],
                "market_name": row[2],
                "market_cap": row[3],
                "last_price": row[4],
                "return_1d": row[5],
                "return_5d": row[6],
                "return_10d": row[7],
                "return_20d": row[8],
                "return_60d": row[9],
                "return_120d": row[10],
                "return_240d": row[11],
                "return_ytd": row[12],
                "return_last_yr": row[13],
                "listing_date": row[14],
                "ymd": row[15],
                "memo": row[16]
            })
            
            # Handle CLOB if necessary
            if hasattr(results[-1]["memo"], 'read'):
                results[-1]["memo"] = results[-1]["memo"].read()
            
            # Handle CLOB if necessary
            if hasattr(results[-1]["memo"], 'read'):
                results[-1]["memo"] = results[-1]["memo"].read()
            
        return {"result": results}

    except Exception as e:
        print(f"Error fetching stock returns: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.get("/api/stock/history/{code}")
def get_stock_history(
    code: str, 
    ref_date: str, # YYYYMMDD
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Strategy:
        # 1. Calculate start/end dates for the requested 6-month view.
        # 2. To get accurate MAs (up to 240 days), we need data from (Start - 240 days).
        # 3. Use a subquery to calculate MAs over the extended range.
        # 4. Filter the outer query to the requested range.

        query = """
            SELECT * FROM (
                SELECT 
                    YMD, 
                    LAST_PRC, 
                    BGNG_PRC, 
                    HGHST_PRC, 
                    LOWST_PRC,
                    DLNG_AMT / 100 as AMT,
                    ROUND(AVG(LAST_PRC) OVER (ORDER BY YMD ROWS BETWEEN 4 PRECEDING AND CURRENT ROW), 0) as MA5,
                    ROUND(AVG(LAST_PRC) OVER (ORDER BY YMD ROWS BETWEEN 19 PRECEDING AND CURRENT ROW), 0) as MA20,
                    ROUND(AVG(LAST_PRC) OVER (ORDER BY YMD ROWS BETWEEN 59 PRECEDING AND CURRENT ROW), 0) as MA60,
                    ROUND(AVG(LAST_PRC) OVER (ORDER BY YMD ROWS BETWEEN 119 PRECEDING AND CURRENT ROW), 0) as MA120,
                    ROUND(AVG(LAST_PRC) OVER (ORDER BY YMD ROWS BETWEEN 239 PRECEDING AND CURRENT ROW), 0) as MA240
                FROM TTST02L
                WHERE CLS_CD = :code
            )
            WHERE YMD BETWEEN TO_CHAR(TO_DATE(:ref_date, 'YYYYMMDD') - 365, 'YYYYMMDD') 
                          AND TO_CHAR(TO_DATE(:ref_date, 'YYYYMMDD') + 365, 'YYYYMMDD')
            ORDER BY YMD ASC
        """
        
        params = {"code": code, "ref_date": ref_date}
        
        print(f"Fetching history for {code} around {ref_date}")
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        history = []
        for row in rows:
            # 0:YMD, 1:LAST, 2:OPEN, 3:HIGH, 4:LOW, 5:AMT, 6:MA5, 7:MA20, 8:MA60, 9:MA120, 10:MA240
            
            history.append({
                "date": row[0],
                "close": row[1] if row[1] else 0,
                "open": row[2],
                "high": row[3],
                "low": row[4],
                "trading_value": row[5] if row[5] else 0,
                "ma5": row[6],
                "ma20": row[7],
                "ma60": row[8],
                "ma120": row[9],
                "ma240": row[10]
            })
            
        return {"result": history}

    except Exception as e:
        print(f"Error fetching stock history: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

class MemoUpdate(BaseModel):
    code: str
    memo: str

@app.put("/api/stock/memo")
def update_stock_memo(
    request: MemoUpdate,
    db: cx_Oracle.Connection = Depends(get_db)
):
    print(f"Updating memo for {request.code}")
    cursor = db.cursor()
    try:
        # Update TTST01M
        sql = """
            UPDATE TTST01M
            SET MEMO_CN = :memo,
                UPDT_YMD = TO_CHAR(SYSDATE, 'YYYYMMDD')
            WHERE CLS_CD = :code
        """
        cursor.execute(sql, {"memo": request.memo, "code": request.code})
        db.commit()
        
        # Also update TTSTA1L and TTSTA2L if they have MEMO_CN column?
        # Requirement says "Update TTST01M.MEMO_CN".
        # But for the UI to reflect it immediately without re-fetching everything from join, 
        # usually we just re-fetch the list which joins TTST01M.
        # The query in get_breakout_120 joins nothing? 
        # Wait, get_breakout_120 queries TTSTA1L. Does TTSTA1L have MEMO_CN?
        # Yes, lines 399 in main.py: "MEMO_CN". 
        # If TTSTA1L table has its own MEMO_CN, updating TTST01M won't update TTSTA1L automatically unless there is a trigger or we update both.
        # The user said "TTST01M.MEMO_CN 컬럼에 저장". 
        # But display comes from TTSTA1L/TTSTA2L. 
        # I should check if TTSTA1L is a view or table. The name ends in 'L', usually table in this project ('List'?).
        # If it is a snapshot table, updating Main (M) won't reflect in List (L) immediately.
        # However, usually MEMO is a master attribute.
        # If TTSTA1L.MEMO_CN exists, it might be populated from TTST01M during daily batch.
        # To show it immediately on the screen, I might need to update TTSTA1L / TTSTA2L as well if they are tables.
        # Let's assume for now I should only update TTST01M as requested. 
        # But the User also says "목록에서 우클릭...". The list displays data from TTSTA1L.
        # If I only update TTST01M, the list won't change if it reads from TTSTA1L.
        # I will check with a simple update to TTST01M first as explicitly requested. 
        # "저장 버튼 클릭하면 TTST01M.MEMO_CN 컬럼에 저장"
        
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"Error updating memo: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

# --- Interested Stocks APIs ---

class InterestRecord(BaseModel):
    group_name: str
    code: str
    buy_date: Optional[str] = None
    buy_price: Optional[int] = None

class InterestUpdate(BaseModel):
    original_group_name: str
    code: str
    new_group_name: str
    buy_date: Optional[str] = None
    buy_price: Optional[int] = None

@app.get("/api/interest")
def get_interested_stocks(
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Join TTST03L with TTST01M to get name, market, current price etc.
        query = """
            SELECT 
                I.GROUP_NM,
                I.CLS_CD,
                M.CLS_NM,
                M.MRKT_NM,
                I.BYNG_YMD,
                I.BYNG_PRC,
                (SELECT LAST_PRC FROM TTST02L WHERE CLS_CD = I.CLS_CD ORDER BY YMD DESC FETCH FIRST 1 ROWS ONLY) as CURRENT_PRICE,
                I.REG_YMD,
                M.MEMO_CN
            FROM TTST03L I
            LEFT JOIN TTST01M M ON I.CLS_CD = M.CLS_CD
            ORDER BY I.GROUP_NM, M.CLS_NM
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        results = []
        for row in rows:
            # Calculate Profit % if Buy Price exists
            buy_price = row[5]
            current_price = row[6]
            profit_rate = None
            if buy_price and buy_price > 0 and current_price:
                 profit_rate = round(((current_price - buy_price) / buy_price) * 100, 2)
            
            # Handle CLOB for Memo
            memo_val = row[8]
            if hasattr(memo_val, 'read'):
                memo_val = memo_val.read()

            results.append({
                "group_name": row[0],
                "code": row[1],
                "name": row[2],
                "market_name": row[3],
                "buy_date": row[4],
                "buy_price": row[5],
                "current_price": row[6],
                "reg_date": row[7],
                "memo": memo_val,
                "profit_rate": profit_rate
            })
            
        return {"result": results}
    except Exception as e:
        print(f"Error fetching interested stocks: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.post("/api/interest")
def add_interested_stock(
    item: InterestRecord,
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # Check if exists
        check_sql = "SELECT 1 FROM TTST03L WHERE GROUP_NM = :gn AND CLS_CD = :cd"
        # Ensure we pass strings/ints, handle None if necessary (though Pydantic handles basic logic, we need to ensure None is handled by DB driver if not using defaults)
        # cx_Oracle handles None as NULL.
        cursor.execute(check_sql, {"gn": item.group_name, "cd": item.code})
        if cursor.fetchone():
             raise HTTPException(status_code=400, detail="Stock already exists in this group")
             
        # Insert
        insert_sql = """
            INSERT INTO TTST03L (GROUP_NM, CLS_CD, BYNG_YMD, BYNG_PRC, REG_YMD)
            VALUES (:gn, :cd, :bd, :bp, TO_CHAR(SYSDATE, 'YYYYMMDD'))
        """
        cursor.execute(insert_sql, {
            "gn": item.group_name,
            "cd": item.code,
            "bd": item.buy_date,
            "bp": item.buy_price
        })
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error adding interested stock: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@app.put("/api/interest")
def update_interested_stock(
    item: InterestUpdate,
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        # If group name changed, we might need to check if new group+code already exists (unless it's same record)
        if item.original_group_name != item.new_group_name:
            check_sql = "SELECT 1 FROM TTST03L WHERE GROUP_NM = :gn AND CLS_CD = :cd"
            cursor.execute(check_sql, {"gn": item.new_group_name, "cd": item.code})
            if cursor.fetchone():
                 raise HTTPException(status_code=400, detail="Stock already exists in the new group")

        # Update
        # PK is GROUP_NM, CLS_CD. If GROUP_NM changes, we update it.
        # Oracle allows updating PK columns.
        update_sql = """
            UPDATE TTST03L
            SET GROUP_NM = :new_gn,
                BYNG_YMD = :bd,
                BYNG_PRC = :bp
            WHERE GROUP_NM = :old_gn 
              AND CLS_CD = :cd
        """
        cursor.execute(update_sql, {
            "new_gn": item.new_group_name,
            "bd": item.buy_date,
            "bp": item.buy_price,
            "old_gn": item.original_group_name,
            "cd": item.code
        })
        
        if cursor.rowcount == 0:
             raise HTTPException(status_code=404, detail="Interest record not found")
             
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error updating interested stock: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()

@app.delete("/api/interest")
def delete_interested_stock(
    group_name: str, 
    code: str,
    db: cx_Oracle.Connection = Depends(get_db)
):
    cursor = db.cursor()
    try:
        sql = "DELETE FROM TTST03L WHERE GROUP_NM = :gn AND CLS_CD = :cd"
        cursor.execute(sql, {"gn": group_name, "cd": code})
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"Error deleting interested stock: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
