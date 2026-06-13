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
const GEO_OPTIONS = {
    enableHighAccuracy: true, 
    timeout: 15000, 
    maximumAge: 0 // ÉP LẤY GPS MỚI, KHÔNG DÙNG DỮ LIỆU CŨ (CACHE)
};

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
                fee: "Chờ nghiệm thu", mainStaff: TEN_NHAN_VIEN_HIEN_TAI, subStaff: "Không có",
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
    const taskList = document.getElementById('task-list');
    if (taskList) {
        taskList.innerHTML = "";
        allTasksCache.forEach(task => {
            const option = document.createElement('option');
            // Nhân viên có thể gõ mã hoặc tên khách hàng để tìm
            option.value = task.techId; 
            option.textContent = `${task.customer}`; // Hiển thị tên khách hàng để dễ nhận biết
            taskList.appendChild(option);
        });
    }

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
            actionButtonsHtml = `<button class="btn-main-start w-full mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl text-xs font-mono tracking-wider shadow-md flex items-center justify-center gap-2">
    <i class="fa-solid fa-person-running"></i>
    BẮT ĐẦU CÔNG VIỆC
</button>`;
        } else if (task.status === 'in-progress') {
            borderIndicator = "border-l-[4px] border-l-blue-600"; statusText = "Đang làm";
            statusColor = "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-900/50";
            actionButtonsHtml = `
                <div class="grid grid-cols-2 gap-2.5 mt-3 font-mono text-[11px]">
                    <button class="btn-main-pause bg-red-800 hover:bg-red-700 text-red-100 font-bold py-2.5 rounded-xl border border-red-700 flex items-center justify-center gap-2">
    <i class="fas fa-pause"></i>
    TẠM NGƯNG
</button>
                    <button class="btn-main-ot-start bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 font-bold py-2.5 rounded-xl border border-purple-200 dark:border-purple-900/50">
    <i class="fa fa-clock mr-1"></i>TĂNG CA
</button>
                </div>
                <button class="btn-main-complete w-full mt-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-3 rounded-xl text-xs font-mono tracking-wider shadow-md flex items-center justify-center gap-2">
    <i class="fa fa-check-circle"></i>
    HOÀN THÀNH
</button>
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
    renderOvertimeList();
}

async function handleMainAction(id, type, btnEl) {
    if (type === 'ot-start') {
        // Mở popup thay vì cập nhật Firebase ngay
        document.getElementById('ot-task-id').value = id; 
        document.getElementById('ot-reason-input').value = ""; 
        document.getElementById('popup-ot').classList.remove('hidden');
    } else {
        // Kiểm tra xem trình duyệt có hỗ trợ GPS không
        if (!navigator.geolocation) {
            return alert("Trình duyệt của bạn không hỗ trợ định vị GPS!");
        }

        if(btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ĐANG LẤY VỊ TRÍ...`;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const updates = {};
                if(type === 'start') {
                    updates[`tech_tasks/${id}/status`] = "in-progress"; 
                    updates[`tech_tasks/${id}/timeStart`] = getVietnamTimeString();
                    updates[`tech_tasks/${id}/locInLat`] = pos.coords.latitude; 
                    updates[`tech_tasks/${id}/locInLng`] = pos.coords.longitude;
                } else if(type === 'ot-end') {
                    updates[`tech_tasks/${id}/status`] = "in-progress"; 
                    updates[`tech_tasks/${id}/timeOTEnd`] = getVietnamTimeString();
                    updates[`tech_tasks/${id}/locOTOutLat`] = pos.coords.latitude; 
                    updates[`tech_tasks/${id}/locOTOutLng`] = pos.coords.longitude;
                }
                await update(ref(rtdb), updates);
                alert("Cập nhật thành công!");
            } catch (error) {
                alert("Lỗi lưu dữ liệu: " + error.message);
            } finally {
                if(btnEl) {
                    btnEl.disabled = false;
                    btnEl.innerHTML = type === 'start' ? `<i class="fa-solid fa-person-running"></i> BẮT ĐẦU CÔNG VIỆC` : `RA TĂNG CA`;
                }
            }
        }, (err) => {
            alert("Không thể lấy GPS: " + err.message + ". Vui lòng bật định vị trên thiết bị.");
            if(btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = type === 'start' ? `<i class="fa-solid fa-person-running"></i> BẮT ĐẦU CÔNG VIỆC` : `RA TĂNG CA`;
            }
        }, GEO_OPTIONS);
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
        // Truyền GEO_OPTIONS vào tham số thứ 3
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const updates = {};
            updates[`tech_tasks/${taskId}/status`] = "paused";
            updates[`tech_tasks/${taskId}/pauseReason`] = reason;
            updates[`tech_tasks/${taskId}/timePause`] = getVietnamTimeString();
            updates[`tech_tasks/${taskId}/locPauseLat`] = pos.coords.latitude;
            updates[`tech_tasks/${taskId}/locPauseLng`] = pos.coords.longitude;
            
            await update(ref(rtdb), updates); 
            document.getElementById('popup-pause').classList.add('hidden');
            alert("Đã cập nhật trạng thái tạm ngưng!");
        }, (err) => {
            alert("Lỗi lấy vị trí: " + err.message + ". Vui lòng bật GPS!");
        }, GEO_OPTIONS);
    } else {
        alert("Trình duyệt không hỗ trợ định vị!");
    }
});
document.getElementById('btn-confirm-complete').addEventListener('click', () => {
    const taskId = document.getElementById('complete-task-id').value;
    const feeType = document.getElementById('complete-fee-type').value;
    const amount = document.getElementById('complete-amount-input').value.trim();
    
    if(feeType === 'Thu phí' && !amount) return alert("Vui lòng nhập tiền!");
    
    if (navigator.geolocation) {
        // Truyền GEO_OPTIONS vào tham số thứ 3
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
            alert("Công việc đã hoàn thành!");
        }, (err) => {
            alert("Lỗi lấy vị trí: " + err.message + ". Vui lòng bật GPS!");
        }, GEO_OPTIONS);
    } else {
        alert("Trình duyệt không hỗ trợ định vị!");
    }
});

// =========================================================================
// PHẦN 6: ĐỒNG BỘ ĐỀ XUẤT VÀ THEO DÕI TRẠNG THÁI REAL-TIME
// =========================================================================
// =========================================================================
// PHẦN 6: QUẢN LÝ QUY TRÌNH ĐỀ XUẤT (VẬT TƯ, XĂNG XE, TẠM ỨNG)
// =========================================================================
const btnTogglePropForm = document.getElementById('btn-toggle-prop-form');
const nvProposalForm = document.getElementById('nv-proposal-form');
const btnCancelProposal = document.getElementById('btn-cancel-proposal');
const btnSubmitProposal = document.getElementById('btn-submit-proposal');
const nvProposalListBox = document.getElementById('nvProposalListBox');
const proposalTypeSelect = document.getElementById('proposal-type');

// 1. Ẩn/Hiện form
btnTogglePropForm?.addEventListener('click', () => nvProposalForm?.classList.toggle('hidden'));
btnCancelProposal?.addEventListener('click', () => {
    nvProposalForm?.classList.add('hidden');
    clearProposalFormInputs();
});

// 2. Ẩn/Hiện các vùng nhập liệu tùy theo loại đề xuất
proposalTypeSelect?.addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('area-prop-vattu')?.classList.toggle('hidden', type !== "Vật tư");
    document.getElementById('area-prop-xangxe')?.classList.toggle('hidden', type !== "Xăng xe");
    document.getElementById('area-prop-tamung')?.classList.toggle('hidden', type !== "Tạm ứng");
});

// 3. Tự động tính tổng KM
const kmStart = document.getElementById('proposal-km-start');
const kmEnd = document.getElementById('proposal-km-end');
const kmTotal = document.getElementById('proposal-km-total');

[kmStart, kmEnd].forEach(el => el?.addEventListener('input', () => {
    const total = (parseFloat(kmEnd.value) || 0) - (parseFloat(kmStart.value) || 0);
    if (kmTotal) kmTotal.value = (total > 0 ? total : 0) + " KM";
}));

// 4. Hàm gửi đề xuất
btnSubmitProposal?.addEventListener('click', async () => {
    const type = proposalTypeSelect.value;
    const taskId = document.getElementById('proposal-task-id').value.trim();
    let content = "";

    if (type === "Vật tư") {
        content = `[VẬT TƯ]: ${document.getElementById('proposal-content').value}`;
    } else if (type === "Xăng xe") {
        content = `[XĂNG XE]: ${document.getElementById('proposal-km-total').value} (Từ: ${kmStart.value}km - Đến: ${kmEnd.value}km)`;
    } else {
        content = `[TẠM ỨNG]: ${document.getElementById('proposal-advance-amount').value} VNĐ - Lý do: ${document.getElementById('proposal-advance-reason').value}`;
    }

    if (!content.includes(": ")) return alert("Vui lòng điền đầy đủ nội dung!");

    try {
        await set(push(ref(rtdb, "proposals")), {
            staffName: TEN_NHAN_VIEN_HIEN_TAI,
            techIdRelated: taskId || "Không có",
            content: content,
            createdAt: getVietnamTimeString(),
            status: "Chờ duyệt"
        });
        alert("Gửi đơn đề xuất thành công!");
        nvProposalForm.classList.add('hidden');
        clearProposalFormInputs();
    } catch (e) { alert("Lỗi gửi: " + e.message); }
});

function clearProposalFormInputs() {
    document.getElementById('proposal-task-id').value = "";
    document.getElementById('proposal-content').value = "";
    document.getElementById('proposal-km-start').value = "";
    document.getElementById('proposal-km-end').value = "";
    document.getElementById('proposal-km-total').value = "0 KM";
    document.getElementById('proposal-advance-amount').value = "";
    document.getElementById('proposal-advance-reason').value = "";
}

function renderOvertimeList() {
    const otContainer = document.getElementById('ot-list-container');
    if (!otContainer) return;
    
    otContainer.innerHTML = "";
    // Lọc các task có tồn tại dữ liệu tăng ca
    const otTasks = allTasksCache.filter(t => t.timeOTStart);

    if (otTasks.length === 0) {
        otContainer.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs italic">Chưa có ca tăng ca nào.</div>`;
        return;
    }

    otTasks.reverse().forEach(task => {
        // CÁCH TÍNH AN TOÀN: Kiểm tra dữ liệu trước khi xử lý
        let startTime = "---";
        let endTime = "---";
        let duration = "Đang tính...";

        if (task.timeOTStart) {
            // Lấy giờ phút từ chuỗi (giả định chuỗi có dạng "HH:mm:ss" hoặc "DD/MM/YYYY, HH:mm:ss")
            startTime = task.timeOTStart.includes(',') ? task.timeOTStart.split(', ')[1].substring(0, 5) : task.timeOTStart;
        }
        
        if (task.timeOTEnd) {
            endTime = task.timeOTEnd.includes(',') ? task.timeOTEnd.split(', ')[1].substring(0, 5) : task.timeOTEnd;
            duration = calculateHours(task.timeOTStart, task.timeOTEnd);
        }

        const status = task.otStatus || "Chờ duyệt"; 
        const statusColor = status === "Đã duyệt" ? "text-emerald-400" : "text-amber-400";

        const div = document.createElement('div');
        div.className = "p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs space-y-2";
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-bold text-purple-400">Mã: ${task.techId}</span>
                <span class="font-bold ${statusColor} uppercase">${status}</span>
            </div>
            <div class="text-slate-600 dark:text-slate-300">Khách: ${task.customer}</div>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                <div>BĐ: ${startTime}</div>
                <div>KT: ${endTime}</div>
            </div>
            <div class="text-[11px] font-bold text-blue-400 border-t border-slate-700 pt-1 mt-1">
                Tổng cộng: ${duration}
            </div>
        `;
        otContainer.appendChild(div);
    });
}
// 5. Lắng nghe danh sách đề xuất
onValue(ref(rtdb, "proposals"), (snapshot) => {
    if (!nvProposalListBox) return;
    nvProposalListBox.innerHTML = "";
    
    if (snapshot.exists()) {
        let proposals = [];
        snapshot.forEach(child => {
            const p = child.val();
            // Lưu lại child.key vào thuộc tính firebaseKey để dùng khi xóa
            if (p.staffName === TEN_NHAN_VIEN_HIEN_TAI) {
                proposals.push({ ...p, firebaseKey: child.key });
            }
        });
        
        proposals.reverse().forEach(p => {
    let badgeClass = p.status === "Đã duyệt" ? "text-emerald-600 bg-emerald-500/10" : 
                     p.status === "Từ chối" ? "text-red-500 bg-red-500/10" : "text-amber-600 bg-amber-500/10";
    
    // Nút xóa (Icon thùng rác)
    const deleteBtn = p.status === "Chờ duyệt" 
        ? `<button onclick="deleteProposal('${p.firebaseKey}')" class="text-red-500 hover:text-red-700 p-1 transition-all" title="Xóa">
             <i class="fa fa-trash-can text-[11px]"></i>
           </button>` 
        : "";

    const div = document.createElement('div');
    // Thay bg-white bằng bg-white dark:bg-[#111827]
    div.className = "p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs space-y-1";
    div.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="font-bold text-blue-600 dark:text-blue-400">Mã: ${p.techIdRelated}</span>
            <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}">${p.status}</span>
                ${deleteBtn}
            </div>
        </div>
        <div class="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#090d16] p-2 rounded-lg border border-slate-100 dark:border-slate-800">
            ${p.content}
        </div>
        <div class="text-[9px] text-slate-400 font-mono">${p.createdAt}</div>
    `;
            nvProposalListBox.appendChild(div);
        });
    } else {
        nvProposalListBox.innerHTML = `<div class="text-center py-4 text-slate-400 text-xs italic">Chưa có đề xuất nào.</div>`;
    }
});
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


window.deleteProposal = async (firebaseKey) => {
    if (confirm("Bạn có chắc chắn muốn hủy đơn đề xuất này?")) {
        try {
            // Xóa trực tiếp trên Firebase dựa vào key đã lưu
            await set(ref(rtdb, "proposals/" + firebaseKey), null);
            alert("Đã xóa đề xuất thành công!");
        } catch (e) {
            alert("Lỗi khi xóa: " + e.message);
        }
    }
};

function calculateHours(startStr, endStr) {
    if (!startStr || !endStr) return "0 giờ";

    // Hàm chuyển chuỗi "HH:mm:ss DD/MM/YYYY" hoặc tương tự thành Date object
    const parseCustomDate = (str) => {
        // Tách phần thời gian và ngày
        const parts = str.split(' ');
        const timePart = parts[0]; // "19:34:28"
        const datePart = parts[1]; // "13/6/2026"
        
        const [h, m, s] = timePart.split(':');
        const [d, mo, y] = datePart.split('/');
        
        // Lưu ý: tháng trong JS bắt đầu từ 0 (tháng 6 là 5)
        return new Date(y, mo - 1, d, h, m, s);
    };

    const start = parseCustomDate(startStr);
    const end = parseCustomDate(endStr);
    
    const diffMs = end - start;
    if (diffMs < 0) return "Lỗi giờ";
    
    const diffHrs = (diffMs / (1000 * 60 * 60)).toFixed(1);
    return diffHrs + " giờ";
}

document.getElementById('btn-confirm-ot').addEventListener('click', async () => {
    const taskId = document.getElementById('ot-task-id').value;
    const reason = document.getElementById('ot-reason-input').value.trim();
    
    if(!reason) return alert("Vui lòng nhập lý do tăng ca!");
    
    if (navigator.geolocation) {
        // Truyền GEO_OPTIONS vào đây
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const updates = {};
            updates[`tech_tasks/${taskId}/status`] = "overtime-in";
            updates[`tech_tasks/${taskId}/timeOTStart`] = getVietnamTimeString();
            updates[`tech_tasks/${taskId}/otReason`] = reason;
            updates[`tech_tasks/${taskId}/locOTInLat`] = pos.coords.latitude;
            updates[`tech_tasks/${taskId}/locOTInLng`] = pos.coords.longitude;
            
            await update(ref(rtdb), updates); 
            document.getElementById('popup-ot').classList.add('hidden');
            alert("Đã bắt đầu tăng ca!");
        }, (err) => {
            alert("Lỗi GPS: " + err.message);
        }, GEO_OPTIONS); // <--- Sử dụng biến toàn cục ở đây
    }
});
