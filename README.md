# Rich Brother (Kiwoom Stock Analysis Platform)

Rich Brother is a comprehensive stock analysis and management platform designed to integrate seamlessly with the Kiwoom Securities Open API. It provides tools for synchronizing stock data, analyzing daily prices, and managing stock information using a robust backend and a modern frontend interface.

## 📂 Directory Structure

The project is organized into the following main components:

- **`backend/`**: The backend server built with FastAPI.
    - `main.py`: The core API application handling requests for stock lists, prices, and database synchronization.
    - `database.py`: Manages connections to the Oracle database.
    - `requirements.txt`: Lists all Python dependencies required for the backend.
- **`frontend/`**: The frontend application built with React and Vite.
    - `src/`: Contains the React source code, components, and logic.
    - `package.json`: Defines Node.js dependencies and scripts.
    - `vite.config.ts`: Configuration for the Vite build tool.
- **`kiwoom.py`**: A dedicated Python module containing the `KiwoomREST` class, which handles authentication and data retrieval from the Kiwoom Open API (REST).
- **`main.py`** (Root): A standalone or utility FastAPI application (separate from the main backend) that uses Jinja2 templates for a server-side rendered interface.
- **`templates/`**: HTML templates used by the root `main.py` application.
- **`doc/`**: Project documentation files.

## 🚀 Key Features

- **Kiwoom API Integration**: 
    - Secure authentication with Kiwoom Open API.
    - Data fetching for stock information (ka10001), stock lists (ka10099), and daily prices (ka10086).
- **Data Synchronization**:
    - **Stock List Sync**: Updates the `TTST01M` table with the latest stock market data (KOSPI, KOSDAQ, ETF).
    - **Daily Price Sync**: Fetches and stores up to 3 years of daily price history in the `TTST02L` table, with optimization to skip already synchronized data.
- **Stock Search & Analysis**:
    - Advanced search capabilities by stock code, name, market capitalization, and market type.
    - Detailed view of daily stock prices with open, high, low, and close values.
- **Modern UI**: A responsive and interactive user interface built with React and TailwindCSS.

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.8+
- Node.js & npm
- Oracle Database (configured with tables `TTST01M` and `TTST02L`)

### Backend Setup
1. Navigate to the project root.
2. Install the required Python packages:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Configure your Oracle Database credentials in `backend/database.py` (or ensure environment variables are set).
4. Start the backend server:
   ```bash
   uvicorn backend.main:app --reload
   ```
5. 가상환경 만들기 및 문제시
   ```bash
   python -m venv venv

   .\venv\Scripts\Activate.ps1 # 실행시 오류가 나면 아래 실행
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

   pip install -r backend/requirements.txt
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📖 Usage

1. **Start both the backend and frontend servers.**
2. **Access the Application**: Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite).
3. **Sync Data**: Use the synchronization features to populate your database with the latest stock info and price history.
4. **Search & Analyze**: Use the search filters to find stocks and view their historical price trends.

## 📝 Database Schema (Brief)

- **TTST01M**: Master table for stock information (Code, Name, Market Cap, Sector, etc.).
- **TTST02L**: Transactional table for daily stock prices (Date, Open, High, Low, Close, Volume).

---
*Note: This project requires valid Kiwoom Open API credentials (App Key, Secret Key) to function correctly.*
