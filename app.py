# app.py
from flask import Flask, jsonify, request, render_template, send_from_directory
import sqlite3
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
DB_NAME = "students_cards.db"
SCHEMA_FILE = "schema.sql"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    # إنشاء قاعدة البيانات إن لم تكن موجودة وتطبيق المخطط الهيكلي
    conn = sqlite3.connect(DB_NAME)
    if os.path.exists(SCHEMA_FILE):
        with open(SCHEMA_FILE, 'r', encoding='utf-8') as f:
            # استخدام Executescript الذي يتجاهل الأخطاء إذا كانت الجداول منشأة مسبقاً
            try:
                conn.executescript(f.read())
                conn.commit()
            except Exception as e:
                print(f"Schema script applied with notice: {e}")
                
    # ترحيل تلقائي: التحقق من وجود أعمدة صور الهوية المحدثة وإضافتها إن لم تكن موجودة
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(students)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'photo_1' not in columns:
            print("Database Migration: Adding photo_1 column to students table...")
            conn.execute("ALTER TABLE students ADD COLUMN photo_1 TEXT;")
            conn.commit()
            
        if 'photo_2' not in columns:
            print("Database Migration: Adding photo_2 column to students table...")
            conn.execute("ALTER TABLE students ADD COLUMN photo_2 TEXT;")
            conn.commit()
    except Exception as e:
        print(f"Migration error: {e}")
        
    conn.close()

# صفحة الواجهة الرئيسية
@app.route('/')
def index():
    return render_template('index.html')

# جلب قائمة الطلاب مع حالة الطباعة لكل طالب
@app.route('/api/students', methods=['GET'])
def get_students():
    conn = get_db_connection()
    # جلب الطلاب وجلب تفاصيل الطباعة الخاصة بكل طالب
    students_query = """
        SELECT s.*, 
               (SELECT print_date FROM id_prints WHERE student_id = s.id AND print_number = 1) as print1_date,
               (SELECT print_date FROM id_prints WHERE student_id = s.id AND print_number = 2) as print2_date
        FROM students s
        ORDER BY s.id DESC
    """
    students = conn.execute(students_query).fetchall()
    
    # جلب سجل العمليات بالكامل
    logs_query = """
        SELECT p.*, s.student_name, s.academic_id 
        FROM id_prints p
        JOIN students s ON p.student_id = s.id
        ORDER BY p.print_date DESC
    """
    logs = conn.execute(logs_query).fetchall()
    conn.close()
    
    students_list = []
    for s in students:
        students_list.append({
            'id': s['id'],
            'student_name': s['student_name'],
            'academic_id': s['academic_id'],
            'department': s['department'] or 'غير محدد',
            'photo_1': s['photo_1'] or '',
            'photo_2': s['photo_2'] or '',
            'created_at': s['created_at'],
            'print1': s['print1_date'],
            'print2': s['print2_date']
        })
        
    logs_list = []
    for l in logs:
        logs_list.append({
            'id': l['id'],
            'student_id': l['student_id'],
            'student_name': l['student_name'],
            'academic_id': l['academic_id'],
            'print_number': l['print_number'],
            'print_date': l['print_date'],
            'notes': l['notes'] or ''
        })
        
    return jsonify({
        'students': students_list,
        'logs': logs_list
    })

# إضافة طالب جديد
@app.route('/api/students', methods=['POST'])
def add_student():
    data = request.json
    name = data.get('student_name', '').strip()
    academic_id = data.get('academic_id', '').strip()
    department = data.get('department', '').strip()
    photo_1 = data.get('photo_1', '')
    photo_2 = data.get('photo_2', '')
    
    if not name or not academic_id:
        return jsonify({'error': 'اسم الطالب والرقم الأكاديمي مطلوبان!'}), 400
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO students (student_name, academic_id, department, photo_1, photo_2) VALUES (?, ?, ?, ?, ?)",
            (name, academic_id, department if department else None, photo_1 if photo_1 else None, photo_2 if photo_2 else None)
        )
        conn.commit()
        student_id = cursor.lastrowid
        conn.close()
        return jsonify({'message': 'تم إضافة الطالب بنجاح!', 'id': student_id}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'الرقم الأكاديمي مسجل بالفعل لطالب آخر!'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

# تسجيل عملية طباعة بطاقة هوية
@app.route('/api/prints', methods=['POST'])
def add_print():
    data = request.json
    student_id = data.get('student_id')
    print_number = data.get('print_number')
    notes = data.get('notes', '').strip()
    
    if not student_id or not print_number:
        return jsonify({'error': 'بيانات غير مكتملة!'}), 400
        
    if int(print_number) not in [1, 2]:
        return jsonify({'error': 'رقم الطباعة يجب أن يكون 1 أو 2 فقط!'}), 400
        
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO id_prints (student_id, print_number, notes) VALUES (?, ?, ?)",
            (student_id, print_number, notes if notes else None)
        )
        conn.commit()
        conn.close()
        return jsonify({'message': f'تم تسجيل طباعة البطاقة رقم {print_number} بنجاح!'}), 201
    except sqlite3.IntegrityError as e:
        conn.close()
        # فحص نوع الخطأ لمعرفة ما إذا كان بسبب تجاوز العدد المسموح به
        err_msg = str(e)
        if "UNIQUE constraint failed" in err_msg:
            return jsonify({'error': f'تم طباعة البطاقة رقم {print_number} مسبقاً لهذا الطالب! لا يمكن التكرار.'}), 400
        elif "CHECK constraint failed" in err_msg:
            return jsonify({'error': 'خطأ في التحقق: رقم الطباعة غير مسموح به (يجب أن يكون 1 أو 2 فقط).'}), 400
        else:
            return jsonify({'error': f'فشلت العملية بسبب قيود قاعدة البيانات: {err_msg}'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'error': f'حدث خطأ غير متوقع: {str(e)}'}), 500

# حذف طالب
@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        conn.close()
        if cursor.rowcount == 0:
            return jsonify({'error': 'الطالب غير موجود!'}), 404
        return jsonify({'message': 'تم حذف الطالب وسجل طباعته بنجاح!'})
    except Exception as e:
        conn.close()
        return jsonify({'error': f'حدث خطأ أثناء الحذف: {str(e)}'}), 500

if __name__ == '__main__':
    init_db()
    print("Starting Flask local server on http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=True)
