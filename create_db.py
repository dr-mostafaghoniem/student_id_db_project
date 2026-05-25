# create_db.py
import sqlite3
import os

db_name = "students_cards.db"
schema_file = "schema.sql"

def init_db():
    print(f"Initializing database: {db_name}...")
    
    # الاتصال بقاعدة البيانات (سيتم إنشاؤها إن لم تكن موجودة)
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    
    # قراءة وتشغيل ملف المخطط الهيكلي
    if os.path.exists(schema_file):
        with open(schema_file, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # تنفيذ جمل SQL
        cursor.executescript(sql_script)
        conn.commit()
        print("Database schema applied successfully!")
    else:
        print(f"Error: {schema_file} not found!")
        
    conn.close()
    print("Database connection closed.")

if __name__ == "__main__":
    init_db()
