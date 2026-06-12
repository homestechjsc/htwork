import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, update, set, push, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
if (!LOGGED_NAME) { alert("Vui lòng đăng nhập!"); window.location.href = "login.html"; }

const TEN_NHAN_VIEN_HIEN_TAI = LOGGED_NAME; 
if (document.getElementById('user-display')) {
    document.getElementById('user-display').innerText = TEN_NHAN_VIEN_HIEN_TAI;
}

const nvTaskBox = document.getElementById('nvTaskBox');
let currentFilter = "all";
let allTasksCache = [];
let CAP_BAC_HIEN_TAI = "Nhân viên"; 

function getVietnamTimeString() {
    return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

// =========================================================================
// GIAO DIỆN CHUYỂN LIGHT / DARK THEME
// =========================================================================
const themeBtn = document.getElementById('btn-toggle-theme');
const themeIcon = document.getElementById('theme-icon');
if (localStorage.getItem('erp_theme') === 'dark' || (!('erp_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark'); if (themeIcon) themeIcon.className = "fa fa-sun text-xs text-amber-400";
} else { document.documentElement.classList.remove('dark'); if (themeIcon) themeIcon.className = "fa fa-moon text-xs"; }

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark'); localStorage.setItem('erp_theme', 'light'); if (themeIcon) themeIcon.className = "fa fa-moon text-xs";
        } else {
            document.documentElement.classList.add('dark'); localStorage.setItem('erp_theme', 'dark'); if (themeIcon) themeIcon.className = "fa fa-sun text-xs text-amber-400";
        }
    });
}

// =========================================================================
// ĐỒNG BỘ 5 MENU ĐIỀU HƯỚNG BOTTOM NAV
// =========================================================================
const navItems = document.querySelectorAll('.menu-nav-item');
const appPanels = document.querySelectorAll('.app-panel');
const nvCreateForm = document.getElementById('nv-create-form');
const btnNvCreateTask = document.getElementById('btn-nv-create-task');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(i => { i.classList.remove('text-blue-600'); i.classList.add('text-erp-subtext'); });
        item.classList.add('text-blue-600'); item.classList.remove('text-erp-subtext');
        appPanels.forEach(p => p.classList.remove('active'));
        const targetPanel = item.getAttribute('data-panel');
        const targetElement = document.getElementById(targetPanel);
        if (targetElement) targetElement.classList.add('active');
        if (nvCreateForm) nvCreateForm.classList.add('hidden');
    });
});

if (btnNvCreateTask) {
    btnNvCreateTask.addEventListener('click', () => {
        const panelCongViec = document.getElementById('panel-congviec');
        if (panelCongViec && !panelCongViec.classList.contains('active')) {
            navItems.forEach(i => { i.classList.remove('text-blue-600'); i.classList.add('text-erp-subtext'); });
            const taskTabBtn = document.querySelector('[data-panel="panel-congviec"]');
            if(taskTabBtn) { taskTabBtn.classList.add('text-blue-600'); taskTabBtn.classList.remove('text-erp-subtext'); }
            appPanels.forEach(p => p.classList.remove('active'));
            panelCongViec.classList.add('active');
        }
        if (nvCreateForm) {
            const isHidden = nvCreateForm.classList.contains('hidden');
            if (isHidden) {
                nvCreateForm.classList.remove('hidden');
                nvCreateForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                nvCreateForm.classList.add('hidden');
                resetNvCreateForm();
            }
        }
    });
}

const btnNvCancelTask = document.getElementById('btn-nv-cancel-task');
if (btnNvCancelTask) {
    btnNvCancelTask.addEventListener('click', () => { 
        if (nvCreateForm) nvCreateForm.classList.add('hidden'); 
        resetNvCreateForm(); 
    });
}

function resetNvCreateForm() { 
    const elCust = document.getElementById('nv-new-cust');
    const elPhone = document.getElementById('nv-new-phone');
    const elAddr = document.getElementById('nv-new-addr');
    const elType = document.getElementById('nv-new-type');
    if (elCust) elCust.value = ""; if (elPhone) elPhone.value = ""; if (elAddr) elAddr.value = ""; if (elType) elType.value = ""; 
}

// TỰ KHỞI TẠO LỆNH VIỆC PHÁT SINH
const btnNvSaveTask = document.getElementById('btn-nv-save-task');
if (btnNvSaveTask) {
    btnNvSaveTask.addEventListener('click', async () => {
        const customer = document.getElementById('nv-new-cust').value.trim();
        const customerPhone = document.getElementById('nv-new-phone')?.value.trim() || "Chưa cập nhật";
        const address = document.getElementById('nv-new-addr').value.trim();
        const type = document.getElementById('nv-new-type').value.trim();
        if(!customer || !address) return alert("Vui lòng nhập tên Khách hàng và Địa chỉ thực địa!");

        let maxNumber = 0;
        allTasksCache.forEach(t => {
            const match = (t.techId || "").match(/^CV(\d+)$/i);
            if (match) { const num = parseInt(match[1], 10); if (num > maxNumber) maxNumber = num; }
        });
        const autoId = "CV" + (maxNumber + 1).toString().padStart(4, '0');

        const fullTimeString = getVietnamTimeString(); 
        const dateOnlyPart = fullTimeString.split(',')[0].trim(); 

        try {
            await set(push(ref(rtdb, "tech_tasks")), {
                techId: autoId, createdAt: dateOnlyPart,
                customer: customer, phone: customerPhone, address: address, type: "Dịch vụ",
                taskContent: type || "Xử lý kỹ thuật phát sinh ca trực", priority: "Trung bình",
                fee: "Tính theo cấu trúc việc", mainStaff: TEN_NHAN_VIEN_HIEN_TAI, subStaff: "Không có",
                deadline: "Trong ngày", author: TEN_NHAN_VIEN_HIEN_TAI, status: "pending", isSelfCreated: true
            });
            if (nvCreateForm) nvCreateForm.classList.add('hidden'); resetNvCreateForm(); alert("Khởi tạo thành công!");
        } catch(e) { alert("Lỗi: " + e.message); }
    });
}

// =========================================================================
// KIẾN TRÚC RENDER CARD CÔNG VIỆC CHÍNH KẾT HỢP LỌC NGÀY THÁNG ĐA NĂNG
// =========================================================================
function renderTasks() {
    if (!nvTaskBox) return;
    nvTaskBox.innerHTML = "";
    let hasTask = false;

    // ĐỌC GIÁ TRỊ TỪ 2 Ô INPUT DATE TRÊN GIAO DIỆN
    const filterStartDate = document.getElementById('filter-nv-start-date')?.value || "";
    const filterEndDate = document.getElementById('filter-nv-end-date')?.value || "";

    allTasksCache.forEach((task) => {
        let matchedStatus = task.status;
        if(task.status === 'overtime-in') matchedStatus = 'in-progress';
        if (currentFilter !== "all" && matchedStatus !== currentFilter) return;

        // LOGIC SO SÁNH KHOẢNG NGÀY CHUẨN ISO (yyyy-mm-dd)
        let matchedDateRange = true;
        let taskDateStr = "";

        if (task.createdAt) {
            const datePart = task.createdAt.split(' ')[0]; 
            if (datePart.includes('/')) {
                const parts = datePart.split('/');
                taskDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (datePart.includes('-')) {
                taskDateStr = datePart;
            }
        }

        if (taskDateStr) {
            if (filterStartDate && taskDateStr < filterStartDate) matchedDateRange = false;
            if (filterEndDate && taskDateStr > filterEndDate) matchedDateRange = false;
        } else {
            if (filterStartDate || filterEndDate) matchedDateRange = false;
        }

        if (!matchedDateRange) return;

        hasTask = true;
        let borderIndicator = "border-l-[4px] border-l-slate-400"; 
        let statusText = "Chờ làm", statusColor = "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-700";
        let feeInfo = task.fee || '0';
        if(task.status === 'completed' && task.actualFeeType) {
            feeInfo = task.actualFeeType === 'Thu phí' ? task.actualFeeAmount + 'đ' : task.actualFeeType;
        }

        let actionButtonsHtml = "";
        if(task.status === 'pending' || task.status === 'paused') {
            borderIndicator = "border-l-[4px] border-l-amber-500"; statusText = task.status === 'paused' ? "Tạm ngưng" : "Chờ làm";
            statusColor = "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/50";
            actionButtonsHtml = `<button class="btn-main-start w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl text-xs font-mono tracking-wider shadow-md">BẮT ĐẦU THỰC HIỆN CÔNG VIỆC</button>`;
        } else if (task.status === 'in-progress') {
            borderIndicator = "border-l-[4px] border-l-blue-600"; statusText = "Đang làm";
            statusColor = "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-900/50";
            actionButtonsHtml = `
                <div class="grid grid-cols-2 gap-2.5 mt-3 font-mono text-[11px]">
                    <button class="btn-main-pause bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">TẠM NGƯNG</button>
                    <button class="btn-main-ot-start bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 font-bold py-2.5 rounded-xl border border-purple-200 dark:border-purple-900/50"><i class="fa fa-moon mr-1"></i>TĂNG CA</button>
                </div>
                <button class="btn-main-complete w-full mt-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 rounded-xl text-xs font-mono tracking-wider shadow-md">HOÀN THÀNH</button>
            `;
        } else if (task.status === 'overtime-in') {
            borderIndicator = "border-l-[4px] border-l-purple-500"; statusText = "Tăng ca";
            statusColor = "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/20 dark:border-purple-900/50 animate-pulse";
            actionButtonsHtml = `
                <div class="grid grid-cols-2 gap-2 mt-3 font-mono text-[11px]">
                    <button class="btn-main-ot-end bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 py-2.5 rounded-xl border">RA TĂNG CA</button>
                    <button class="btn-main-complete bg-emerald-600 text-white py-2.5 rounded-xl font-bold shadow-sm">QUYẾT TOÁN</button>
                </div>
            `;
        } else {
            borderIndicator = "border-l-[4px] border-l-emerald-500"; statusText = "Đã xong";
            statusColor = "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/50";
        }

        const customerPhone = task.phone || task.customerPhone || "Chưa cập nhật";
        const cardNode = document.createElement('div');
        cardNode.className = `task-card bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] ${borderIndicator} overflow-hidden mb-3.5 transition-all duration-300`;
        cardNode.innerHTML = `
            <div class="p-4 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors btn-toggle-accordion">
                <div class="space-y-1 pr-2">
                    <div class="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span class="bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-md">${task.techId}</span>
                        <span class="text-slate-300 dark:text-slate-700">|</span>
                        <span class="text-slate-500 dark:text-slate-400">${task.type || 'Dịch vụ'}</span>
                        <span class="text-slate-300 dark:text-slate-700">|</span>
                        <span class="text-slate-400 dark:text-slate-500 font-medium"><i class="fa fa-calendar-day text-[9px] mr-0.5"></i>${task.createdAt || 'Hôm nay'}</span>
                    </div>
                    <h3 class="font-bold text-slate-800 dark:text-slate-100 text-[15px] tracking-tight leading-snug">${task.customer}</h3>
                    <p class="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium flex items-center gap-1"><i class="fa fa-phone text-[9px]"></i> ${customerPhone}</p>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="text-[10px] px-2.5 py-1 rounded-lg border font-bold uppercase tracking-wide ${statusColor}">${statusText}</span>
                    <i class="fa fa-chevron-down text-slate-400 text-xs transition-transform duration-300 icon-arrow"></i>
                </div>
            </div>

            <div class="main-detail hidden px-4 pb-4 border-t border-slate-100 dark:border-slate-800/60 pt-3.5 bg-slate-50/50 dark:bg-slate-900/20 space-y-3.5">
                <div class="space-y-2">
                    <div class="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 text-[12px]">
                        <i class="fa fa-map-marker-alt text-red-500 mt-0.5 text-xs"></i>
                        <span class="text-slate-600 dark:text-slate-300"><strong>Địa chỉ:</strong> ${task.address}</span>
                    </div>
                    <div class="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 text-[12px]">
                        <i class="fa fa-bullseye text-blue-500 mt-0.5 text-xs"></i>
                        <span class="text-slate-600 dark:text-slate-300"><strong>Nội dung CV:</strong> ${task.taskContent || task.type}</span>
                    </div>
                    <div class="flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40 text-[12px]">
                        <i class="fa fa-user text-indigo-500 mt-0.5 text-xs"></i>
                        <span class="text-slate-600 dark:text-slate-300"><strong>Nhân sự làm:</strong> <span class="text-indigo-600 dark:text-indigo-400 font-bold">${task.mainStaff}</span> ${task.subStaff && task.subStaff !== 'Không có' ? `(Hỗ trợ: ${task.subStaff})` : ''}</span>
                    </div>
                    <div class="pt-0.5">
                        <a href="tel:${customerPhone}" class="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 text-xs font-semibold rounded-xl">
                            <i class="fa fa-phone-flip text-[10px]"></i> Gọi: <span class="font-mono">${customerPhone}</span>
                        </a>
                    </div>
                </div>
                <div class="flex justify-between items-center text-[11px] font-mono bg-white dark:bg-slate-900 border border-slate-200/60 p-3 rounded-xl">
                    <span class="text-slate-500 font-sans">Quyết toán:</span>
                    <strong class="text-emerald-600 dark:text-emerald-400 font-bold text-sm">${feeInfo}</strong>
                </div>
                ${task.status === 'paused' && task.pauseReason ? `<p class="text-[11px] text-red-500 font-semibold bg-red-500/5 p-2.5 rounded-xl border border-red-500/10 font-mono">⚠️ LÝ DO NGƯNG: ${task.pauseReason}</p>` : ''}
                
                <div class="action-buttons-area">${actionButtonsHtml}</div>
            </div>
        `;

        cardNode.querySelector('.btn-toggle-accordion').addEventListener('click', (e) => {
            if (e.target.closest('.main-detail') || e.target.closest('a') || e.target.closest('button')) return;
            const detailNode = cardNode.querySelector('.main-detail');
            const arrowNode = cardNode.querySelector('.icon-arrow');
            const isHidden = detailNode.classList.toggle('hidden');
            if (!isHidden) {
                arrowNode.className = "fa fa-chevron-up text-slate-400 text-xs transition-transform duration-300 icon-arrow";
                cardNode.classList.add('ring-2', 'ring-indigo-500/20', 'dark:ring-indigo-500/10', 'shadow-lg');
            } else {
                arrowNode.className = "fa fa-chevron-down text-slate-400 text-xs transition-transform duration-300 icon-arrow";
                cardNode.classList.remove('ring-2', 'ring-indigo-500/20', 'dark:ring-indigo-500/10', 'shadow-lg');
            }
        });

        const btnStart = cardNode.querySelector('.btn-main-start');
        if(btnStart) btnStart.addEventListener('click', () => handleMainAction(task.firebaseKey, 'start', btnStart));
        
        const btnPause = cardNode.querySelector('.btn-main-pause');
        if(btnPause) btnPause.addEventListener('click', () => { document.getElementById('pause-task-id').value = task.firebaseKey; document.getElementById('pause-reason-input').value = ""; document.getElementById('popup-pause').classList.remove('hidden'); });

        const btnOtStart = cardNode.querySelector('.btn-main-ot-start');
        if(btnOtStart) btnOtStart.addEventListener('click', () => handleMainAction(task.firebaseKey, 'ot-start', btnOtStart));

        const btnOtEnd = cardNode.querySelector('.btn-main-ot-end');
        if(btnOtEnd) btnOtEnd.addEventListener('click', () => handleMainAction(task.firebaseKey, 'ot-end', btnOtEnd));

        const btnComplete = cardNode.querySelector('.btn-main-complete');
        if(btnComplete) btnComplete.addEventListener('click', () => { document.getElementById('complete-task-id').value = task.firebaseKey; document.getElementById('complete-amount-input').value = ""; document.getElementById('complete-fee-type').value = "Thu phí"; document.getElementById('complete-amount-area').classList.remove('hidden'); document.getElementById('popup-complete').classList.remove('hidden'); });

        nvTaskBox.appendChild(cardNode);
    });

    if (!hasTask) { 
        nvTaskBox.innerHTML = `<div class="text-center py-20 text-slate-400 dark:text-slate-600 text-xs font-mono"><i class="fa fa-folder-open text-2xl mb-3 block text-slate-300"></i>KHÔNG CÓ BẢN GHI LỆNH VIỆC</div>`; 
    }
}

async function handleMainAction(id, type, btnEl) {
    if(btnEl) btnEl.disabled = true;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const updates = {};
            if(type === 'start') {
                updates[`tech_tasks/${id}/status`] = "in-progress"; updates[`tech_tasks/${id}/timeStart`] = getVietnamTimeString();
                updates[`tech_tasks/${id}/locInLat`] = pos.coords.latitude; updates[`tech_tasks/${id}/locInLng`] = pos.coords.longitude;
            } else if(type === 'ot-start') {
                updates[`tech_tasks/${id}/status`] = "overtime-in"; updates[`tech_tasks/${id}/timeOTStart`] = getVietnamTimeString();
                updates[`tech_tasks/${id}/locOTInLat`] = pos.coords.latitude; updates[`tech_tasks/${id}/locOTInLng`] = pos.coords.longitude;
            } else if(type === 'ot-end') {
                updates[`tech_tasks/${id}/status`] = "in-progress"; updates[`tech_tasks/${id}/timeOTEnd`] = getVietnamTimeString();
                updates[`tech_tasks/${id}/locOTOutLat`] = pos.coords.latitude; updates[`tech_tasks/${id}/locOTOutLng`] = pos.coords.longitude;
            }
            await update(ref(rtdb), updates);
        }, () => { alert("Lỗi GPS!"); if(btnEl) btnEl.disabled = false; });
    }
}

// =========================================================================
// LẮNG NGHE LỆNH VIỆC VÀ PHÂN BỔ THỐNG KÊ ĐA NHIỆM CHUẨN ROLE
// =========================================================================
function fetchAndCalculateTasks() {
    onValue(ref(rtdb, "tech_tasks"), (snapshot) => {
        allTasksCache = [];
        let nvTotal = 0, nvPending = 0, nvInProgress = 0, nvCompleted = 0;

        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const task = childSnapshot.val();
                
                const isAuthorized = (CAP_BAC_HIEN_TAI === "Trưởng nhóm" || CAP_BAC_HIEN_TAI === "Trưởng phòng") || 
                                     (task.mainStaff === TEN_NHAN_VIEN_HIEN_TAI || task.subStaff === TEN_NHAN_VIEN_HIEN_TAI);

                if (isAuthorized) {
                    allTasksCache.push({ firebaseKey: childSnapshot.key, ...task });
                    nvTotal++;
                    if (task.status === 'completed') nvCompleted++;
                    else if (task.status === 'in-progress' || task.status === 'overtime-in') nvInProgress++;
                    else if (task.status === 'pending' || task.status === 'paused') nvPending++;
                }
            });
        }

        const elTotal = document.getElementById('nv-stat-total');
        const elPending = document.getElementById('nv-stat-pending');
        const elProgress = document.getElementById('nv-stat-progress');
        const elCompleted = document.getElementById('nv-stat-completed');

        if (elTotal) elTotal.innerText = nvTotal;
        if (elPending) elPending.innerText = nvPending;
        if (elProgress) elProgress.innerText = nvInProgress;
        if (elCompleted) elCompleted.innerText = nvCompleted;

        renderTasks();
    });
}

// SUB-TAB FILTER BUTTONS
const filterButtons = document.querySelectorAll('.btn-filter');
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => { b.className = "btn-filter flex-1 px-4 py-2 rounded-lg text-xs font-semibold text-erp-subtext"; });
        btn.className = "btn-filter flex-1 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm";
        currentFilter = btn.getAttribute('data-filter'); 
        renderTasks();
    });
});

// 👉 BỔ SUNG QUAN TRỌNG: GẮN BỘ LẮNG NGHE SỰ KIỆN TỰ ĐỘNG LỌC KHI THAY ĐỔI NGÀY THÁNG
const inpStartDate = document.getElementById('filter-nv-start-date');
const inpEndDate = document.getElementById('filter-nv-end-date');
if (inpStartDate) inpStartDate.addEventListener('change', renderTasks);
if (inpEndDate) inpEndDate.addEventListener('change', renderTasks);

// MODAL POPUPS CONFIRM ACTIONS
document.getElementById('btn-confirm-pause').addEventListener('click', async () => {
    const taskId = document.getElementById('pause-task-id').value;
    const reason = document.getElementById('pause-reason-input').value.trim();
    if(!reason) return alert("Nhập lý do!");
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const updates = {};
            updates[`tech_tasks/${taskId}/status`] = "paused";
            updates[`tech_tasks/${taskId}/pauseReason`] = reason;
            updates[`tech_tasks/${taskId}/timePause`] = getVietnamTimeString();
            updates[`tech_tasks/${taskId}/locPauseLat`] = pos.coords.latitude;
            updates[`tech_tasks/${taskId}/locPauseLng`] = pos.coords.longitude;
            await update(ref(rtdb), updates); 
            document.getElementById('popup-pause').classList.add('hidden');
        });
    }
});

document.getElementById('btn-confirm-complete').addEventListener('click', () => {
    const taskId = document.getElementById('complete-task-id').value;
    const feeType = document.getElementById('complete-fee-type').value;
    const amount = document.getElementById('complete-amount-input').value.trim();
    if(feeType === 'Thu phí' && !amount) return alert("Vui lòng nhập tiền!");
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const updates = {};
            updates[`tech_tasks/${taskId}/status`] = "completed";
            updates[`tech_tasks/${taskId}/timeEnd`] = getVietnamTimeString();
            updates[`tech_tasks/${taskId}/locOutLat`] = pos.coords.latitude;
            updates[`tech_tasks/${taskId}/locOutLng`] = pos.coords.longitude;
            updates[`tech_tasks/${taskId}/actualFeeType`] = feeType;
            updates[`tech_tasks/${taskId}/actualFeeAmount`] = feeType === 'Thu phí' ? amount : 0;
            await update(ref(rtdb), updates); 
            document.getElementById('popup-complete').classList.add('hidden');
        });
    }
});

// =========================================================================
// PHẦN 6: ĐỒNG BỘ ĐỀ XUẤT VÀ THEO DÕI TRẠNG THÁI REAL-TIME
// =========================================================================
const btnTogglePropForm = document.getElementById('btn-toggle-prop-form');
const nvProposalForm = document.getElementById('nv-proposal-form');
const btnCancelProposal = document.getElementById('btn-cancel-proposal');
const btnSubmitProposal = document.getElementById('btn-submit-proposal');
const nvProposalListBox = document.getElementById('nvProposalListBox');

if (btnTogglePropForm && nvProposalForm) {
    btnTogglePropForm.addEventListener('click', () => {
        const isHidden = nvProposalForm.classList.contains('hidden');
        if (isHidden) {
            nvProposalForm.classList.remove('hidden');
            nvProposalForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            btnTogglePropForm.innerHTML = `<i class="fa fa-minus-circle"></i> Thu gọn`;
            btnTogglePropForm.className = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl active:scale-95 transition-all border border-slate-200/60 dark:border-slate-700";
        } else {
            nvProposalForm.classList.add('hidden');
            btnTogglePropForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo đề xuất`;
            btnTogglePropForm.className = "bg-blue-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-1";
            clearProposalFormInputs();
        }
    });
}

if (btnCancelProposal && btnTogglePropForm) {
    btnCancelProposal.addEventListener('click', () => {
        if (nvProposalForm) nvProposalForm.classList.add('hidden');
        btnTogglePropForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo đề xuất`;
        btnTogglePropForm.className = "bg-blue-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-1";
        clearProposalFormInputs();
    });
}

function clearProposalFormInputs() {
    const elTaskId = document.getElementById('proposal-task-id');
    const elContent = document.getElementById('proposal-content');
    if (elTaskId) elTaskId.value = ""; if (elContent) elContent.value = "";
}

if (btnSubmitProposal) {
    btnSubmitProposal.addEventListener('click', async () => { 
        const taskInput = document.getElementById('proposal-task-id').value.trim(); 
        const contentInput = document.getElementById('proposal-content').value.trim(); 
        if(!contentInput) return alert("Vui lòng điền nội dung thiết bị cần đề xuất!"); 
        try { 
            await set(push(ref(rtdb, "proposals")), { 
                staffName: TEN_NHAN_VIEN_HIEN_TAI, 
                techIdRelated: taskInput || "Không có", 
                content: contentInput, 
                createdAt: getVietnamTimeString(), 
                status: "Chờ duyệt" 
            }); 
            if (nvProposalForm) nvProposalForm.classList.add('hidden');
            if (btnTogglePropForm) {
                btnTogglePropForm.innerHTML = `<i class="fa fa-plus-circle"></i> Tạo đề xuất`;
                btnTogglePropForm.className = "bg-blue-600 text-white font-mono font-bold text-[11px] px-3.5 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-1";
            }
            clearProposalFormInputs();
            alert("Gửi đơn đề xuất vật tư thành công!"); 
        } catch (e) { alert("Lỗi gửi: " + e.message); } 
    });
}

if (nvProposalListBox) {
    onValue(ref(rtdb, "proposals"), (snapshot) => {
        nvProposalListBox.innerHTML = "";
        let hasProposal = false;

        if (snapshot.exists()) {
            let localProposals = [];
            snapshot.forEach((childSnapshot) => {
                const prop = childSnapshot.val();
                if (prop.staffName === TEN_NHAN_VIEN_HIEN_TAI) {
                    localProposals.push(prop);
                }
            });

            localProposals.reverse();

            localProposals.forEach((prop) => {
                hasProposal = true;

                let badgeClass = "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
                if (prop.status === "Đã duyệt") {
                    badgeClass = "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
                } else if (prop.status === "Từ chối") {
                    badgeClass = "text-red-500 bg-red-500/10 border-red-500/20 dark:text-red-400";
                }

                const dateDisplay = prop.createdAt ? prop.createdAt.split(' ')[0] : 'Hôm nay';

                const propCard = document.createElement('div');
                propCard.className = "p-3 bg-white dark:bg-[#1e293b] border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col gap-1.5 transition-all";
                propCard.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div class="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1.5">
                            <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400"><i class="fa fa-calendar text-[9px] mr-1"></i>${dateDisplay}</span>
                            <span>|</span>
                            <span>Mã việc: <strong class="text-blue-600 dark:text-blue-400">${prop.techIdRelated || 'Không có'}</strong></span>
                        </div>
                        <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeClass}">
                            ${prop.status || 'Chờ duyệt'}
                        </span>
                    </div>
                    <div class="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800/40">
                        ${prop.content}
                    </div>
                `;
                nvProposalListBox.appendChild(propCard);
            });
        }

        if (!hasProposal) {
            nvProposalListBox.innerHTML = `
                <div class="text-center py-8 text-slate-400 dark:text-slate-600 italic text-[10px] font-mono bg-white dark:bg-[#111827] border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <i class="fa fa-receipt text-lg mb-1.5 block text-slate-200 dark:text-slate-800"></i>Bạn chưa tạo đơn đề xuất vật tư nào.
                </div>`;
        }
    });
}

// ĐỒNG BỘ HỒ SƠ TÀI KHOẢN CÁ NHÂN VÀ THAY ĐỔI MẬT KHẨU
const btnTriggerPwdForm = document.getElementById('btn-trigger-pwd-form');
const nvPasswordForm = document.getElementById('nv-password-form');
const btnCancelPwd = document.getElementById('btn-cancel-pwd');
const btnSaveNewPwd = document.getElementById('btn-save-new-pwd');

let currentCachedPassword = ""; 
let userFirebaseNodeKey = "";    

onValue(ref(rtdb, "users"), (snapshot) => { 
    if(snapshot.exists()) { 
        snapshot.forEach((child) => { 
            const u = child.val(); 
            if(u.name === TEN_NHAN_VIEN_HIEN_TAI) { 
                userFirebaseNodeKey = child.key; 
                currentCachedPassword = u.password; 
                CAP_BAC_HIEN_TAI = u.role || "Nhân viên"; 

                const elProfName = document.getElementById('profile-name');
                const elProfRole = document.getElementById('profile-role');
                const elProfUser = document.getElementById('profile-username');
                const elProfEmail = document.getElementById('profile-email');
                const elProfAvat = document.getElementById('profile-avatar');
                
                if (elProfName) elProfName.innerText = u.name; 
                if (elProfRole) elProfRole.innerText = `Cấp bậc: ${CAP_BAC_HIEN_TAI}`; 
                if (elProfUser) elProfUser.innerText = u.username || child.key; 
                if (elProfEmail) elProfEmail.innerText = u.email || 'N/A'; 
                if (elProfAvat) elProfAvat.innerText = u.name.split(' ').pop().substring(0,2).toUpperCase(); 
            } 
        }); 
        fetchAndCalculateTasks();
    } 
});

if (btnTriggerPwdForm && nvPasswordForm) {
    btnTriggerPwdForm.addEventListener('click', () => {
        const isHidden = nvPasswordForm.classList.contains('hidden');
        if (isHidden) {
            nvPasswordForm.classList.remove('hidden');
            nvPasswordForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            btnTriggerPwdForm.innerHTML = `<i class="fa fa-chevron-up"></i> THU GỌN BẢO MẬT`;
        } else {
            nvPasswordForm.classList.add('hidden');
            btnTriggerPwdForm.innerHTML = `<i class="fa fa-key-skeleton"></i> THAY ĐỔI MẬT KHẨU BẢO MẬT`;
            clearPasswordFormInputs();
        }
    });
}

if (btnCancelPwd && btnTriggerPwdForm) {
    btnCancelPwd.addEventListener('click', () => {
        if (nvPasswordForm) nvPasswordForm.classList.add('hidden');
        btnTriggerPwdForm.innerHTML = `<i class="fa fa-key-skeleton"></i> THAY ĐỔI MẬT KHẨU BẢO MẬT`;
        clearPasswordFormInputs();
    });
}

function clearPasswordFormInputs() {
    const elOld = document.getElementById('pwd-old');
    const elNew = document.getElementById('pwd-new');
    if (elOld) elOld.value = ""; if (elNew) elNew.value = "";
}

if (btnSaveNewPwd) {
    btnSaveNewPwd.addEventListener('click', async () => {
        const oldPwd = document.getElementById('pwd-old').value.trim();
        const newPwd = document.getElementById('pwd-new').value.trim();

        if (!oldPwd || !newPwd) return alert("Vui lòng điền đầy đủ mật khẩu cũ và mật khẩu mới!");
        if (newPwd.length < 6) return alert("Mật khẩu mới phải có độ dài tối thiểu từ 6 ký tự trở lên để đảm bảo an toàn!");
        if (oldPwd !== currentCachedPassword) return alert("Mật khẩu hiện tại bạn nhập không chính xác! Vui lòng kiểm tra lại.");
        if (newPwd === currentCachedPassword) return alert("Mật khẩu mới không được trùng với mật khẩu cũ đang sử dụng!");
        if (!userFirebaseNodeKey) return alert("Hệ thống chưa xác định được khóa tài khoản, vui lòng thử lại sau giây lát!");

        try {
            const updates = {}; updates[`users/${userFirebaseNodeKey}/password`] = newPwd;
            await update(ref(rtdb), updates);
            if (nvPasswordForm) nvPasswordForm.classList.add('hidden');
            if (btnTriggerPwdForm) btnTriggerPwdForm.innerHTML = `<i class="fa fa-key-skeleton"></i> THAY ĐỔI MẬT KHẨU BẢO MẬT`;
            clearPasswordFormInputs();
            alert("Mật khẩu tài khoản làm việc của bạn đã được cập nhật thành công.");
        } catch (e) { alert("Lỗi thực thi thay đổi mật khẩu: " + e.message); }
    });
}


// =========================================================================
// REGISTER SERVICE WORKER TRÊN TRÌNH DUYỆT (DÁN VÀO CUỐI FILE NHANVIEN-LOGIC.JS)
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 👉 ĐÃ SỬA: Chuyển đổi từ '/sw.js' sang './sw.js' để nhận diện đúng thư mục GitHub Pages
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA Service Worker đã đăng ký thành công!', reg))
            .catch(err => console.log('Lỗi đăng ký PWA:', err));
    });
}
