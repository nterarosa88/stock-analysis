import cx_Oracle
import os
import sys

# Oracle DB Configuration
DB_USER = os.getenv("DB_USER", "KIWOOM")
DB_PASSWORD = os.getenv("DB_PASSWORD", "cmscmj99")
DB_DSN = os.getenv("DB_DSN", "localhost:1521/FREE")

def init_db():
    print("Connecting to database...")
    try:
        connection = cx_Oracle.connect(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=DB_DSN,
            encoding="UTF-8"
        )
        cursor = connection.cursor()
        
        # 1. Drop Table if exists (optional, careful in prod)
        try:
            print("Dropping existing TTST03L table...")
            cursor.execute("DROP TABLE TTST03L")
        except cx_Oracle.DatabaseError as e:
            # ORA-00942: table or view does not exist
            if "ORA-00942" not in str(e):
                print(f"Error dropping table: {e}")

        # 2. Create Table
        print("Creating TTST03L table...")
        sql_create = """
            CREATE TABLE TTST03L (
                GROUP_NM    VARCHAR2(60)    NOT NULL,
                CLS_CD      VARCHAR2(60)    NOT NULL,
                BYNG_YMD    CHAR(8),
                BYNG_PRC    NUMBER(10, 0),
                REG_YMD     CHAR(8)         NOT NULL,
                CONSTRAINT PK_TTST03L PRIMARY KEY (GROUP_NM, CLS_CD)
            )
        """
        cursor.execute(sql_create)
        
        # 3. Add Comments
        print("Adding comments...")
        cursor.execute("COMMENT ON TABLE TTST03L IS '주식관심종목목록'")
        cursor.execute("COMMENT ON COLUMN TTST03L.GROUP_NM IS '그룹명'")
        cursor.execute("COMMENT ON COLUMN TTST03L.CLS_CD IS '종목코드'")
        cursor.execute("COMMENT ON COLUMN TTST03L.BYNG_YMD IS '매수일자'")
        cursor.execute("COMMENT ON COLUMN TTST03L.BYNG_PRC IS '매수가격'")
        cursor.execute("COMMENT ON COLUMN TTST03L.REG_YMD IS '등록일자'")

        connection.commit()
        print("Database initialization for TTST03L completed successfully.")

    except Exception as e:
        print(f"Error: {e}")
        if 'connection' in locals():
            connection.rollback()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    init_db()
