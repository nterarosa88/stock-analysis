import requests
import json

class KiwoomREST:
    BASE_URL = "https://api.kiwoom.com"

    def __init__(self, api_key, secret_key, account_no):
        self.api_key = api_key
        self.secret_key = secret_key
        self.account_no = account_no
        self.access_token = None
        self.log_file = "debug.log"
        with open(self.log_file, "w", encoding="utf-8") as f:
            f.write("KiwoomREST initialized\n")

    def log(self, message):
        print(message)
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(message + "\n")
        except:
            pass

    # ... (skipping login method changes for brevity if not needed, but better to be consistent. 
    # Actually I should replace the whole class or just the methods. 
    # I'll replace __init__ and log first, then get_stock_list exception block.)
    
    # Wait, replace_file_content replaces a contiguous block.
    # __init__ and log are at the top. get_stock_list is further down.
    # I should use multi_replace_file_content or two calls.
    # I'll use multi_replace_file_content.

    def login(self):
        """
        Authenticates with the Kiwoom REST API.
        """
        url = f"{self.BASE_URL}/oauth2/token" 
        headers = {
            "Content-Type": "application/json"
        }
        data = {
            "grant_type": "client_credentials",
            "appkey": self.api_key,
            "secretkey": self.secret_key  # Changed from 'appsecret' to 'secretkey'
        }
        
        try:
            self.log(f"Attempting login with AppKey: {self.api_key[:5]}...")
            self.log(f"Request URL: {url}")
            self.log(f"Request Headers: {headers}")
            self.log(f"Request Body (before JSON encoding): {data}")
            
            response = requests.post(url, headers=headers, json=data)
            
            self.log(f"Login response status: {response.status_code}")
            self.log(f"Login response headers: {dict(response.headers)}")
            self.log(f"Login response body: {response.text}")
            
            if response.status_code == 200:
                response_data = response.json()
                self.log(f"Response JSON keys: {list(response_data.keys())}")
                
                self.access_token = response_data.get("access_token")
                if not self.access_token:
                    # 다른 가능한 필드명들 시도
                    self.access_token = response_data.get("accessToken") or \
                                       response_data.get("token") or \
                                       response_data.get("approval_key")
                
                if self.access_token:
                    self.log(f"Login Successful - Token: {self.access_token[:20]}...")
                else:
                    self.log(f"Login ERROR: No token found in response!")
                    self.log(f"Full response: {response_data}")
            else:
                self.log(f"Login Failed: {response.text}")
                self.access_token = None
            
        except Exception as e:
            self.log(f"Login failed: {e}")
            import traceback
            self.log(f"Traceback: {traceback.format_exc()}")

    def get_stock_info(self, code):
        """
        [TR: ka10001] Fetches detailed stock information.
        Returns: Code, Name, Market Cap, Open, Low, High, Current Price
        """
        if not self.access_token:
            self.log("Error: Not logged in.")
            return None

        url = f"{self.BASE_URL}/v1/domestic-stock/price" # Adjust if ka10001 has specific path
        
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "appkey": self.api_key,
            "appsecret": self.secret_key,
            "tr_id": "ka10001", # Updated to user requested TR ID
            "custtype": "P"
        }
        params = {
            "fid_cond_mrkt_div_code": "J",
            "fid_input_iscd": code
        }

        try:
            self.log(f"[ka10001] Fetching info for {code}...")
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                output = data.get("output", {})
                
                # Mapping fields (Standard Kiwoom field names assumed)
                return {
                    "code": code,
                    "name": output.get("hts_kor_isnm", "-"),      # 종목명
                    "market_cap": output.get("hts_avls", "-"),    # 시가총액 (check field name)
                    "open": output.get("stck_oprc", "-"),         # 시가
                    "low": output.get("stck_lwpr", "-"),          # 저가
                    "high": output.get("stck_hgpr", "-"),         # 고가
                    "current": output.get("stck_prpr", "-")       # 현재가
                }
            else:
                self.log(f"[ka10001] Failed: {response.text}")
                return None

        except Exception as e:
            self.log(f"[ka10001] Error: {e}")
            return None

    def get_stock_list(self, market_type, cont_yn='N', next_key=''):
        """
        [TR: ka10099] Fetches stock list by market.
        Returns: Market Name, Stock Name, Market Cap, Prev Close
        """
        self.log("call get_stock_list")

        if not self.access_token:
            self.log("Error: Not logged in.")
            return None

        url = f"{self.BASE_URL}/api/dostk/stkinfo" # Adjust if ka10099 has specific path
        
        headers = {
            'Content-Type': 'application/json;charset=UTF-8', # 컨텐츠타입
            "authorization": f"Bearer {self.access_token}",
            "cont-yn": cont_yn,
            "next-key": next_key,
            "api-id": "ka10099", # Updated to user requested TR ID
        }
        params = {
            "mrkt_tp": market_type # 0: KOSPI, 10: KOSDAQ, 8: ETF
        }

        try:
            self.log(f"[ka10099] Fetching list for market {market_type}...")
            self.log(f"[ka10099] Fetching list for headers {headers}...")
            self.log(f"[ka10099] Fetching list for params {params}...")
            response = requests.post(url, headers=headers, json=params)
            
            if response.status_code == 200:
                data = response.json()

                # self.log(f"[ka10099] Fetching list for data {data}...")
                # self.log(f"type of data {type(data)}")
                # self.log(f"data len {len(data)}")
                self.log(f"data {data}")


                #output_list = data.get("output", [])
                
                results = []
                if data.get("list"):
                    for item in data["list"]:
                        self.log(f"item {item}")
                        results.append({
                            "market_name": item.get("marketName", "-"),
                            "code": item.get("code", "-"),
                            "name": item.get("name", "-"),
                            "market_cap": f"{int(item.get('listCount', '0')) * int(item.get('lastPrice', '0')):,.0f}",  # 시가총액
                            "last_price": f"{int(item.get('lastPrice', '0')):,.0f}"  # 전일종가
                        })

                # self.log(f'last_price {item["lastPrice"]}')

                # self.log(f"[ka10099] Fetched {len(results)} stocks for market {market_type}")
                # self.log(f"[ka10099] Fetched {results}")
                return results
            else:
                self.log(f"[ka10099] Failed: {data['return_msg']}")
                return None

        except Exception as e:
            self.log(f"[ka10099] Error: {e}")
            return None
            return None

    def get_stock_list_full(self, market_type):
        """
        [TR: ka10099] Fetches full stock list for DB sync.
        """
        if not self.access_token:
            self.log("Error: Not logged in.")
            return None

        url = f"{self.BASE_URL}/api/dostk/stkinfo"
        
        headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            "authorization": f"Bearer {self.access_token}",
            "api-id": "ka10099",
        }
        
        # Loop for continuous retrieval if needed, but the spec says cont-yn is in header.
        # For simplicity, let's implement basic loop handling if cont-yn is Y.
        
        all_results = []
        next_key = ""
        cont_yn = "N"
        
        while True:
            headers["cont-yn"] = cont_yn
            headers["next-key"] = next_key
            
            params = {
                "mrkt_tp": market_type
            }

            try:
                self.log(f"[ka10099] Fetching full list for market {market_type} (next_key={next_key})...")
                response = requests.post(url, headers=headers, json=params)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check for continuation
                    cont_yn = response.headers.get("cont-yn", "N")
                    next_key = response.headers.get("next-key", "")
                    
                    if data.get("list"):
                        for item in data["list"]:
                            # 시장구분코드가 market_type과 일치하는 경우에만 추가
                            if item.get("marketCode") == market_type:
                                all_results.append(item)

                    if cont_yn != "Y":
                        break
                else:
                    self.log(f"[ka10099] Failed: {response.text}")
                    return None

            except Exception as e:
                self.log(f"[ka10099] Error: {e}")
                return None
                
        return all_results

    def get_daily_price(self, code, next_key=None, qry_dt=None, cont_yn="N"):
        """
        [TR: ka10086] Fetches daily stock price.
        Returns: List of daily prices
        """
        if not self.access_token:
            self.log("Error: Not logged in.")
            return None

        # User suggested URL: https://api.kiwoom.com//api/dostk/stkinfo
        url = f"{self.BASE_URL}/api/dostk/mrkcond"

        # self.log(f"call get_daily_price")
        self.log(f"[ka10086] Fetching daily price for {code} (next_key={next_key}, cont_yn={cont_yn})...")

        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "Authorization": f"Bearer {self.access_token}",
            "api-id": "ka10086",
            "cont-yn": cont_yn,
            "next-key": next_key if next_key else ""
        }
        
        params = {
            "stk_cd": code,     #종목코드
            "qry_dt": qry_dt,   #날짜
            "indc_tp": "0"      #표시구분 0:수량, 1:금액(백만원)
        }
        
        try:
            # self.log(f"[ka10086] Fetching daily price for {code} (next_key={next_key})...")
            response = requests.post(url, headers=headers, json=params)
            
            if response.status_code == 200:
                cont_yn_val = response.headers.get("cont-yn")
                next_key_val = response.headers.get("next-key")
                # self.log(f"[ka10086] Cont YN: {cont_yn_val}")
                # self.log(f"[ka10086] Next Key: {next_key_val}")

                data = response.json()
                # self.log(f"[ka10086] Data: {data}")
                
                items = data.get("daly_stkpc")
                # next_key_val = response.headers.get("next_key") or data.get("next_key")

                # self.log(f"[ka10086] Items: {items}")
                
                results = []
                for item in items:
                    results.append({
                        "market_name": item.get("marketName", "-"), # 시장명
                        "date": item.get("stck_bsop_date") or item.get("date", "-"),
                        "open": f"{int(item.get('open_pric') or item.get('open', '0')):,}",
                        "high": f"{int(item.get('high_pric') or item.get('high', '0')):,}",
                        "low": f"{int(item.get('low_pric') or item.get('low', '0')):,}",
                        "close": f"{int(item.get('close_pric') or item.get('close', '0')):,}",
                        "volume": f"{int(item.get('trde_qty') or item.get('volume', '0')):,}",
                        "amount": f"{int(item.get('amt_mn') or item.get('amount', '0')):,}",
                        "rate": item.get("flu_rt") or item.get("rate", "0")
                    })
                
                return {"list": results, "next_key": next_key_val, "cont_yn": cont_yn_val}
            else:
                self.log(f"[ka10086] Failed: {response.text}")
                return None

        except Exception as e:
            self.log(f"[ka10086] Error: {e}")
            return None

    def get_daily_price_history(self, code, target_days=1095, latest_db_record=None):
        """
        Fetches daily price history for at least `target_days`.
        Handles pagination and rate limiting.
        Stops if data is older than target_days (approx. 1095 days).
        Stops if API data matches latest_db_record (optimization).
        """
        import time
        from datetime import datetime, timedelta
        
        self.log(f"call get_daily_price_history max ymd {latest_db_record.get('YMD', '') if latest_db_record else '없음'}")

        all_prices = []
        next_key = ""
        cont_yn = "N"
        
        # Calculate cutoff date (YYYYMMDD)
        cutoff_date = (datetime.now() - timedelta(days=target_days + 10)).strftime("%Y%m%d") # Add buffer
        today_str = datetime.now().strftime("%Y%m%d")
        
        # Initial call
        while True:
            # Rate limiting: 20 calls per second => 0.05s delay
            time.sleep(0.05)
            
            # Use today's date for the first call, or just pass it every time (API might ignore it on next-key calls)
            data = self.get_daily_price(code, next_key=next_key, qry_dt=today_str, cont_yn=cont_yn)
            if not data:
                break
                
            items = data.get("list", [])
            if not items:
                break
            
            # Check dates and optimization
            stop_fetching = False
            valid_items = []
            for item in items:
                item_date = item.get("date", "").replace("-", "").replace("/", "")

                # self.log(f"item_date {item_date}")
                
                # Optimization Check
                if latest_db_record and item_date == latest_db_record['YMD']:
                    # self.log(f"api date equal to db date")
                    # self.log(f"item {item}")
                    # Compare values (A vs B)
                    # API values are strings with commas, DB values are ints (or strings of ints)
                    try:
                        api_open = abs(int(item.get('open', '0').replace(',', '')))
                        api_high = abs(int(item.get('high', '0').replace(',', '')))
                        api_low = abs(int(item.get('low', '0').replace(',', '')))
                        api_close = abs(int(item.get('close', '0').replace(',', '')))
                        
                        db_open = int(latest_db_record['BGNG_PRC'])
                        db_high = int(latest_db_record['HGHST_PRC'])
                        db_low = int(latest_db_record['LOWST_PRC'])
                        db_close = int(latest_db_record['LAST_PRC'])

                        if (api_open == db_open and 
                            api_high == db_high and 
                            api_low == db_low and 
                            api_close == db_close):
                            # A == B, stop fetching
                            stop_fetching = True

                            self.log(f"이미 수집된 자료 ({code})")
                            # Do we include this matching record? 
                            # Usually yes, to ensure it's updated if there are minor diffs in other fields, 
                            # or no if we want to save write ops. 
                            # User said "stop ... and next stock", implying we are done.
                            # But let's include it just in case, or break immediately.
                            # If we break here, we don't process this item or subsequent items.
                            # Let's break immediately.
                            break 
                    except Exception as e:
                        self.log(f"Error comparing DB record: {e}")

                valid_items.append(item)
                
                if item_date and item_date < cutoff_date:
                    stop_fetching = True
            
            all_prices.extend(valid_items)
            
            if stop_fetching:
                break
                
            next_key = data.get("next_key")
            resp_cont_yn = data.get("cont_yn")
            
            # Continue only if cont_yn is "Y" and we have a next_key
            if resp_cont_yn == "Y" and next_key:
                cont_yn = "Y"
            else:
                break
                
            # Safety break to prevent infinite loops
            if len(all_prices) > target_days * 2: # Heuristic limit
                break
                
        return all_prices
