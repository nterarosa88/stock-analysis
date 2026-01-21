import cx_Oracle
import os
import sys
import platform

# Oracle DB Configuration
# Update these with your actual database credentials
DB_USER = os.getenv("DB_USER", "KIWOOM")
DB_PASSWORD = os.getenv("DB_PASSWORD", "cmscmj99")
DB_DSN = os.getenv("DB_DSN", "localhost:1521/FREE")

pool = None

def init_db():
    global pool
    if pool is not None:
        return

    try:
        # Try to initialize without arguments (relies on PATH)
        cx_Oracle.init_oracle_client()
    except Exception as e:
        print(f"Error initializing Oracle Client: {e}")

    try:
        pool = cx_Oracle.SessionPool(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            min=2,
            max=5,
            increment=1,
            encoding="UTF-8"
        )
        print("Oracle DB Connection Pool created successfully.")
    except Exception as e:
        print(f"Error creating Oracle DB Connection Pool: {e}")
        pool = None

def get_db():
    if pool is None:
        init_db()
    
    if pool is None:
        raise Exception("Database connection pool is not initialized. Check server logs for Oracle Client errors.")

    connection = pool.acquire()
    try:
        yield connection
    finally:
        pool.release(connection)
