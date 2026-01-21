# Implementation Plan - Daily Stock Price Sync

## Goal Description
Implement a feature to synchronize daily stock price history (last 240 days) for all stocks registered in the `TTST01M` table. The data will be fetched from Kiwoom REST API (`ka10086`) and merged into the `TTST02L` Oracle table.

## User Review Required
- **Database Schema**: Assumes `TTST02L` table exists with columns: `CLS_CD`, `YMD`, `BGNG_PRC`, `HGHST_PRC`, `LOWST_PRC`, `LAST_PRC`, `DLNG_NOCS`, `DLNG_AMT`.
- **Performance**: Syncing daily prices for ALL stocks (thousands) sequentially might take a significant amount of time. The current plan implements a synchronous loop.
- **API Limits**: Kiwoom API rate limit is set to 4 calls/sec. We will add a 0.25s delay between calls.

## Proposed Changes

### Backend
#### [MODIFY] [kiwoom.py](file:///d:/rich_brother/biz/kiwoom/kiwoom.py)
- Update `get_daily_price` (or create `get_daily_price_history`) to:
    - Accept `code` and `target_date` (default today).
    - Loop using `next-key` until at least 240 records are fetched or data is exhausted.
    - Return the list of daily prices.
    - **Add `time.sleep(0.25)`** inside the loop or in the caller to respect the rate limit.

#### [MODIFY] [main.py](file:///d:/rich_brother/biz/kiwoom/backend/main.py)
- Add `POST /api/stock/daily-price/sync` endpoint.
- Logic:
    1. Fetch all `CLS_CD` from `TTST01M`.
    2. For each `CLS_CD`:
        a. Call `kiwoom.get_daily_price_history(code)`.
        b. Prepare data for `TTST02L`.
        c. Execute `MERGE INTO TTST02L ...`.
        d. **Sleep 0.25s** between stock calls.
    3. Commit periodically or at the end.

### Frontend
#### [MODIFY] [StockMain.tsx](file:///d:/rich_brother/biz/kiwoom/frontend/src/pages/StockMain.tsx)
- Add a new section or button "일별주가 수집" (Daily Price Collection).
- Add handler to call `/api/stock/daily-price/sync`.
- Display progress (e.g., "Processing 10/2000...").

## Verification Plan
### Manual Verification
1. **Frontend**: Click "일별주가 수집".
2. **Backend Logs**: Monitor logs for "Fetching daily price for..." and "Merged ... records".
3. **Database**: Query `TTST02L` to verify data exists for the processed stocks.
   ```sql
   SELECT * FROM TTST02L WHERE CLS_CD = 'some_code' ORDER BY YMD DESC;
   ```
