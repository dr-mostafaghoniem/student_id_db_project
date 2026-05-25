/* static/app.js */

// ==========================================================================
// 1. إدارة الحالة العامة للتطبيق (State & Configuration)
// ==========================================================================
const config = {
    apiUrl: '', // المسار الحالي نسبي
    offlineMode: false // سيتحدد تلقائياً عند فحص الاتصال بالخادم
};

let appState = {
    students: [],
    logs: [],
    currentModalData: {
        studentId: null,
        printNumber: null,
        studentName: ''
    }
};

// ==========================================================================
// 2. إدارة الإشعارات المنبثقة (Toast Notification System)
// ==========================================================================
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'info') icon = 'fa-circle-info';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    // زر الإغلاق السريع
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.animation = 'toast-in 0.2s reverse ease-out forwards';
        setTimeout(() => toast.remove(), 200);
    });

    container.appendChild(toast);

    // الحذف التلقائي بعد انتهاء المدة
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toast-in 0.25s reverse ease-out forwards';
            setTimeout(() => toast.remove(), 250);
        }
    }, duration);
}

// ==========================================================================
// 3. فحص بيئة التشغيل والاتصال بالخادم (Connectivity & Environment)
// ==========================================================================
async function checkBackendConnection() {
    const statusBadge = document.getElementById('connection-status');
    
    // إذا تم تشغيل الملف كـ file:// مباشرة، سنفترض النمط المحلي فوراً لتوفير الوقت
    if (window.location.protocol === 'file:') {
        activateOfflineMode("نمط المتصفح المحلي (مستقل 100%)");
        return;
    }

    try {
        // فحص المسار النسبي لكي يعمل على GitHub Pages وتحت المجلدات الفرعية
        const response = await fetch('api/students', { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (response.ok) {
            // الخادم يعمل بنجاح
            statusBadge.className = 'status-badge status-online';
            statusBadge.innerHTML = '<i class="fa-solid fa-cloud"></i> متصل بقاعدة البيانات SQLite المباشرة';
            config.offlineMode = false;
            document.getElementById('offline-backup-card').style.display = 'none';
            await loadData();
        } else {
            throw new Error('Server returned error status');
        }
    } catch (error) {
        activateOfflineMode("نمط المتصفح المحلي (الخادم غير نشط)");
    }
}

function activateOfflineMode(reasonText) {
    const statusBadge = document.getElementById('connection-status');
    statusBadge.className = 'status-badge status-offline';
    statusBadge.innerHTML = `<i class="fa-solid fa-hdd"></i> ${reasonText}`;
    config.offlineMode = true;
    
    // إظهار بطاقة التصدير والاستيراد
    document.getElementById('offline-backup-card').style.display = 'block';
    
    showToast("تم تفعيل نمط المتصفح المحلي (LocalStorage) لضمان العمل بدون خادم وحفظ البيانات تلقائياً.", "info");
    
    // تهيئة البيانات المحلية الافتراضية إن لم تكن موجودة
    initLocalStorageDB();
    loadDataOffline();
}

// ==========================================================================
// 4. محاكاة قاعدة بيانات SQLite في المتصفح (LocalStorage SQLite Simulation)
// ==========================================================================
const LS_KEYS = {
    STUDENTS: 'student_db_students',
    PRINTS: 'student_db_prints'
};

function initLocalStorageDB() {
    if (!localStorage.getItem(LS_KEYS.STUDENTS)) {
        // إضافة طلاب تجريبيين مثل ملف SQL
        const defaultStudents = [
            { id: 1, student_name: 'أحمد محمد علي', academic_id: '20231001', department: 'علوم الحاسب', photo_1: '', photo_2: '', created_at: new Date().toISOString() },
            { id: 2, student_name: 'سارة عبد الرحمن', academic_id: '20231002', department: 'هندسة البرمجيات', photo_1: '', photo_2: '', created_at: new Date().toISOString() },
            { id: 3, student_name: 'خالد وليد عمر', academic_id: '20231003', department: 'نظم المعلومات', photo_1: '', photo_2: '', created_at: new Date().toISOString() }
        ];
        localStorage.setItem(LS_KEYS.STUDENTS, JSON.stringify(defaultStudents));
    }
    
    if (!localStorage.getItem(LS_KEYS.PRINTS)) {
        // إضافة طباعة تجريبية مثل ملف SQL
        const defaultPrints = [
            { id: 1, student_id: 1, print_number: 1, print_date: new Date().toISOString(), notes: 'الطباعة الأولى - بداية العام الدراسي' },
            { id: 2, student_id: 2, print_number: 1, print_date: new Date().toISOString(), notes: 'الطباعة الأولى - بداية العام الدراسي' },
            { id: 3, student_id: 1, print_number: 2, print_date: new Date().toISOString(), notes: 'الطباعة الثانية - بدل فاقد للهوية الأولى' }
        ];
        localStorage.setItem(LS_KEYS.PRINTS, JSON.stringify(defaultPrints));
    }
}

function loadDataOffline() {
    const students = JSON.parse(localStorage.getItem(LS_KEYS.STUDENTS) || '[]');
    const prints = JSON.parse(localStorage.getItem(LS_KEYS.PRINTS) || '[]');
    
    // بناء الهيكل المتكامل ليتناسب مع ما يرجعه خادم Flask
    const studentsWithPrints = students.map(s => {
        const p1 = prints.find(p => p.student_id === s.id && p.print_number === 1);
        const p2 = prints.find(p => p.student_id === s.id && p.print_number === 2);
        return {
            ...s,
            print1: p1 ? p1.print_date : null,
            print2: p2 ? p2.print_date : null
        };
    }).sort((a,b) => b.id - a.id);
    
    // بناء السجل المدمج للطباعة الأخيرة
    const logs = prints.map(p => {
        const student = students.find(s => s.id === p.student_id);
        return {
            ...p,
            student_name: student ? student.student_name : 'طالب محذوف',
            academic_id: student ? student.academic_id : '---'
        };
    }).sort((a,b) => new Date(b.print_date) - new Date(a.print_date));
    
    appState.students = studentsWithPrints;
    appState.logs = logs;
    
    renderDashboard();
}

// محاكاة استدعاءات الـ API محلياً
function addStudentOffline(name, academicId, department, photo1, photo2) {
    const students = JSON.parse(localStorage.getItem(LS_KEYS.STUDENTS) || '[]');
    
    // التحقق من القيد UNIQUE للأكاديمي
    const exists = students.find(s => s.academic_id === academicId);
    if (exists) {
        return { success: false, error: 'الرقم الأكاديمي مسجل بالفعل لطالب آخر!' };
    }
    
    const newStudent = {
        id: students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1,
        student_name: name,
        academic_id: academicId,
        department: department || 'غير محدد',
        photo_1: photo1 || '',
        photo_2: photo2 || '',
        created_at: new Date().toISOString()
    };
    
    students.push(newStudent);
    localStorage.setItem(LS_KEYS.STUDENTS, JSON.stringify(students));
    return { success: true, id: newStudent.id };
}

function addPrintOffline(studentId, printNumber, notes) {
    const prints = JSON.parse(localStorage.getItem(LS_KEYS.PRINTS) || '[]');
    
    // التحقق من قيد CHECK
    if (![1, 2].includes(printNumber)) {
        return { success: false, error: 'رقم الطباعة يجب أن يكون 1 أو 2 فقط!' };
    }
    
    // التحقق من قيد UNIQUE الثنائي
    const exists = prints.find(p => p.student_id === studentId && p.print_number === printNumber);
    if (exists) {
        return { success: false, error: `تم طباعة البطاقة رقم ${printNumber} مسبقاً لهذا الطالب! لا يمكن التكرار.` };
    }
    
    const newPrint = {
        id: prints.length > 0 ? Math.max(...prints.map(p => p.id)) + 1 : 1,
        student_id: studentId,
        print_number: printNumber,
        print_date: new Date().toISOString(),
        notes: notes || ''
    };
    
    prints.push(newPrint);
    localStorage.setItem(LS_KEYS.PRINTS, JSON.stringify(prints));
    return { success: true };
}

function deleteStudentOffline(studentId) {
    let students = JSON.parse(localStorage.getItem(LS_KEYS.STUDENTS) || '[]');
    let prints = JSON.parse(localStorage.getItem(LS_KEYS.PRINTS) || '[]');
    
    const beforeCount = students.length;
    students = students.filter(s => s.id !== studentId);
    
    if (students.length === beforeCount) {
        return { success: false, error: 'الطالب غير موجود!' };
    }
    
    // محاكاة ON DELETE CASCADE
    prints = prints.filter(p => p.student_id !== studentId);
    
    localStorage.setItem(LS_KEYS.STUDENTS, JSON.stringify(students));
    localStorage.setItem(LS_KEYS.PRINTS, JSON.stringify(prints));
    return { success: true };
}

// ==========================================================================
// 5. استدعاءات البيانات الفعلية من الخادم (Server API Interactions)
// ==========================================================================
async function loadData() {
    if (config.offlineMode) {
        loadDataOffline();
        return;
    }
    
    try {
        const response = await fetch('api/students');
        if (!response.ok) throw new Error('API communication failed');
        const data = await response.json();
        
        appState.students = data.students;
        appState.logs = data.logs;
        
        renderDashboard();
    } catch (error) {
        console.error(error);
        showToast("خطأ أثناء جلب البيانات من قاعدة البيانات المباشرة.", "error");
    }
}

// ==========================================================================
// 6. منطق بناء لوحة التحكم وعرض البيانات (Rendering & Display Logic)
// ==========================================================================
function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderDashboard() {
    renderStats();
    renderStudentsTable();
    renderLogsTimeline();
}

function renderStats() {
    const totalStudents = appState.students.length;
    let totalPrints = 0;
    let fullyPrinted = 0;
    let partiallyPrinted = 0;
    
    appState.students.forEach(s => {
        let count = 0;
        if (s.print1) count++;
        if (s.print2) count++;
        
        totalPrints += count;
        if (count === 2) fullyPrinted++;
        if (count === 1) partiallyPrinted++;
    });
    
    document.getElementById('stat-total-students').textContent = totalStudents;
    document.getElementById('stat-total-prints').textContent = totalPrints;
    document.getElementById('stat-fully-printed').textContent = fullyPrinted;
    document.getElementById('stat-partially-printed').textContent = partiallyPrinted;
    document.getElementById('student-count-badge').textContent = `${totalStudents} طالب`;
}

function renderStudentsTable(filterText = '') {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const filtered = appState.students.filter(s => {
        const term = filterText.toLowerCase().trim();
        if (!term) return true;
        return s.student_name.toLowerCase().includes(term) || 
               s.academic_id.toLowerCase().includes(term) || 
               s.department.toLowerCase().includes(term);
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 30px; color: var(--text-dark);">
                    لا توجد سجلات مطابقة لعملية البحث.
                </td>
            </tr>
        `;
        return;
    }
    
    filtered.forEach(s => {
        const tr = document.createElement('tr');
        
        // زر الطباعة للهوية الأولى أو المعاينة
        let p1Content = '';
        if (s.print1) {
            p1Content = `
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <div class="date-badge">
                        <i class="fa-solid fa-circle-check" style="color: var(--success)"></i>
                        <span>${formatDate(s.print1)}</span>
                    </div>
                    <button type="button" class="btn btn-outline" onclick="openCardPreviewModal(${s.id}, 1)" style="padding: 4px 8px; min-width: unset;" title="معاينة الهوية الأولى">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                </div>
            `;
        } else {
            p1Content = `
                <button type="button" class="btn btn-success btn-print-action" onclick="openPrintModal(${s.id}, 1, '${s.student_name.replace(/'/g, "\\'")}', '${s.academic_id}')">
                    <i class="fa-solid fa-print"></i> طباعة كارت 1
                </button>
            `;
        }
        
        // زر الطباعة للهوية الثانية أو المعاينة
        let p2Content = '';
        if (s.print2) {
            p2Content = `
                <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <div class="date-badge">
                        <i class="fa-solid fa-circle-check" style="color: var(--warning)"></i>
                        <span>${formatDate(s.print2)}</span>
                    </div>
                    <button type="button" class="btn btn-outline" onclick="openCardPreviewModal(${s.id}, 2)" style="padding: 4px 8px; min-width: unset;" title="معاينة الهوية الثانية">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                </div>
            `;
        } else if (s.print1) {
            p2Content = `
                <button type="button" class="btn btn-warning btn-print-action" onclick="openPrintModal(${s.id}, 2, '${s.student_name.replace(/'/g, "\\'")}', '${s.academic_id}')">
                    <i class="fa-solid fa-print"></i> طباعة كارت 2
                </button>
            `;
        } else {
            p2Content = `
                <button type="button" class="btn btn-disabled btn-print-action" disabled>
                    <i class="fa-solid fa-lock"></i> اطبع 1 أولاً
                </button>
            `;
        }
        
        // حالة الحذف أو التنبيه بالحد الأقصى
        let actionsContent = '';
        if (s.print1 && s.print2) {
            actionsContent = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <span class="badge" style="background: rgba(239,68,68,0.1); color: var(--danger); border-color: rgba(239,68,68,0.2);">
                        تم استنفاد الحد
                    </span>
                    <button class="btn-delete" title="حذف الطالب بالكامل" onclick="deleteStudent(${s.id})">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
        } else {
            actionsContent = `
                <div style="display: flex; align-items: center; justify-content: center;">
                    <button class="btn-delete" title="حذف الطالب بالكامل" onclick="deleteStudent(${s.id})">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
        }
        
        // الصور المصغرة الفاخرة بجوار الاسم
        let avatarsHtml = '';
        if (s.photo_1 || s.photo_2) {
            avatarsHtml += '<div class="student-avatars-container">';
            if (s.photo_1) {
                avatarsHtml += `
                    <div class="student-avatar-thumb" onclick="openCardPreviewModal(${s.id}, 1)" title="معاينة ونسخ صورة الهوية 1">
                        <img src="${s.photo_1}" alt="ID 1">
                    </div>
                `;
            } else {
                avatarsHtml += `
                    <div class="student-avatar-thumb" title="لم يتم طباعة الهوية 1 بعد">
                        <i class="fa-solid fa-image" style="font-size: 0.75rem; opacity: 0.25;"></i>
                    </div>
                `;
            }
            if (s.photo_2) {
                avatarsHtml += `
                    <div class="student-avatar-thumb" onclick="openCardPreviewModal(${s.id}, 2)" title="معاينة ونسخ صورة الهوية 2">
                        <img src="${s.photo_2}" alt="ID 2">
                    </div>
                `;
            } else {
                avatarsHtml += `
                    <div class="student-avatar-thumb" title="لم يتم طباعة الهوية 2 بعد">
                        <i class="fa-solid fa-image" style="font-size: 0.75rem; opacity: 0.25;"></i>
                    </div>
                `;
            }
            avatarsHtml += '</div>';
        } else {
            avatarsHtml = `
                <div class="student-avatars-container">
                    <div class="student-avatar-thumb" title="لا توجد صور هوية مرفوعة">
                        <i class="fa-solid fa-user-slash" style="font-size: 0.75rem; opacity: 0.35;"></i>
                    </div>
                </div>
            `;
        }
        
        tr.innerHTML = `
            <td>
                <div class="student-name-cell">
                    ${avatarsHtml}
                    <div class="student-info-text">
                        <strong>${s.student_name}</strong>
                    </div>
                </div>
            </td>
            <td><code>${s.academic_id}</code></td>
            <td><span class="badge" style="background: rgba(255,255,255,0.03); color: var(--text-muted);">${s.department}</span></td>
            <td class="text-center">${p1Content}</td>
            <td class="text-center">${p2Content}</td>
            <td class="text-center">${actionsContent}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

function renderLogsTimeline() {
    const container = document.getElementById('logs-timeline-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (appState.logs.length === 0) {
        container.innerHTML = '<div class="timeline-empty">لا توجد عمليات طباعة مسجلة بعد.</div>';
        return;
    }
    
    appState.logs.forEach(l => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        const isFirst = l.print_number === 1;
        const iconClass = isFirst ? 'icon-print1' : 'icon-print2';
        const printBadgeColor = isFirst ? 'var(--success)' : 'var(--warning)';
        
        item.innerHTML = `
            <div class="timeline-icon ${iconClass}">
                <i class="fa-solid fa-id-card"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-title">${l.student_name}</span>
                    <span class="timeline-time">${formatDate(l.print_date)}</span>
                </div>
                <div class="timeline-desc">
                    تم طباعة بطاقة الهوية <strong style="color: ${printBadgeColor}">رقم ${l.print_number}</strong> الأكاديمية (رقم: <code>${l.academic_id}</code>).
                </div>
                ${l.notes ? `<div class="timeline-note"><i class="fa-solid fa-comment-dots" style="margin-left: 6px;"></i>${l.notes}</div>` : ''}
            </div>
        `;
        
        container.appendChild(item);
    });
}

// ==========================================================================
// 7. إدارة النوافذ والأحداث والتفاعل (Modals, Forms & Actions)
// ==========================================================================
function openPrintModal(studentId, printNumber, studentName, academicId) {
    appState.currentModalData = { studentId, printNumber, studentName };
    
    document.getElementById('modal-student-name').textContent = studentName;
    document.getElementById('modal-academic-id').textContent = academicId;
    
    const badge = document.getElementById('modal-print-number-badge');
    badge.textContent = `البطاقة رقم ${printNumber}`;
    badge.style.backgroundColor = printNumber === 1 ? 'var(--success)' : 'var(--warning)';
    
    document.getElementById('print-notes').value = '';
    document.getElementById('print-modal').classList.add('active');
}

function closePrintModal() {
    document.getElementById('print-modal').classList.remove('active');
}

// معاينة بطاقة الطالب
function openCardPreviewModal(studentId, printNumber) {
    const student = appState.students.find(s => s.id === studentId);
    if (!student) return;
    
    document.getElementById('preview-student-name').textContent = student.student_name;
    document.getElementById('preview-academic-id').textContent = student.academic_id;
    document.getElementById('preview-department').textContent = student.department || 'غير محدد';
    document.getElementById('preview-card-num').textContent = printNumber;
    
    const photoContainer = document.getElementById('preview-photo-container');
    const photoBase64 = printNumber === 1 ? student.photo_1 : student.photo_2;
    
    // حفظ بيانات الصورة الحالية للمعالجة
    appState.currentActivePhoto = photoBase64;
    appState.currentActiveStudentName = student.student_name;
    appState.currentActiveCardNum = printNumber;
    
    if (photoBase64) {
        photoContainer.innerHTML = `<img src="${photoBase64}" alt="صورة الطالب" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        photoContainer.innerHTML = `<i class="fa-solid fa-user-tie" style="font-size: 3.5rem; color: rgba(255,255,255,0.15);"></i>`;
    }
    
    document.getElementById('card-preview-modal').classList.add('active');
}

function closeCardPreviewModal() {
    document.getElementById('card-preview-modal').classList.remove('active');
}

// تنفيذ وحفظ عملية الطباعة
async function confirmPrint() {
    const { studentId, printNumber, studentName } = appState.currentModalData;
    const notes = document.getElementById('print-notes').value;
    
    if (config.offlineMode) {
        const result = addPrintOffline(studentId, printNumber, notes);
        if (result.success) {
            showToast(`تم تسجيل طباعة بطاقة الهوية رقم ${printNumber} بنجاح لطالب: ${studentName}`, 'success');
            closePrintModal();
            loadDataOffline();
        } else {
            showToast(result.error, 'error');
        }
        return;
    }
    
    try {
        const response = await fetch('api/prints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                print_number: printNumber,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message || 'تم تسجيل عملية الطباعة بنجاح!', 'success');
            closePrintModal();
            await loadData();
        } else {
            showToast(data.error || 'فشلت عملية الحفظ لقاعدة البيانات المباشرة.', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('حدث خطأ في الشبكة أثناء إرسال عملية الطباعة.', 'error');
    }
}

// حذف طالب بالكامل
async function deleteStudent(studentId) {
    if (!confirm('تحذير! هل أنت متأكد تماماً من حذف هذا الطالب وسجلات الطباعة الخاصة به بالكامل من قاعدة البيانات؟')) {
        return;
    }
    
    if (config.offlineMode) {
        const result = deleteStudentOffline(studentId);
        if (result.success) {
            showToast('تم حذف الطالب وسجل طباعته بنجاح من قاعدة البيانات المحلية.', 'success');
            loadDataOffline();
        } else {
            showToast(result.error, 'error');
        }
        return;
    }
    
    try {
        const response = await fetch(`api/students/${studentId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message || 'تم حذف الطالب بنجاح.', 'success');
            await loadData();
        } else {
            showToast(data.error || 'فشلت عملية الحذف.', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('حدث خطأ في الاتصال بالشبكة.', 'error');
    }
}

// دالة مساعدة لقراءة الصورة كـ Base64
function getBase64(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

// تسجيل طالب جديد
document.getElementById('add-student-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const nameInput = document.getElementById('student-name');
    const idInput = document.getElementById('academic-id');
    const deptInput = document.getElementById('department');
    const photo1Input = document.getElementById('student-photo-1');
    const photo2Input = document.getElementById('student-photo-2');
    
    const name = nameInput.value.trim();
    const academicId = idInput.value.trim();
    const department = deptInput.value.trim();
    
    if (!name || !academicId) {
        showToast('الرجاء إدخال الحقول المطلوبة بالكامل!', 'error');
        return;
    }
    
    // قراءة صور الطالب كـ Base64
    showToast("جاري معالجة صور الطالب...", "info", 1500);
    const photo1 = photo1Input.files[0] ? await getBase64(photo1Input.files[0]) : '';
    const photo2 = photo2Input.files[0] ? await getBase64(photo2Input.files[0]) : '';
    
    if (config.offlineMode) {
        const result = addStudentOffline(name, academicId, department, photo1, photo2);
        if (result.success) {
            showToast(`تم تسجيل الطالب: ${name} بنجاح في قاعدة البيانات المحلية!`, 'success');
            nameInput.value = '';
            idInput.value = '';
            deptInput.value = '';
            photo1Input.value = '';
            photo2Input.value = '';
            loadDataOffline();
        } else {
            showToast(result.error, 'error');
        }
        return;
    }
    
    try {
        const response = await fetch('api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_name: name,
                academic_id: academicId,
                department: department,
                photo_1: photo1,
                photo_2: photo2
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message || 'تم تسجيل الطالب بنجاح في السيرفر المباشر!', 'success');
            nameInput.value = '';
            idInput.value = '';
            deptInput.value = '';
            photo1Input.value = '';
            photo2Input.value = '';
            await loadData();
        } else {
            showToast(data.error || 'فشلت عملية إضافة الطالب.', 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('تعذر حفظ بيانات الطالب بسبب مشكلة بالشبكة.', 'error');
    }
});

// تفعيل البحث المباشر
document.getElementById('search-input').addEventListener('input', function(e) {
    renderStudentsTable(e.target.value);
});

// تأكيد الطباعة من النافذة المنبثقة
document.getElementById('btn-confirm-print').addEventListener('click', confirmPrint);

// ==========================================================================
// 8. تصدير واستيراد البيانات (Export & Import for Offline/Portability)
// ==========================================================================
document.getElementById('btn-export-db')?.addEventListener('click', () => {
    const dbData = {
        students: JSON.parse(localStorage.getItem(LS_KEYS.STUDENTS) || '[]'),
        prints: JSON.parse(localStorage.getItem(LS_KEYS.PRINTS) || '[]'),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_cards_db_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("تم تصدير نسخة احتياطية من قاعدة البيانات بنجاح!", "success");
});

document.getElementById('import-db-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const importedData = JSON.parse(evt.target.result);
            if (!importedData.students || !importedData.prints) {
                throw new Error("تنسيق الملف غير صحيح!");
            }
            
            localStorage.setItem(LS_KEYS.STUDENTS, JSON.stringify(importedData.students));
            localStorage.setItem(LS_KEYS.PRINTS, JSON.stringify(importedData.prints));
            
            showToast("تم استيراد قاعدة البيانات وتحديثها بنجاح!", "success");
            loadDataOffline();
            e.target.value = ''; // تصفير زر الرفع
        } catch (err) {
            showToast(`فشل استيراد قاعدة البيانات: ${err.message}`, "error");
        }
    };
    reader.readAsText(file);
});

// منطق نسخ صورة الهوية الحالية للحافظة
async function copyActivePhotoToClipboard() {
    const base64Data = appState.currentActivePhoto;
    if (!base64Data) {
        showToast("لا توجد صورة مخصصة لنسخها لهوية هذا الطالب!", "error");
        return;
    }
    
    try {
        const response = await fetch(base64Data);
        const blob = await response.blob();
        
        // التحقق من توافق المتصفح مع ClipboardItem
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            showToast(`تم نسخ صورة الطالب ${appState.currentActiveStudentName} للحافظة بنجاح!`, "success");
        } else {
            throw new Error("Clipboard API not supported");
        }
    } catch (err) {
        console.error("Failed to copy image: ", err);
        showToast("تعذر النسخ التلقائي في المتصفح الحالي. يمكنك النقر بالزر الأيمن للفأرة وحفظ الصورة.", "error");
    }
}

// منطق تحميل صورة الهوية الحالية
function downloadActivePhoto() {
    const base64Data = appState.currentActivePhoto;
    if (!base64Data) {
        showToast("لا توجد صورة مخصصة لتحميلها لهوية هذا الطالب!", "error");
        return;
    }
    
    const link = document.createElement("a");
    link.href = base64Data;
    link.download = `student_id_${appState.currentActiveCardNum}_${appState.currentActiveStudentName.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("تم تحميل ملف الصورة بنجاح!", "success");
}

// ربط أزرار النسخ والتحميل الجديدة
document.getElementById('btn-copy-card-img')?.addEventListener('click', copyActivePhotoToClipboard);
document.getElementById('btn-download-card-img')?.addEventListener('click', downloadActivePhoto);

// ==========================================================================
// 9. تهيئة التطبيق عند فتح الصفحة (Initialization)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    checkBackendConnection();
});
