import cx_Oracle
import os
import platform

print(f"Python Architecture: {platform.architecture()[0]}")

try:
    cx_Oracle.init_oracle_client()
    print("Oracle Client initialized successfully.")
except Exception as e:
    print(f"Error initializing Oracle Client: {e}")

dsn = os.getenv("DB_DSN", "localhost:1521/FREE")
user = os.getenv("DB_USER", "KIWOOM")
password = os.getenv("DB_PASSWORD", "cmscmj99")

try:
    connection = cx_Oracle.connect(user=user, password=password, dsn=dsn)
    print("Successfully connected to Oracle DB.")
    connection.close()
except Exception as e:
    print(f"Error connecting to Oracle DB: {e}")
