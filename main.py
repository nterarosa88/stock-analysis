from fastapi import FastAPI, Request, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import uvicorn
from kiwoom import KiwoomREST

# Configuration - PLEASE FILL THESE IN
API_KEY = "zSGJpwoiewyrt0S2axli2D6hFuLne84twWNl925BDiQ"
SECRET_KEY = "keLe2y_lHLfcSqP-ArylTkzE2hd1S3aScp8Tnn0Dx1w"
ACCOUNT_NO = "39645031"

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# Initialize REST Client (Global instance)
kiwoom = KiwoomREST(API_KEY, SECRET_KEY, ACCOUNT_NO)

@app.on_event("startup")
async def startup_event():
    """FastAPI가 시작될 때 자동으로 로그인"""
    kiwoom.login()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# [Menu 1] Stock Info (ka10001)
@app.get("/info", response_class=HTMLResponse)
async def info_page(request: Request):
    return templates.TemplateResponse("info.html", {"request": request})

@app.post("/info", response_class=HTMLResponse)
async def info_search(request: Request, code: str = Form(...)):
    data = kiwoom.get_stock_info(code)
    return templates.TemplateResponse("info.html", {
        "request": request,
        "result": data,
        "search_code": code
    })

# [Menu 2] Stock List (ka10099)
@app.get("/list", response_class=HTMLResponse)
async def list_page(request: Request, market: str = None, stock_name: str = None):
    data = None
    
    # Only fetch data if market is provided (i.e., user clicked search)
    if market:
        data = kiwoom.get_stock_list(market)
        
        # Filter by stock name if provided
        if stock_name and data:
            import re
            # Escape special regex characters except for % which we treat as wildcard
            # We'll replace % with .* for regex matching
            # And we'll use re.IGNORECASE
            
            # Convert SQL LIKE pattern to Regex
            # Escape regex special characters first, but we want to keep % as our wildcard
            # So we can split by %, escape parts, and join with .*
            
            parts = stock_name.split('%')
            escaped_parts = [re.escape(p) for p in parts]
            pattern_str = ".*".join(escaped_parts)
            
            # If the pattern didn't start/end with %, the regex shouldn't necessarily match the whole string 
            # unless we want exact match behavior for non-wildcard parts.
            # However, standard LIKE '%foo%' means "contains foo". 
            # LIKE 'foo' means "exact match foo".
            # The user requirement: "항목명 조건은 "%" 포함되면 SQL의 LIKE 검색처럼 조회하게 수정"
            # AND "항목명 조회시 대소문자 무시하고 조회하게 수정"
            
            # Let's refine the regex construction:
            # If stock_name has no '%', it's a substring search (or exact? User said "조회시 종목명이 있으면 목록 표시할 때 목록 중에 입력한 종목명이 포함된 목록을 표시" in previous turn, but now "LIKE 검색처럼").
            # Actually, "LIKE 검색처럼" usually implies exact match unless wildcards are used.
            # But the previous requirement was "contains".
            # Let's assume:
            # If '%' is present -> Treat as LIKE pattern.
            # If '%' is NOT present -> Treat as "contains" (substring match) based on typical user expectation for "search", OR exact match if they strictly mean "LIKE".
            # BUT, the user said: "항목명 조건은 "%" 포함되면 SQL의 LIKE 검색처럼 조회하게 수정"
            # This implies if NO "%", maybe it's just substring or exact?
            # Let's stick to: If "%" in stock_name, use regex for LIKE. Else, use simple substring check (case-insensitive).
            
            if '%' in stock_name:
                pattern = f"^{pattern_str}$" # Anchor to start/end to mimic LIKE behavior on the whole string
                regex = re.compile(pattern, re.IGNORECASE)
                data = [item for item in data if regex.match(item['name'])]
            else:
                # Default to substring match, case-insensitive
                stock_name_lower = stock_name.lower()
                data = [item for item in data if stock_name_lower in item['name'].lower()]

    return templates.TemplateResponse("list.html", {
        "request": request,
        "result": data,
        "market": market,
        "stock_name": stock_name
    })

# [Menu 3] Stock Price (ka10086)
@app.get("/price", response_class=HTMLResponse)
async def price_page(request: Request, code: str, name: str = None):
    # Initial load - get first page
    data = kiwoom.get_daily_price(code)
    price_list = data.get("list", []) if data else []
    next_key = data.get("next_key") if data else None
    
    import json
    return templates.TemplateResponse("price.html", {
        "request": request,
        "code": code,
        "name": name,
        "result": price_list,
        "result_json": json.dumps(price_list),
        "next_key": next_key
    })

@app.get("/api/price")
async def get_price_data(code: str, next_key: str = None):
    data = kiwoom.get_daily_price(code, next_key=next_key)
    return data if data else {"list": [], "next_key": None}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    #uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
