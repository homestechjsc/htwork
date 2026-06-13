import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, update, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBroVaPiuBOMKxGngnBqBOdGhYVT4fS-to",
    authDomain: "dbwork-homestech.firebaseapp.com",
    databaseURL: "https://dbwork-homestech-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dbwork-homestech",
    storageBucket: "dbwork-homestech.firebasestorage.app",
    messagingSenderId: "202985695707",
    appId: "1:202985695707:web:36894d4e79bc83206edffe",
    measurementId: "G-9QC7GT9S63"
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

const LOGGED_NAME = localStorage.getItem('logged_staff_name');
if (!LOGGED_NAME) { alert("Vui lòng đăng nhập!"); window.location.href = "loginad.html"; }

const TEN_TRUONG_PHONG = LOGGED_NAME; 
if (document.getElementById('user-display')) {
    document.getElementById('user-display').innerText = TEN_TRUONG_PHONG;
}

const adminTaskBox = document.getElementById('adminTaskBox');
let currentFilter = "all";
let allTasksCache = [];
let databaseCustomersCache = {}; 

// Cấu hình ma trận quyền mặc định an toàn (Khóa hoàn toàn cho đến khi tải xong dữ liệu từ Firebase)
let CAP_BAC_HIEN_TAI = "";
let localPermissions = { approveProposal: false, approveOvertime: false, approveReport: false };

let countTodayTotal = 0;
let countTodayCompleted = 0;
let countTodayOT = 0;

function getVietnamTimeString() {
    return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

// =========================================================================
// GIAO DIỆN CHUYỂN LIGHT / DARK THEME
// =========================================================================
const themeBtn = document.getElementById('btn-toggle-theme');
const themeIcon = document.getElementById('theme-icon');

// 1. Kiểm tra trạng thái khi tải trang
if (localStorage.getItem('erp_theme') === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.className = "fa fa-sun text-xs text-amber-400";
}

// 2. Xử lý sự kiện click
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        // toggle class 'dark' trên thẻ <html>
        const isDark = document.documentElement.classList.toggle('dark');
        
        // Lưu lại trạng thái vào localStorage
        localStorage.setItem('erp_theme', isDark ? 'dark' : 'light');
        
        // Đổi icon tương ứng
        if (themeIcon) {
            themeIcon.className = isDark ? "fa fa-sun text-xs text-amber-400" : "fa fa-moon text-xs";
        }
    });
}
// =========================================================================
// BOTTOM NAV MENU TOGGLE CONTROLLER
// =========================================================================
const navItems = document.querySelectorAll('.menu-nav-item');
const appPanels = document.querySelectorAll('.app-panel');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(i => { i.classList.remove('text-indigo-600'); i.classList.add('text-erp-subtext'); });
        item.classList.add('text-indigo-600'); item.classList.remove('text-erp-subtext');
        appPanels.forEach(p => p.classList.remove('active'));
        
        const targetPanel = item.getAttribute('data-panel');
        const targetElement = document.getElementById(targetPanel);
        if (targetElement) targetElement.classList.add('active');
        
        if (targetPanel === 'panel-giaoviec') generateNextTaskId();
    });
});

// =========================================================================
// NGHIỆP VỤ 1: RENDER CÔNG VIỆC CHÍNH TOÀN CÔNG TY KÈM BỘ LỌC NGÀY
// =========================================================================
function renderAdminTasks() {
    if (!adminTaskBox) return;
    adminTaskBox.innerHTML = "";
    let hasTask = false;

    const filterStartDate = document.getElementById('filter-start-date')?.value || "";
    const filterEndDate = document.getElementById('filter-end-date')?.value || "";

    allTasksCache.forEach((task) => {
        let matchedStatus = task.status;
        if(task.status === 'overtime-in') matchedStatus = 'in-progress';
        if (currentFilter !== "all" && matchedStatus !== currentFilter) return;

        // [Logic lọc ngày giữ nguyên...]
        let matchedDateRange = true;
        if (task.createdAt) {
            const parts = task.createdAt.split(' ');
            const datePart = parts.length > 1 ? parts[1] : parts[0]; 
            const dateSegments = datePart.split('/'); 
            if (dateSegments.length === 3) {
                const y = dateSegments[2], m = dateSegments[1].padStart(2, '0'), d = dateSegments[0].padStart(2, '0');
                const taskDateStr = `${y}-${m}-${d}`;
                if (filterStartDate && taskDateStr < filterStartDate) matchedDateRange = false;
                if (filterEndDate && taskDateStr > filterEndDate) matchedDateRange = false;
            }
        } else if (filterStartDate || filterEndDate) matchedDateRange = false;
        if (!matchedDateRange) return;
        hasTask = true;

        // Cấu hình hiển thị
        let borderIndicator = "border-l-[4px] border-l-slate-400"; 
        let statusText = "Chờ làm", statusColor = "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60";
        
        // Xử lý Quyết toán
        let feeInfo = task.fee || 'Chưa có';
        if(task.status === 'completed' && task.actualFeeType) {
            feeInfo = task.actualFeeType === 'Thu phí' ? task.actualFeeAmount + 'đ' : task.actualFeeType;
        }

        if(task.status === 'pending' || task.status === 'paused') { borderIndicator = "border-l-[4px] border-l-amber-500"; statusText = task.status === 'paused' ? "Tạm ngưng" : "Chờ làm"; statusColor = "text-amber-700 bg-amber-50"; }
        else if (task.status === 'in-progress' || task.status === 'overtime-in') { borderIndicator = "border-l-[4px] border-l-blue-600"; statusText = task.status === 'overtime-in' ? "Tăng ca" : "Đang làm"; statusColor = "text-blue-700 bg-blue-50"; }
        else { borderIndicator = "border-l-[4px] border-l-emerald-500"; statusText = "Đã xong"; statusColor = "text-emerald-700 bg-emerald-50"; }

        const cardNode = document.createElement('div');
cardNode.className = `bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ${borderIndicator} overflow-hidden mb-3 cursor-pointer`;

cardNode.innerHTML = `
    <div class="p-4 space-y-2">
        <div class="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider flex justify-between items-center">
            <div>${task.techId} | ${task.type || 'Dịch vụ'}</div>
            <span class="text-[9px] px-2 py-0.5 rounded-lg border font-bold uppercase ${statusColor}">${statusText}</span>
        </div>
        
        <div class="flex justify-between items-start">
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">${task.customer}</h3>
            <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded ml-2 whitespace-nowrap">${feeInfo}</div>
        </div>
        
        <div class="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p><i class="fa fa-bullseye text-blue-500 mr-1"></i><strong>Nội dung:</strong> ${task.taskContent || '-'}</p>
            <p><i class="fa fa-user-gear text-indigo-500 mr-1"></i><strong>Kỹ thuật:</strong> ${task.mainStaff} ${task.subStaff ? `<span class="text-slate-400">| Hỗ trợ: ${task.subStaff}</span>` : ''}</p>
            <p><i class="fa fa-map-marker-alt text-red-500 mr-1"></i>${task.address}</p>
        </div>
    </div>
    
    <div class="details-content hidden px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
        <div class="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg font-mono text-[11px] border border-slate-100 dark:border-slate-800">
            <p>Vào: <strong class="text-slate-900 dark:text-slate-100">${task.timeStart || '--'}</strong></p>
            <p>Ra: <strong class="text-slate-900 dark:text-slate-100">${task.timeEnd || '--'}</strong></p>
            <p>TC Vào: <strong class="text-purple-600 dark:text-purple-400">${task.timeOTStart || '--'}</strong></p>
            <p>TC Ra: <strong class="text-purple-600 dark:text-purple-400">${task.timeOTEnd || '--'}</strong></p>
            <p class="col-span-2">Tạm ngưng: <strong class="text-slate-900 dark:text-slate-100">${task.timePause || '--'}</strong> (${task.pauseReason || '...'})</p>
            <p class="col-span-2">Lý do TC: <strong>${task.otReason || '...'}</strong></p>
        </div>
        
        <div class="flex flex-wrap gap-2 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
            ${task.locInLat ? `<a href="http://googleusercontent.com/maps.google.com/9${task.locInLat},${task.locInLng}" target="_blank" class="text-blue-600 dark:text-blue-400 underline font-bold">GPS Vào</a>` : ''}
            ${task.locOutLat ? `<a href="http://googleusercontent.com/maps.google.com/9${task.locOutLat},${task.locOutLng}" target="_blank" class="text-red-600 dark:text-red-400 underline font-bold">GPS Ra</a>` : ''}
            ${task.locOTInLat ? `<a href="http://googleusercontent.com/maps.google.com/9${task.locOTInLat},${task.locOTInLng}" target="_blank" class="text-purple-600 dark:text-purple-400 underline font-bold">GPS TC Vào</a>` : ''}
            ${task.locOTOutLat ? `<a href="http://googleusercontent.com/maps.google.com/9${task.locOTOutLat},${task.locOTOutLng}" target="_blank" class="text-purple-800 dark:text-purple-300 underline font-bold">GPS TC Ra</a>` : ''}
            ${task.locPauseLat ? `<a href="http://googleusercontent.com/maps.google.com/9${task.locPauseLat},${task.locPauseLng}" target="_blank" class="text-amber-600 dark:text-amber-400 underline font-bold">GPS Ngưng</a>` : ''}
        </div>
        
        <button data-key="${task.firebaseKey}" class="btn-delete-task w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-lg mt-2 text-[10px] hover:bg-red-100 transition">XÓA PHIẾU VIỆC</button>
    </div>
`;

        cardNode.addEventListener('click', (e) => {
            if(!e.target.closest('.btn-delete-task')) {
                cardNode.querySelector('.details-content').classList.toggle('hidden');
            }
        });

        const btnDelete = cardNode.querySelector('.btn-delete-task');
        btnDelete.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Xác nhận xóa phiếu ${task.techId}?`)) await remove(ref(rtdb, `tech_tasks/${task.firebaseKey}`));
        });

        adminTaskBox.appendChild(cardNode);
    });

    if (!hasTask) adminTaskBox.innerHTML = `<div class="text-center py-16 text-slate-400 text-xs font-mono">HỆ THỐNG TRỐNG LỆNH VIỆC</div>`;
}
// =========================================================================
// 👉 KHỞI CHẠY LUỒNG QUÉT CHÍNH VÀ ĐỒNG BỘ MẠT TRẬN BẢO MẬT AN TOÀN
// =========================================================================

// 1. Tải bộ đệm Khách hàng gối đầu
onValue(ref(rtdb, "customers"), (snapshot) => {
    const custDatalist = document.getElementById('customer-list');
    const phoneDatalist = document.getElementById('phone-list');
    if (custDatalist) custDatalist.innerHTML = "";
    if (phoneDatalist) phoneDatalist.innerHTML = "";
    databaseCustomersCache = {};

    if (snapshot.exists()) {
        snapshot.forEach((child) => {
            const cKey = child.key; const cData = child.val();
            databaseCustomersCache[cKey] = cData;
            if (custDatalist && cData.name) {
                const option = document.createElement('option'); option.value = cData.name;
                option.innerText = `SĐT: ${cData.phone || 'N/A'}`; custDatalist.appendChild(option);
            }
            if (phoneDatalist && cData.phone) {
                const option = document.createElement('option'); option.value = cData.phone;
                option.innerText = cData.name || ''; phoneDatalist.appendChild(option);
            }
        });
    }
});

// 2. Xác thực tài khoản đăng nhập & Thực thi chốt chặn phân quyền
onValue(ref(rtdb, "users"), (snapshot) => {
    const staffDatalist = document.getElementById('staff-list');
    if (staffDatalist) staffDatalist.innerHTML = ""; 
    let isAccessAuthorized = false;

    if (snapshot.exists()) {
        snapshot.forEach((child) => {
            const u = child.val();
            if (u.name === TEN_TRUONG_PHONG) {
                const userRole = u.role || "Nhân viên";
                
                // Chấp nhận bộ 3 phân quyền Quản trị cao cấp vào phân hệ di động
                if (userRole === "Trưởng phòng" || userRole === "Trưởng nhóm" || userRole === "Admin" || userRole === "Quản trị") {
                    isAccessAuthorized = true;
                    CAP_BAC_HIEN_TAI = userRole; // Ghi đè biến phân quyền thực tế toàn cục

                    const elName = document.getElementById('profile-name');
                    const elRole = document.getElementById('profile-role');
                    const elUser = document.getElementById('profile-username');
                    const elEmail = document.getElementById('profile-email');
                    const elAvatar = document.getElementById('profile-avatar');

                    if (elName) elName.innerText = u.name;
                    if (elRole) elRole.innerText = `Cấp bậc: ${userRole}`;
                    if (elUser) elUser.innerText = u.username || child.key;
                    if (elEmail) elEmail.innerText = u.email || 'N/A';
                    if (elAvatar) elAvatar.innerText = u.name.split(' ').pop().substring(0,2).toUpperCase();
                }
            }

            if (staffDatalist && u.name) {
                const option = document.createElement('option'); option.value = u.name;
                option.innerText = `Chức vụ: ${u.role || 'Kỹ thuật viên'}`; staffDatalist.appendChild(option);
            }
        });

        if (isAccessAuthorized) {
            // 👉 THAY ĐỔI CỐT LÕI: Gọi luồng tải cấu hình Checkbox từ máy tính trước, chặn đứng render vội vã
            listenSystemPermissionsRealtime();
        } else {
            alert("⚠️ CẢNH BÁO BẢO MẬT:\nTài khoản nhân viên của bạn không có quyền truy cập vào Phân hệ Ban điều hành!");
            localStorage.removeItem('logged_staff_name'); window.location.href = "loginad.html";
        }
    }
});

// 👉 BỔ SUNG: Hàm lắng nghe real-time bảng quyền hệ thống từ node system_permissions
function listenSystemPermissionsRealtime() {
    onValue(ref(rtdb, `system_permissions/${CAP_BAC_HIEN_TAI}`), (snapshot) => {
        if (snapshot.exists()) {
            const perm = snapshot.val();
            localPermissions.approveProposal = perm.approveProposal === true;
            localPermissions.approveOvertime = perm.approveOvertime === true;
            localPermissions.approveReport = perm.approveReport === true;
        } else {
            if (CAP_BAC_HIEN_TAI === "Admin") {
                localPermissions.approveProposal = true; localPermissions.approveOvertime = true; localPermissions.approveReport = true;
            } else {
                localPermissions.approveProposal = false; localPermissions.approveOvertime = false; localPermissions.approveReport = false;
            }
        }
        
        // 🏁 ĐỒNG BỘ XONG QUYỀN -> Kích hoạt các luồng render
        document.getElementById('app-container')?.classList.remove('hidden');
        
        // 1. Luồng Lệnh việc
        fetchAndCalculateTasks();
        
        // 2. Luồng Đề xuất vật tư
        listenProposalDataRealtime();
        
        // 3. 👉 BỔ SUNG: Luồng Duyệt tăng ca
        // Đảm bảo hàm này được gọi sau khi đã có quyền 'approveOvertime'
        if (typeof listenOvertimeRealtime === 'function') {
            listenOvertimeRealtime();
        }
    });
}

// 3. Hàm tải Real-time danh sách công việc toàn hệ thống
function fetchAndCalculateTasks() {
    onValue(ref(rtdb, "tech_tasks"), (snapshot) => {
        allTasksCache = [];
        let tTotal = 0, tPending = 0, tInProgress = 0, tCompleted = 0;
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const task = child.val();
                allTasksCache.push({ firebaseKey: child.key, ...task });
                tTotal++;
                if (task.status === 'completed') tCompleted++;
                else if (task.status === 'in-progress' || task.status === 'overtime-in') tInProgress++;
                else if (task.status === 'pending' || task.status === 'paused') tPending++;
            });
        }
        allTasksCache.reverse(); 

        const elTotal = document.getElementById('stat-total');
        const elPending = document.getElementById('stat-pending');
        const elProgress = document.getElementById('stat-progress');
        const elCompleted = document.getElementById('stat-completed');
        if (elTotal) elTotal.innerText = tTotal;
        if (elPending) elPending.innerText = tPending;
        if (elProgress) elProgress.innerText = tInProgress;
        if (elCompleted) elCompleted.innerText = tCompleted;

        calculateTodayMetrics();
        renderAdminTasks();
    });
}

// Liên kết nhanh thông tin biểu mẫu
document.getElementById('task-customer')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    for (let key in databaseCustomersCache) {
        if (databaseCustomersCache[key].name === val) {
            document.getElementById('task-phone').value = databaseCustomersCache[key].phone || "";
            document.getElementById('task-address').value = databaseCustomersCache[key].address || ""; break;
        }
    }
});
document.getElementById('task-phone')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    for (let key in databaseCustomersCache) {
        if (databaseCustomersCache[key].phone === val) {
            document.getElementById('task-customer').value = databaseCustomersCache[key].name || "";
            document.getElementById('task-address').value = databaseCustomersCache[key].address || ""; break;
        }
    }
});

// =========================================================================
// NGHIỆP VỤ 2: TỰ ĐỘNG TÍNH TOÁN VÀ LẬP BÁO CÁO CÔNG VIỆC CUỐI NGÀY
// =========================================================================
const btnToggleReportForm = document.getElementById('btn-toggle-report-form');
const managerReportForm = document.getElementById('manager-report-form');
const btnCancelReport = document.getElementById('btn-cancel-report');

if (btnToggleReportForm && managerReportForm) {
    btnToggleReportForm.addEventListener('click', () => {
        const isHidden = managerReportForm.classList.contains('hidden');
        if (isHidden) {
            managerReportForm.classList.remove('hidden'); managerReportForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            btnToggleReportForm.innerHTML = `<i class="fa fa-minus-circle"></i> Thu gọn`;
            btnToggleReportForm.className = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl border border-slate-200/60";
        } else {
            managerReportForm.classList.add('hidden'); btnToggleReportForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo báo cáo`;
            btnToggleReportForm.className = "bg-indigo-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1";
            clearReportFormInputs();
        }
    });
}

if (btnCancelReport && btnToggleReportForm) {
    btnCancelReport.addEventListener('click', () => {
        if (managerReportForm) managerReportForm.classList.add('hidden');
        btnToggleReportForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo báo cáo`;
        btnToggleReportForm.className = "bg-indigo-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1";
        clearReportFormInputs();
    });
}

function clearReportFormInputs() {
    const elProgress = document.getElementById('rep-construction-progress'); const elOtReason = document.getElementById('rep-ot-reason');
    if (elProgress) elProgress.value = ""; if (elOtReason) elOtReason.value = "";
}

function calculateTodayMetrics() {
    const dateOnlyPart = getVietnamTimeString().split(',')[0].trim();
    countTodayTotal = 0; countTodayCompleted = 0; countTodayOT = 0;

    allTasksCache.forEach(task => {
        if (task.createdAt && task.createdAt.includes(dateOnlyPart)) {
            countTodayTotal++;
            if (task.status === 'completed') countTodayCompleted++;
            if (task.timeOTStart || task.status === 'overtime-in') countTodayOT++;
        }
    });

    const elRepTotal = document.getElementById('rep-total-today');
    const elRepDone = document.getElementById('rep-done-today');
    const elRepOt = document.getElementById('rep-ot-today');
    if (elRepTotal) elRepTotal.innerText = countTodayTotal;
    if (elRepDone) elRepDone.innerText = countTodayCompleted;
    if (elRepOt) elRepOt.innerText = `${countTodayOT} ca`;
}

const btnSubmitManagerReport = document.getElementById('btn-submit-manager-report');
if (btnSubmitManagerReport) {
    btnSubmitManagerReport.addEventListener('click', async () => {
        const progressContent = document.getElementById('rep-construction-progress').value.trim();
        const otReasonContent = document.getElementById('rep-ot-reason').value.trim();
        const dateOnlyPart = getVietnamTimeString().split(',')[0].trim();

        if (!progressContent) return alert("Vui lòng điền thông tin cập nhật tiến độ công trình trong ngày!");
        if (countTodayOT > 0 && !otReasonContent) return alert("Vui lòng nhập giải trình lý do nhân sự tăng ca!");

        btnSubmitManagerReport.disabled = true; btnSubmitManagerReport.innerText = "ĐANG GỬI...";

        try {
            await set(push(ref(rtdb, "manager_daily_reports")), {
                reporter: TEN_TRUONG_PHONG, date: dateOnlyPart, createdAt: getVietnamTimeString(),
                totalTasksCreated: countTodayTotal, completedTasks: countTodayCompleted, totalOTCases: countTodayOT,
                constructionProgress: progressContent, otReason: otReasonContent || "Không có ca tăng ca phát sinh"
            });

            alert(`Nộp báo cáo tổng hợp ngày ${dateOnlyPart} thành công!`);
            if (managerReportForm) managerReportForm.classList.add('hidden');
            if (btnToggleReportForm) {
                btnToggleReportForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo báo cáo`;
                btnToggleReportForm.className = "bg-indigo-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1";
            }
            clearReportFormInputs();
        } catch (e) { alert("Lỗi nộp báo cáo: " + e.message); } finally { btnSubmitManagerReport.disabled = false; btnSubmitManagerReport.innerText = "NỘP BÁO CÁO"; }
    });
}

const managerReportHistoryBox = document.getElementById('managerReportHistoryBox');
if (managerReportHistoryBox) {
    onValue(ref(rtdb, "manager_daily_reports"), (snapshot) => {
        managerReportHistoryBox.innerHTML = ""; let hasReport = false;
        if (snapshot.exists()) {
            let reportsArray = [];
            snapshot.forEach((child) => {
                const rep = child.val(); if (rep.reporter === TEN_TRUONG_PHONG) reportsArray.push(rep);
            });
            reportsArray.reverse();
            reportsArray.forEach((rep) => {
                hasReport = true;
                const card = document.createElement('div');
                card.className = "p-3 bg-white dark:bg-[#1e293b] border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col gap-1.5 text-xs";
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                            <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400"><i class="fa fa-calendar-day text-[9px] mr-1"></i>${rep.date}</span>
                            <span>|</span><span>Duyệt bởi: <strong class="text-indigo-600 dark:text-indigo-400">${rep.reporter}</strong></span>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 text-center font-mono text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                        <span class="bg-slate-50 dark:bg-slate-900/60 rounded-md p-1 border border-slate-100 dark:border-slate-800/40">Việc mới: <strong class="text-indigo-600">${rep.totalTasksCreated}</strong></span>
                        <span class="bg-slate-50 dark:bg-slate-900/60 rounded-md p-1 border border-slate-100 dark:border-slate-800/40">Đã xong: <strong class="text-emerald-600">${rep.completedTasks}</strong></span>
                        <span class="bg-slate-50 dark:bg-slate-900/60 rounded-md p-1 border border-slate-100 dark:border-slate-800/40">Tăng ca: <strong class="text-purple-600">${rep.totalOTCases} ca</strong></span>
                    </div>
                    <div class="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100 space-y-1.5">
                        <p><strong class="text-blue-600 font-bold font-mono text-[9px] uppercase">[Tiến độ]:</strong> ${rep.constructionProgress}</p>
                        <p><strong class="text-purple-600 font-bold font-mono text-[9px] uppercase">[Tăng ca]:</strong> ${rep.otReason}</p>
                    </div>`;
                managerReportHistoryBox.appendChild(card);
            });
        }
        if (!hasReport) managerReportHistoryBox.innerHTML = `<div class="text-center py-8 text-slate-400 italic text-[10px] font-mono bg-white dark:bg-[#111827] border border-dashed border-slate-200 rounded-xl"><i class="fa fa-receipt text-lg mb-1.5 block text-slate-200"></i>Chưa nộp đơn báo cáo tổng hợp nào.</div>`;
    });
}

// =========================================================================
// GIAO VIỆC KỸ THUẬT MỚI 
// =========================================================================
function generateNextCustomerId() {
    let maxNum = 0;
    for (let key in databaseCustomersCache) {
        const match = key.match(/^KH(\d+)$/i);
        if (match) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
    }
    return "KH" + (maxNum + 1).toString().padStart(4, '0');
}

function generateNextTaskId() {
    let maxNumber = 0;
    allTasksCache.forEach(t => {
        const match = (t.techId || "").match(/^CV(\d+)$/i);
        if (match) { const num = parseInt(match[1], 10); if (num > maxNumber) maxNumber = num; }
    });
    const nextId = "CV" + (maxNumber + 1).toString().padStart(4, '0');
    const elTaskId = document.getElementById('task-id'); if (elTaskId) elTaskId.value = nextId;
}

const btnSaveNewTask = document.getElementById('btn-save-new-task');
if (btnSaveNewTask) {
    btnSaveNewTask.addEventListener('click', async () => {
        const techId = document.getElementById('task-id').value; const type = document.getElementById('task-type').value;
        const customerName = document.getElementById('task-customer').value.trim(); const phone = document.getElementById('task-phone').value.trim();
        const address = document.getElementById('task-address').value.trim(); const mainStaff = document.getElementById('task-main-staff').value.trim();
        const subStaff = document.getElementById('task-sub-staff').value.trim() || "Không có"; const detail = document.getElementById('task-content-detail').value.trim();

        if (!customerName || !phone || !address || !mainStaff || !detail) return alert("Vui lòng nhập đầy đủ thông tin (*) bắt buộc!");
        const dateOnlyPart = getVietnamTimeString().split(',')[0].trim();

        try {
            let isExistingCustomer = false;
            for (let key in databaseCustomersCache) {
                if (databaseCustomersCache[key].phone === phone) { isExistingCustomer = true; break; }
            }
            if (!isExistingCustomer) {
                const nextCustId = generateNextCustomerId();
                await set(ref(rtdb, `customers/${nextCustId}`), { name: customerName, phone: phone, address: address, createdAt: dateOnlyPart });
            }
            await set(push(ref(rtdb, "tech_tasks")), {
                techId, createdAt: dateOnlyPart, customer: customerName, phone, address, type, taskContent: detail,
                priority: document.getElementById('task-priority').value, fee: "Chờ nghiệm thu", mainStaff, subStaff, deadline: "Trong ngày", author: TEN_TRUONG_PHONG, status: "pending"
            });
            alert(`Thành công mã phiếu ${techId}.`);
            document.getElementById('tech-task-form-elements-clear').click(); // trigger clear
        } catch(e) { alert("Lỗi: " + e.message); }
    });
}

// =========================================================================
// 👉 NGHIỆP VỤ 4: THẨM ĐỊNH ĐỀ XUẤT VẬT TƯ ĐỒNG BỘ THEO MA TRẬN QUYỀN
// =========================================================================
const proposalListBox = document.getElementById('proposalListBox');
function listenProposalDataRealtime() {
    if (!proposalListBox) return;
    
    onValue(ref(rtdb, "proposals"), (snapshot) => {
        proposalListBox.innerHTML = ""; 
        if (snapshot.exists()) {
            let proposalsArray = [];
            snapshot.forEach((child) => { proposalsArray.push({ firebaseKey: child.key, ...child.val() }); });
            proposalsArray.reverse();

            proposalsArray.forEach((prop) => {
                const isApproved = prop.status === "Đã duyệt";
                const card = document.createElement('div');
                card.className = "p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-2.5";
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="text-[10px] font-mono font-bold text-slate-400">
                            <span class="text-indigo-600 dark:text-indigo-400 font-sans text-xs font-bold block">${prop.staffName}</span>
                            <span>Việc: <strong class="text-blue-600">${prop.techIdRelated || 'Không có'}</strong></span>
                        </div>
                        <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${isApproved ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-600 bg-amber-500/10 border-amber-500/20'}">
                            ${prop.status}
                        </span>
                    </div>
                    <div class="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        ${prop.content}
                    </div>
                    <div class="flex gap-2 font-mono text-[11px] font-bold pt-1 items-center">
                        ${localPermissions.approveProposal && prop.status === "Chờ duyệt" ? `
                            <button data-key="${prop.firebaseKey}" data-action="reject" class="btn-prop flex-1 bg-slate-100 dark:bg-slate-800 text-red-500 rounded-xl py-2 border active:scale-95 transition-all">BÁC BỎ</button>
                            <button data-key="${prop.firebaseKey}" data-action="approve" class="btn-prop flex-2 w-2/3 bg-emerald-600 text-white rounded-xl py-2 active:scale-95 transition-all shadow-sm">DUYỆT CẤP</button>
                        ` : ''}
                        <button data-key="${prop.firebaseKey}" data-action="delete" class="btn-prop text-slate-400 hover:text-red-500 p-2"><i class="fa fa-trash"></i></button>
                    </div>
                `;
                proposalListBox.appendChild(card);
            });

            proposalListBox.querySelectorAll('.btn-prop').forEach(btn => btn.addEventListener('click', async () => {
                const key = btn.getAttribute('data-key'); const action = btn.getAttribute('data-action');
                if (action === 'approve') await update(ref(rtdb, `proposals/${key}`), { status: "Đã duyệt" });
                if (action === 'reject') await update(ref(rtdb, `proposals/${key}`), { status: "Từ chối" });
                if (action === 'delete' && confirm("Xóa đề xuất này?")) await remove(ref(rtdb, `proposals/${key}`));
            }));
        }
    });
}

// =========================================================================
// 2. DUYỆT TĂNG CA (Dạng Card - Đã có Icon Xóa)
// =========================================================================
function listenOvertimeRealtime() {
    const otListEl = document.getElementById('ot-approval-list');
    if (!otListEl) return;

    onValue(ref(rtdb, "tech_tasks"), (snapshot) => {
        otListEl.innerHTML = "";
        snapshot.forEach((child) => {
            const task = child.val();
            if (task.timeOTStart) {
                const isApproved = task.otStatus === 'Đã duyệt';
                const card = document.createElement('div');
                card.className = "p-4 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm space-y-2.5";
                
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="text-[10px] font-mono font-bold text-slate-400">
                            <span class="text-indigo-600 dark:text-indigo-400 font-sans text-xs font-bold block">${task.mainStaff}</span>
                            <span>CV: <strong class="text-blue-600">${task.techId}</strong></span>
                        </div>
                        <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${isApproved ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-600 bg-amber-500/10 border-amber-500/20'}">
                            ${task.otStatus || 'Chờ duyệt'}
                        </span>
                    </div>
                    
                    <div class="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                        <div class="mb-1"><strong class="text-purple-600 font-mono text-[9px] uppercase">[Lý do]:</strong> ${task.otReason || '---'}</div>
                        <div class="text-[10px] font-mono opacity-80"><i class="fa fa-clock mr-1"></i>${task.timeOTStart} - ${task.timeOTEnd || '---'}</div>
                    </div>

                    ${localPermissions.approveOvertime ? `
                        <div class="flex gap-2 font-mono text-[11px] font-bold pt-1 items-center">
                            ${!isApproved ? `
                                <button onclick="updateOTStatus('${child.key}', 'Từ chối')" class="flex-1 bg-slate-100 dark:bg-slate-800 text-red-500 rounded-xl py-2 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all">BÁC BỎ</button>
                                <button onclick="updateOTStatus('${child.key}', 'Đã duyệt')" class="flex-2 w-2/3 bg-emerald-600 text-white rounded-xl py-2 active:scale-95 transition-all shadow-sm">DUYỆT CẤP</button>
                            ` : `
                                <button onclick="updateOTStatus('${child.key}', 'Chờ duyệt')" class="w-full bg-slate-600 text-white rounded-xl py-2 active:scale-95 transition-all text-xs">HỦY DUYỆT</button>
                            `}
                            <button onclick="deleteOTTask('${child.key}')" class="text-slate-400 hover:text-red-500 p-2"><i class="fa fa-trash"></i></button>
                        </div>
                    ` : ''}
                `;
                otListEl.appendChild(card);
            }
        });
    });
}
// Hàm duyệt/bác
window.approveOT = async (key) => {
    await update(ref(rtdb, `tech_tasks/${key}`), { otStatus: "Đã duyệt" });
    alert("Đã duyệt tăng ca!");
};

window.rejectOT = async (key) => {
    await update(ref(rtdb, `tech_tasks/${key}`), { otStatus: "Từ chối" });
    alert("Đã bác bỏ tăng ca!");
};

window.updateOTStatus = async (key, status) => {
    if(!confirm(`Xác nhận chuyển trạng thái sang: ${status}?`)) return;
    await update(ref(rtdb, `tech_tasks/${key}`), { otStatus: status });
};
// =========================================================================
// HÀM BỔ TRỢ: XÓA DỮ LIỆU TĂNG CA
// =========================================================================
window.deleteOTTask = async (key) => {
    if(!confirm("Xác nhận xóa bỏ vĩnh viễn ca làm này?")) return;
    try {
        // Cập nhật giá trị các trường tăng ca thành null để xóa khỏi logic hiển thị
        await update(ref(rtdb, `tech_tasks/${key}`), { 
            timeOTStart: null, 
            timeOTEnd: null, 
            otReason: null, 
            otStatus: null 
        });
        alert("Đã xóa dữ liệu tăng ca!");
    } catch(e) { 
        alert("Lỗi khi xóa dữ liệu: " + e.message); 
    }
};

// =========================================================================
// BỔ SUNG: XỬ LÝ LỌC TRẠNG THÁI CÔNG VIỆC
// =========================================================================
const filterButtons = document.querySelectorAll('.btn-filter');
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Reset giao diện các nút bấm khác
        filterButtons.forEach(b => {
            b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
            b.classList.add('text-erp-subtext');
        });
        // Highlight nút đang chọn
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
        btn.classList.remove('text-erp-subtext');

        // Cập nhật biến lọc và gọi hàm render lại danh sách
        currentFilter = btn.getAttribute('data-filter');
        renderAdminTasks(); 
    });
});

// Thêm sự kiện theo dõi thay đổi ngày
const startDateInput = document.getElementById('filter-start-date');
const endDateInput = document.getElementById('filter-end-date');

if (startDateInput) {
    startDateInput.addEventListener('change', renderAdminTasks);
}

if (endDateInput) {
    endDateInput.addEventListener('change', renderAdminTasks);
}