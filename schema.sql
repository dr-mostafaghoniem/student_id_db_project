-- schema.sql
-- مخطط قاعدة بيانات طباعة بطاقات هوية الطلاب (SQLite)

-- تفعيل القيود الخاصة بالمفاتيح الخارجية
PRAGMA foreign_keys = ON;

-- 1. جدول الطلاب
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    academic_id TEXT UNIQUE NOT NULL, -- الرقم الأكاديمي أو الهوية الوطنية
    department TEXT,                  -- القسم أو التخصص الأكاديمي
    photo_1 TEXT,                     -- صورة الهوية الأولى (Base64)
    photo_2 TEXT,                     -- صورة الهوية الثانية (Base64)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول عمليات الطباعة
CREATE TABLE IF NOT EXISTS id_prints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    print_number INTEGER NOT NULL,    -- رقم الطباعة (يجب أن يكون 1 أو 2 فقط)
    print_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,                       -- ملاحظات اختيارية (مثل: أول طباعة، بدل تالف، إلخ)
    
    -- قيد المفتاح الخارجي مع الحذف التلقائي عند حذف الطالب
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    
    -- قيد يضمن عدم إدخال رقم طباعة غير 1 أو 2
    CONSTRAINT chk_print_number CHECK (print_number IN (1, 2)),
    
    -- قيد يضمن عدم طباعة نفس رقم البطاقة لنفس الطالب مرتين
    CONSTRAINT uq_student_print UNIQUE (student_id, print_number)
);

-- إضافة بعض البيانات التجريبية للبدء الفوري
INSERT OR IGNORE INTO students (student_name, academic_id, department) VALUES 
('أحمد محمد علي', '20231001', 'علوم الحاسب'),
('سارة عبد الرحمن', '20231002', 'هندسة البرمجيات'),
('خالد وليد عمر', '20231003', 'نظم المعلومات');

-- طباعة البطاقة الأولى لأحمد وسارة
INSERT OR IGNORE INTO id_prints (student_id, print_number, notes) VALUES 
(1, 1, 'الطباعة الأولى - بداية العام الدراسي'),
(2, 1, 'الطباعة الأولى - بداية العام الدراسي');

-- طباعة البطاقة الثانية لأحمد (مثلاً بدل فاقد)
INSERT OR IGNORE INTO id_prints (student_id, print_number, notes) VALUES 
(1, 2, 'الطباعة الثانية - بدل فاقد للهوية الأولى');
