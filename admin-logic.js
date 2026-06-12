import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, push, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

document.getElementById('ngay').valueAsDate = new Date();
const dateKey = document.getElementById('ngay').value;

// =========================================================================
// PHẦN 1: BỘ CHUYỂN TAB MENU HỆ THỐNG
// =========================================================================
const menuItems = document.querySelectorAll('.menu-item');
const tabContents = document.querySelectorAll('.tab-content');
const headerTitle = document.getElementById('header-title');

menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        menuItems.forEach(i => {
            i.classList.remove('bg-blue-600', 'text-white');
            i.classList.add('text-slate-400', 'hover:bg-slate-800', 'hover:text-white');
        });
        item.classList.add('bg-blue-600', 'text-white');
        item.classList.remove('text-slate-400', 'hover:bg-slate-800', 'hover:text-white');

        tabContents.forEach(content => content.classList.add('hidden'));
        const targetTabId = item.getAttribute('data-tab');
        document.getElementById(targetTabId).classList.remove('hidden');
        headerTitle.innerText = item.innerText.trim() + " - Trưởng Phòng Kỹ Thuật";
    });
});

// =========================================================================
// PHẦN 2: QUẢN LÝ KHÁCH HÀNG
// =========================================================================
const customerTableBody = document.getElementById('customerTableBody');
const custModal = document.getElementById('customer-modal');
const custSearchInput = document.getElementById('tech-customer-search');
const custDatalist = document.getElementById('customer-list');
const branchSelect = document.getElementById('tech-branch-select');
const customersRef = ref(rtdb, "customers");

let localCustomers = {};

document.getElementById('btn-open-customer-modal').addEventListener('click', () => {
    document.getElementById('customer-modal-title').innerHTML = `<i class="fa fa-user-plus mr-2 text-blue-400"></i>Hồ sơ khách hàng đối tác`;
    document.getElementById('btn-save-customer').innerText = "Lưu dữ liệu đối tác";
    document.getElementById('edit-cust-id').value = "";
    custModal.classList.remove('hidden');
});
document.getElementById('btn-quick-add-customer').addEventListener('click', () => {
    document.getElementById('customer-modal-title').innerHTML = `<i class="fa fa-user-plus mr-2 text-blue-400"></i>Thêm nhanh đối tác khách hàng`;
    document.getElementById('btn-save-customer').innerText = "Lưu dữ liệu đối tác";
    document.getElementById('edit-cust-id').value = "";
    custModal.classList.remove('hidden');
});

document.querySelectorAll('.btn-close-customer').forEach(btn => btn.addEventListener('click', () => { custModal.classList.add('hidden'); clearCustomerForm(); }));
function clearCustomerForm() { document.getElementById('edit-cust-id').value = ""; document.getElementById('cust-name').value = ""; document.getElementById('cust-phone').value = ""; document.getElementById('cust-address').value = ""; document.getElementById('cust-branches').value = ""; }

document.getElementById('btn-save-customer').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value.trim(); const phone = document.getElementById('cust-phone').value.trim(); const address = document.getElementById('cust-address').value.trim(); const branchesText = document.getElementById('cust-branches').value.trim(); const editId = document.getElementById('edit-cust-id').value;
    if(!name || !phone) return alert("Vui lòng điền thông tin bắt buộc!");
    const branchesArray = branchesText ? branchesText.split('\n').map(b => b.trim()).filter(b => b !== "") : [];
    try {
        let targetRef = editId ? ref(rtdb, "customers/" + editId) : push(ref(rtdb, "customers"));
        await set(targetRef, { name, phone, address: address || "N/A", branches: branchesArray });
        custModal.classList.add('hidden'); clearCustomerForm(); alert("Thành công!");
        if(!editId) { setTimeout(() => { custSearchInput.value = name; custSearchInput.dispatchEvent(new Event('input')); }, 300); }
    } catch (err) { alert("Lỗi: " + err.message); }
});

onValue(customersRef, (snapshot) => {
    customerTableBody.innerHTML = ""; if (custDatalist) custDatalist.innerHTML = ""; localCustomers = {};
    if(snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const cust = childSnapshot.val(); const custId = childSnapshot.key; localCustomers[custId] = cust;
            const branchesLi = cust.branches ? cust.branches.map(b => `<li class="list-disc ml-4 text-xs font-mono">${b}</li>`).join('') : '<span class="text-slate-400 italic">Không có chi nhánh lẻ</span>';
            const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 border-b border-slate-100 text-slate-800";
            tr.innerHTML = `<td class="border p-3 font-semibold">${cust.name}</td><td class="border p-3 font-mono text-xs">${cust.phone}</td><td class="border p-3 text-slate-600">${cust.address}</td><td class="border p-3 bg-slate-50/50"><ul>${branchesLi}</ul></td><td class="border p-2 text-center space-x-1 whitespace-nowrap"><button data-id="${custId}" class="btn-edit-cust bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">Sửa</button><button data-id="${custId}" class="btn-del-cust bg-red-50 text-red-500 px-2 py-1 rounded text-xs font-bold">Xóa</button></td>`;
            customerTableBody.appendChild(tr);
            if (custDatalist) { const opt = document.createElement('option'); opt.value = cust.name; opt.innerText = `SĐT: ${cust.phone}`; custDatalist.appendChild(opt); }
        });
    }
    document.querySelectorAll('.btn-edit-cust').forEach(btn => { btn.addEventListener('click', () => { const id = btn.getAttribute('data-id'); const cust = localCustomers[id]; document.getElementById('customer-modal-title').innerHTML = `Cập nhật hồ sơ đối tác`; document.getElementById('btn-save-customer').innerText = "Cập nhật"; document.getElementById('edit-cust-id').value = id; document.getElementById('cust-name').value = cust.name; document.getElementById('cust-phone').value = cust.phone; document.getElementById('cust-address').value = cust.address==='N/A'?'':cust.address; document.getElementById('cust-branches').value = cust.branches?cust.branches.join('\n'):''; custModal.classList.remove('hidden'); }); });
    document.querySelectorAll('.btn-del-cust').forEach(btn => { btn.addEventListener('click', async () => { if(confirm("Xóa đối tác?")) await remove(ref(rtdb, "customers/" + btn.getAttribute('data-id'))); }); });
});

custSearchInput.addEventListener('input', (e) => {
    const inputValue = e.target.value.trim(); branchSelect.innerHTML = "";
    const matchedCustId = Object.keys(localCustomers).find(id => localCustomers[id].name === inputValue);
    if (!matchedCustId) { branchSelect.innerHTML = `<option value="Trụ sở chính">Trụ sở chính (Mặc định)</option>`; return; }
    const selectedCust = localCustomers[matchedCustId]; const mainOpt = document.createElement('option'); mainOpt.value = `Trụ sở chính (${selectedCust.address})`; mainOpt.innerText = `Trụ sở chính (${selectedCust.address})`; branchSelect.appendChild(mainOpt);
    if (selectedCust.branches) { selectedCust.branches.forEach(b => { const opt = document.createElement('option'); opt.value = b; opt.innerText = b; branchSelect.appendChild(opt); }); }
});

// =========================================================================
// PHẦN 3: QUẢN LÝ CÔNG VIỆC KỸ THUẬT VÀ BỘ LỌC ĐA NĂNG REAL-TIME TÍCH HỢP DATE RANGE
// =========================================================================
const techTaskBody = document.getElementById('techTaskBody');
const taskModal = document.getElementById('task-modal');
const techTasksRef = ref(rtdb, "tech_tasks");
let localTechTasks = [];

function generateNextTaskId() {
    if (localTechTasks.length === 0) return "CV0001";
    let maxNumber = 0;
    localTechTasks.forEach(task => {
        const match = (task.techId || "").match(/^CV(\d+)$/i);
        if (match) { const num = parseInt(match[1], 10); if (num > maxNumber) maxNumber = num; }
    });
    return "CV" + (maxNumber + 1).toString().padStart(4, '0');
}

document.getElementById('btn-open-task-form').addEventListener('click', () => {
    document.getElementById('task-modal-title').innerHTML = `<i class="fa fa-gears mr-2 text-blue-400"></i>Khởi tạo phiếu công việc kỹ thuật`;
    document.getElementById('btn-add-tech-task').innerText = "Lưu phiếu việc";
    document.getElementById('edit-task-key').value = "";
    taskModal.classList.remove('hidden');
    document.getElementById('tech-id').value = generateNextTaskId();
    document.getElementById('tech-created-at').valueAsDate = new Date();
});

const closeTaskModal = () => {
    taskModal.classList.add('hidden'); document.getElementById('edit-task-key').value = ""; document.getElementById('tech-customer-search').value = ""; document.getElementById('tech-branch-select').innerHTML = `<option value="Trụ sở chính">Trụ sở chính (Mặc định)</option>`; document.getElementById('tech-type').value = "Dịch vụ"; document.getElementById('tech-priority').value = "Trung bình"; document.getElementById('tech-fee').value = ""; document.getElementById('tech-main-staff').value = ""; document.getElementById('tech-sub-staff').value = ""; document.getElementById('tech-deadline').value = ""; document.getElementById('tech-notes').value = ""; document.getElementById('tech-author').value = "";
};
document.getElementById('btn-close-task-form').addEventListener('click', closeTaskModal);
document.getElementById('btn-cancel-tech-task').addEventListener('click', closeTaskModal);

// HÀM LỌC ĐA NĂNG PHÂN TÍCH DATE RANGE NÂNG CAO
function renderFilteredTechTasks() {
    if (!techTaskBody) return;
    techTaskBody.innerHTML = "";

    // Đọc trạng thái từ các phần tử DOM trên thanh Filter
    const searchKey = (document.getElementById('filter-tech-search')?.value || "").toLowerCase().trim();
    const filterStartDate = document.getElementById('filter-tech-start-date')?.value || ""; // Định dạng YYYY-MM-DD
    const filterEndDate = document.getElementById('filter-tech-end-date')?.value || "";     // Định dạng YYYY-MM-DD
    const filterType = document.getElementById('filter-tech-type')?.value || "all";
    const filterStatus = document.getElementById('filter-tech-status')?.value || "all";
    const filterOrigin = document.getElementById('filter-tech-origin')?.value || "all";

    localTechTasks.forEach((task) => {
        // Tiêu chí 1: Tìm kiếm từ khóa (Mã CV, Khách hàng, SĐT, Địa chỉ, Nội dung)
        const matchedSearch = !searchKey || 
            (task.techId || "").toLowerCase().includes(searchKey) ||
            (task.customer || "").toLowerCase().includes(searchKey) ||
            (task.phone || "").toLowerCase().includes(searchKey) ||
            (task.address || "").toLowerCase().includes(searchKey) ||
            (task.taskContent || "").toLowerCase().includes(searchKey);

        // 👉 TIÊU CHÍ 2: Lọc khoảng ngày tạo việc (Date Range Filter)
        let matchedDateRange = true;
        
        // Chuẩn hóa chuỗi ngày của Firebase về dạng YYYY-MM-DD để so sánh chuẩn xác
        // Hỗ trợ xử lý cả 2 định dạng phổ biến: '12/6/2026' (vi-VN) hoặc '2026-06-12' (ISO)
        let taskDateStr = "";
        if (task.createdAt) {
            const datePart = task.createdAt.split(' ')[0]; // Bỏ phần giờ nếu có
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
            // Nếu phiếu việc không có ngày tháng rõ ràng mà admin đang bật bộ lọc ngày thì ẩn phiếu đó đi
            if (filterStartDate || filterEndDate) matchedDateRange = false;
        }

        // Tiêu chí 3: Lọc phân loại hình thức
        const matchedType = filterType === "all" || task.type === filterType;

        // Tiêu chí 4: Lọc trạng thái vận hành thực tế
        let matchedStatus = filterStatus === "all" || task.status === filterStatus;
        if(filterStatus === 'in-progress' && task.status === 'overtime-in') {
            matchedStatus = true; 
        }

        // Tiêu chí 5: Lọc nguồn gốc phiếu
        let matchedOrigin = true;
        if (filterOrigin === "self") matchedOrigin = task.isSelfCreated === true;
        if (filterOrigin === "admin") matchedOrigin = !task.isSelfCreated;

        // Bỏ qua nếu bất kỳ tiêu chí nào không đạt yêu cầu
        if (!matchedSearch || !matchedDateRange || !matchedType || !matchedStatus || !matchedOrigin) return;

        // Tiến hành render vẽ giao diện hàng cột
        let statusBadge = `<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold text-xs">Chờ làm</span>`;
        if(task.status === 'in-progress') statusBadge = `<span class="bg-orange-100 text-orange-600 px-2 py-1 rounded-md font-bold text-xs animate-pulse">Đang làm</span>`;
        if(task.status === 'overtime-in') statusBadge = `<span class="bg-purple-100 text-purple-600 px-2 py-1 rounded-md font-bold text-xs animate-pulse">Tăng ca</span>`;
        if(task.status === 'paused') statusBadge = `<span class="bg-red-100 text-red-600 px-2 py-1 rounded-md font-bold text-xs">Tạm ngưng</span>`;
        if(task.status === 'completed') statusBadge = `<span class="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-md font-bold text-xs">Đã xong</span>`;

        let feeDisplay = `<span class="text-slate-400">DK: ${task.fee || '0'}</span>`;
        if(task.status === 'completed' && task.actualFeeType) {
            feeDisplay = `<div class="font-bold text-emerald-600">${task.actualFeeType === 'Thu phí' ? task.actualFeeAmount + 'đ' : task.actualFeeType}</div>`;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 text-slate-800 border-b text-sm";
        tr.innerHTML = `
            <td class="border p-3 font-mono font-bold text-blue-600">${task.techId || ''}</td>
            <td class="border p-3">
                <div class="font-bold text-slate-900">${task.customer || ''}</div>
                ${task.phone ? `<div class="text-[11px] text-slate-400 font-mono mt-0.5"><i class="fa fa-phone mr-1"></i>${task.phone}</div>` : ''}
                <div class="text-xs text-slate-500 mt-0.5"><i class="fa fa-map-marker-alt text-red-400 mr-1"></i>${task.address || ''}</div>
            </td>
            <td class="border p-3 font-medium text-slate-600">${task.type || 'Dịch vụ'}</td>
            <td class="border p-3 max-w-xs truncate" title="${task.taskContent || ''}">${task.taskContent || '-'}</td>
            <td class="border p-3">
                <div class="font-medium text-slate-700"><i class="fa fa-user-gear mr-1 text-slate-400"></i>${task.mainStaff} ${task.isSelfCreated ? '<span class="text-[10px] text-purple-500 font-bold">(Tự tạo)</span>' : ''}</div>
                <div class="text-xs text-slate-400">Hỗ trợ: ${task.subStaff || '-'}</div>
            </td>
            <td class="border p-3 font-mono text-xs">${feeDisplay}</td>
            <td class="border p-3 text-center">${statusBadge}</td>
            <td class="border p-3 text-center font-bold text-xs">${task.priority}</td>
            <td class="border p-2 text-center space-x-1 whitespace-nowrap">
                <button data-key="${task.firebaseKey}" class="btn-edit-tech bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1.5 rounded text-xs font-bold">Sửa</button>
                <button data-key="${task.firebaseKey}" class="btn-del-tech bg-red-50 text-red-500 hover:bg-red-100 px-2 py-1.5 rounded text-xs font-bold">Xóa</button>
            </td>
        `;
        techTaskBody.appendChild(tr);

        let logsHtml = `<div><strong>Tạo phiếu:</strong> ${task.createdAt} | <strong>Bởi:</strong> ${task.author}</div>`;
        if(task.timeStart) logsHtml += `<div><strong class="text-orange-500">➔ Giờ Vào:</strong> ${task.timeStart}</div>`;
        if(task.timePause) logsHtml += `<div><strong class="text-red-500">➔ Giờ Tạm ngưng:</strong> ${task.timePause} <span class="ml-2 text-red-600 font-bold">(Lý do: ${task.pauseReason || 'Không có'})</span></div>`;
        if(task.timeOTStart) logsHtml += `<div><strong class="text-purple-500">➔ Giờ Vào Tăng Ca:</strong> ${task.timeOTStart}</div>`;
        if(task.timeOTEnd) logsHtml += `<div><strong class="text-purple-700">➔ Giờ Ra Tăng Ca:</strong> ${task.timeOTEnd}</div>`;
        if(task.timeEnd) logsHtml += `<div><strong class="text-emerald-500">➔ Giờ Ra (Nghiệm thu):</strong> ${task.timeEnd}</div>`;

        let gpsLinks = [];
        if(task.locInLat) gpsLinks.push(`<a href="http://maps.google.com/?q=${task.locInLat},${task.locInLng}" target="_blank" class="text-blue-600 font-bold hover:underline"><i class="fa fa-location-arrow text-orange-500 mr-0.5"></i>Bản đồ Vào</a>`);
        if(task.locPauseLat) gpsLinks.push(`<a href="http://maps.google.com/?q=${task.locPauseLat},${task.locPauseLng}" target="_blank" class="text-red-500 font-bold hover:underline"><i class="fa fa-map-pin text-red-500 mr-0.5"></i>Bản đồ Tạm Ngưng</a>`);
        if(task.locOTInLat) gpsLinks.push(`<a href="http://maps.google.com/?q=${task.locOTInLat},${task.locOTInLng}" target="_blank" class="text-purple-500 font-bold hover:underline"><i class="fa fa-angles-right text-purple-500 mr-0.5"></i>Bản đồ Vào Tăng Ca</a>`);
        if(task.locOTOutLat) gpsLinks.push(`<a href="http://maps.google.com/?q=${task.locOTOutLat},${task.locOTOutLng}" target="_blank" class="text-purple-700 font-bold hover:underline"><i class="fa fa-stop text-purple-700 mr-0.5"></i>Bản đồ Ra Tăng Ca</a>`);
        if(task.locOutLat) gpsLinks.push(`<a href="http://maps.google.com/?q=${task.locOutLat},${task.locOutLng}" target="_blank" class="text-emerald-600 font-bold hover:underline"><i class="fa fa-circle-check text-emerald-500 mr-0.5"></i>Bản đồ Ra</a>`);

        const trN = document.createElement('tr'); trN.className = "bg-slate-50/50 text-xs text-slate-500";
        trN.innerHTML = `
            <td colspan="9" class="border p-2 px-4 space-y-1">
                ${logsHtml}
                ${gpsLinks.length > 0 ? `<div class="pt-1 border-t border-dashed border-slate-200 flex gap-4">${gpsLinks.join('')}</div>` : ''}
                ${task.notes ? `<div class="text-slate-400 italic"><strong>Ghi chú:</strong> ${task.notes}</div>` : ''}
            </td>
        `;
        techTaskBody.appendChild(trN);
    });

    bindTechActionButtons();
}

// BỘ LẮNG NGHE ĐÁM MÂY REAL-TIME (Giữ nguyên mảng cache localTechTasks)
onValue(techTasksRef, (snapshot) => {
    localTechTasks = [];
    let tTotal = 0, tComp = 0, tProg = 0, tPend = 0;

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            localTechTasks.push({ firebaseKey: childSnapshot.key, ...childSnapshot.val() });
        });
        localTechTasks.sort((a, b) => (b.techId || "").toString().toUpperCase().localeCompare((a.techId || "").toString().toUpperCase()));

        localTechTasks.forEach((task) => {
            tTotal++;
            if(task.status === 'completed') tComp++;
            else if(task.status === 'in-progress' || task.status === 'overtime-in') tProg++;
            else tPend++;
        });
    }

    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = tTotal;
    if(document.getElementById('stat-completed')) document.getElementById('stat-completed').innerText = tComp;
    if(document.getElementById('stat-progress')) document.getElementById('stat-progress').innerText = tProg;
    if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = tPend;

    renderTasksWithFilters();
});

// 👉 RÀNG BUỘC THÊM SỰ KIỆN LẮNG NGHE CHO 2 Ô DATE MỚI BỔ SUNG[cite: 2]
function renderTasksWithFilters() {
    renderFilteredTechTasks();
    
    const inpSearch = document.getElementById('filter-tech-search');
    const inpStartDate = document.getElementById('filter-tech-start-date'); // Phần tử mới
    const inpEndDate = document.getElementById('filter-tech-end-date');     // Phần tử mới
    const selType = document.getElementById('filter-tech-type');
    const selStatus = document.getElementById('filter-tech-status');
    const selOrigin = document.getElementById('filter-tech-origin');

    if (inpSearch && !inpSearch.dataset.hasEvent) {
        inpSearch.dataset.hasEvent = "true";
        inpSearch.addEventListener('input', renderFilteredTechTasks);
        
        // Gắn sự kiện lắng nghe thay đổi tự động cho bộ ngày tháng[cite: 2]
        if (inpStartDate) inpStartDate.addEventListener('change', renderFilteredTechTasks);
        if (inpEndDate) inpEndDate.addEventListener('change', renderFilteredTechTasks);
        
        if (selType) selType.addEventListener('change', renderFilteredTechTasks);
        if (selStatus) selStatus.addEventListener('change', renderFilteredTechTasks);
        if (selOrigin) selOrigin.addEventListener('change', renderFilteredTechTasks);
    }
}

function bindTechActionButtons() {
    document.querySelectorAll('.btn-edit-tech').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key'); const task = localTechTasks.find(t => t.firebaseKey === key);
            document.getElementById('task-modal-title').innerHTML = `Cập nhật phiếu công việc kỹ thuật`;
            document.getElementById('btn-add-tech-task').innerText = "Cập nhật thay đổi";
            document.getElementById('edit-task-key').value = key;
            document.getElementById('tech-id').value = task.techId;
            document.getElementById('tech-created-at').value = task.createdAt;
            document.getElementById('tech-customer-search').value = task.customer;
            document.getElementById('tech-customer-search').dispatchEvent(new Event('input'));
            document.getElementById('tech-branch-select').value = task.address;
            document.getElementById('tech-type').value = task.type || 'Dịch vụ';
            document.getElementById('tech-priority').value = task.priority;
            document.getElementById('tech-fee').value = task.fee || '';
            document.getElementById('tech-main-staff').value = task.mainStaff;
            document.getElementById('tech-sub-staff').value = task.subStaff === 'Không có' ? '' : task.subStaff;
            document.getElementById('tech-deadline').value = task.deadline === 'Không giới hạn' ? '' : task.deadline;
            document.getElementById('tech-notes').value = task.notes || '';
            if (document.getElementById('tech-content-detail')) {
                document.getElementById('tech-content-detail').value = task.taskContent || '';
            }
            document.getElementById('tech-author').value = task.author;
            taskModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.btn-del-tech').forEach(btn => {
        btn.addEventListener('click', async () => {
            if(confirm("Xác nhận xóa phiếu công việc này vĩnh viễn?")) {
                await remove(ref(rtdb, "tech_tasks/" + btn.getAttribute('data-key')));
            }
        });
    });
}
// =========================================================================
// PHẦN 4 & 5: THÔNG TIN CHUNG & NHÂN SỰ
// =========================================================================
const reportRef = ref(rtdb, "daily_reports/" + dateKey);
onValue(reportRef, (snapshot) => { if (snapshot.exists()) { const data = snapshot.val(); if(data.truongphong) document.getElementById('truongphong').value = data.truongphong; if(data.muctieu) document.getElementById('muctieu').value = data.muctieu; if(data.ketqua) document.getElementById('ketqua').value = data.ketqua; if(data.suco) document.getElementById('suco').value = data.suco; } });
document.getElementById('btn-save').addEventListener('click', async () => { await set(ref(rtdb, "daily_reports/" + document.getElementById('ngay').value), { truongphong: document.getElementById('truongphong').value, muctieu: document.getElementById('muctieu').value, ketqua: document.getElementById('ketqua').value, suco: document.getElementById('suco').value }); alert("Đã đồng bộ!"); });

const userBody = document.getElementById('userBody'); const userModal = document.getElementById('user-modal'); const staffDatalist = document.getElementById('staff-list');
document.getElementById('btn-open-user-form').addEventListener('click', () => userModal.classList.remove('hidden'));
const closeUserModal = () => { userModal.classList.add('hidden'); document.getElementById('new-user-name').value = ""; document.getElementById('new-user-email').value = ""; document.getElementById('new-user-username').value = ""; document.getElementById('new-user-password').value = ""; };
if (document.getElementById('btn-close-user-form')) document.getElementById('btn-close-user-form').addEventListener('click', closeUserModal); 
if (document.getElementById('btn-cancel-user')) document.getElementById('btn-cancel-user').addEventListener('click', closeUserModal);

onValue(ref(rtdb, "users"), (snapshot) => { 
    userBody.innerHTML = ""; if (staffDatalist) staffDatalist.innerHTML = "";
    if (snapshot.exists()) { 
        snapshot.forEach((childSnapshot) => { 
            const userData = childSnapshot.val(); const userId = childSnapshot.key; const tr = document.createElement('tr'); 
            tr.className = "hover:bg-slate-50 border-b border-slate-100 text-slate-800 text-sm";
            tr.innerHTML = `<td class="border p-2"><input type="text" value="${userData.name}" data-id="${userId}" class="edit-user-name bg-transparent border-b border-transparent w-full font-medium focus:bg-white p-1 rounded"></td><td class="border p-2 text-slate-600">${userData.email || 'N/A'}</td><td class="border p-2 font-mono text-slate-700">${userData.username}</td><td class="border p-2 font-mono text-slate-600">${userData.password}</td><td class="border p-2 text-center"><select data-id="${userId}" class="edit-user-role p-1 border rounded text-xs bg-white"><option value="Nhân viên" ${userData.role==='Nhân viên'?'selected':''}>Nhân viên</option><option value="Trưởng nhóm" ${userData.role==='Trưởng nhóm'?'selected':''}>Trưởng nhóm</option><option value="Trưởng phòng" ${userData.role==='Trưởng phòng'?'selected':''}>Trưởng phòng</option></select></td><td class="border p-2 text-center space-x-1 whitespace-nowrap"><button data-id="${userId}" class="btn-update-user bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">Sửa</button><button data-id="${userId}" class="btn-del-user bg-red-50 text-red-500 px-2 py-1 rounded text-xs font-bold">Xóa</button></td>`; 
            userBody.appendChild(tr); 
            if (staffDatalist) { const opt = document.createElement('option'); opt.value = userData.name; opt.innerText = `Chức vụ: ${userData.role}`; staffDatalist.appendChild(opt); }
        }); 
    }
    document.querySelectorAll('.btn-update-user').forEach(btn => { btn.addEventListener('click', async () => { const id = btn.getAttribute('data-id'); const inputName = document.querySelector(`.edit-user-name[data-id="${id}"]`).value.trim(); const selectRole = document.querySelector(`.edit-user-role[data-id="${id}"]`).value; const updates = {}; updates[`users/${id}/name`] = inputName; updates[`users/${id}/role`] = selectRole; await update(ref(rtdb), updates); alert("Thành công!"); }); });
    document.querySelectorAll('.btn-del-user').forEach(btn => { btn.addEventListener('click', async () => { if(confirm("Xóa nhân sự vĩnh viễn?")) await remove(ref(rtdb, "users/" + btn.getAttribute('data-id'))); }); }); 
});

async function handleAddUserFromForm() { 
    const nameInput = document.getElementById('new-user-name'); const emailInput = document.getElementById('new-user-email'); const usernameInput = document.getElementById('new-user-username'); const passwordInput = document.getElementById('new-user-password'); const roleInput = document.getElementById('new-user-role'); const username = usernameInput.value.trim().toLowerCase(); 
    if (!nameInput.value.trim() || !username || !passwordInput.value.trim()) return alert("Thiếu trường bắt buộc!"); 
    try { await set(ref(rtdb, "users/" + username), { name: nameInput.value.trim(), email: emailInput.value.trim() || "N/A", username: username, password: passwordInput.value.trim(), role: roleInput.value, createdAt: new Date().toISOString() }); closeUserModal(); alert("Thành công!"); } catch (err) { alert("Lỗi: " + err.message); }
} 
const btnAddUserEl = document.getElementById('btn-add-user');
if (btnAddUserEl) btnAddUserEl.addEventListener('click', handleAddUserFromForm);
// =========================================================================
// PHẦN 6: QUẢN LÝ QUY TRÌNH ĐỀ XUẤT VẬT TƯ (TỰ TẠO & PHÊ DUYỆT REAL-TIME)
// =========================================================================

// 1. Trưởng phòng tự lập phiếu đề xuất cấp phát linh kiện ngoài danh mục
const btnAdminSubmitProp = document.getElementById('btn-admin-submit-proposal');
if (btnAdminSubmitProp) {
    btnAdminSubmitProp.addEventListener('click', async () => {
        const taskIdInput = document.getElementById('admin-prop-task-id').value.trim();
        const contentInput = document.getElementById('admin-prop-content').value.trim();

        if (!contentInput) return alert("Vui lòng điền nội dung thiết bị cần đề xuất!");

        try {
            const proposalsRef = ref(rtdb, "proposals");
            await set(push(proposalsRef), {
                staffName: "Trưởng phòng (Quản trị)",
                techIdRelated: taskIdInput || "Không có",
                content: contentInput,
                createdAt: getVietnamTimeString ? getVietnamTimeString() : new Date().toLocaleString("vi-VN"),
                status: "Đã duyệt" // Phiếu của Trưởng phòng lập mặc định chuyển trạng thái Đã duyệt luôn
            });

            document.getElementById('admin-prop-task-id').value = "";
            document.getElementById('admin-prop-content').value = "";
            alert("Đã khởi tạo và thông qua phiếu đề xuất cung ứng vật tư thành công!");
        } catch (e) {
            alert("Lỗi lưu đề xuất: " + e.message);
        }
    });
}

// 2. Lắng nghe Real-time danh sách đề xuất từ node 'proposals' để phê duyệt công tác
const adminProposalTableBody = document.getElementById('adminProposalTableBody');
if (adminProposalTableBody) {
    onValue(ref(rtdb, "proposals"), (snapshot) => {
        adminProposalTableBody.innerHTML = "";
        let hasProposal = false;

        if (snapshot.exists()) {
            let proposalsArray = [];
            snapshot.forEach((childSnapshot) => {
                proposalsArray.push({
                    firebaseKey: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });

            // Sắp xếp đề xuất mới nhất lên trên cùng bảng
            proposalsArray.reverse();

            proposalsArray.forEach((prop) => {
                hasProposal = true;

                // Cấu hình màu sắc nhãn trạng thái phê duyệt
                let statusBadge = `<span class="bg-amber-50 text-amber-600 border border-amber-200/60 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono">Chờ duyệt</span>`;
                if (prop.status === "Đã duyệt") {
                    statusBadge = `<span class="bg-emerald-50 text-emerald-600 border border-emerald-200/60 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono">Đã thông qua</span>`;
                } else if (prop.status === "Từ chối") {
                    statusBadge = `<span class="bg-red-50 text-red-600 border border-red-200/60 px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono">Từ chối</span>`;
                }

                // Thiết lập bộ nút thao tác động dựa theo trạng thái
                let actionButtons = "";
                if (prop.status === "Chờ duyệt") {
                    actionButtons = `
                        <div class="flex items-center justify-center gap-1.5 font-mono text-[11px]">
                            <button data-key="${prop.firebaseKey}" data-action="approve" class="btn-prop-action bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-emerald-700 transition active:scale-95 shadow-sm">Duyệt</button>
                            <button data-key="${prop.firebaseKey}" data-action="reject" class="btn-prop-action bg-red-500 text-white px-3 py-1 rounded-lg font-bold hover:bg-red-600 transition active:scale-95 shadow-sm">Bác</button>
                        </div>
                    `;
                } else {
                    // Nếu phiếu đã duyệt hoặc từ chối, hiện nút Xóa để admin dọn dẹp kho dữ liệu cũ khi cần
                    actionButtons = `
                        <div class="text-center font-mono">
                            <button data-key="${prop.firebaseKey}" data-action="delete" class="btn-prop-action text-slate-400 hover:text-red-500 text-xs font-bold transition"><i class="fa fa-trash-can"></i> Xóa phiếu</button>
                        </div>
                    `;
                }

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50/50 border-b border-slate-100 text-slate-800 align-middle transition-colors";
                tr.innerHTML = `
                    <td class="p-3.5 pl-5 text-xs text-slate-400 font-mono font-medium">${prop.createdAt ? prop.createdAt.split(' ')[0] : 'N/A'}</td>
                    <td class="p-3.5 font-bold text-slate-900">${prop.staffName || 'Nhân viên'}</td>
                    <td class="p-3.5 font-mono font-bold text-blue-600">${prop.techIdRelated || 'Không có'}</td>
                    <td class="p-3.5 text-xs text-slate-600 leading-relaxed normal-case font-medium">${prop.content || '-'}</td>
                    <td class="p-3.5 text-center">${statusBadge}</td>
                    <td class="p-3.5 pr-5">${actionButtons}</td>
                `;
                adminProposalTableBody.appendChild(tr);
            });
        }

        if (!hasProposal) {
            adminProposalTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-slate-400 italic text-xs font-mono">
                        <i class="fa fa-folder-open text-xl mb-2 block text-slate-300"></i> Chưa nhận được phiếu đề xuất cung ứng nào từ thực địa.
                    </td>
                </tr>
            `;
        }

        // KÍCH HOẠT SỰ KIỆN CLICK CHO CÁC NÚT DUYỆT / BÁC / XÓA PHIẾU ĐỀ XUẤT
        document.querySelectorAll('.btn-prop-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const key = btn.getAttribute('data-key');
                const action = btn.getAttribute('data-action');
                const proposalRef = ref(rtdb, `proposals/${key}`);

                try {
                    if (action === "approve") {
                        await update(proposalRef, { status: "Đã duyệt" });
                    } else if (action === "reject") {
                        if (confirm("Xác nhận bác bỏ yêu cầu cấp phát vật tư này?")) {
                            await update(proposalRef, { status: "Từ chối" });
                        }
                    } else if (action === "delete") {
                        if (confirm("Xóa bản ghi lưu trữ đề xuất này khỏi hệ thống quản trị?")) {
                            await remove(proposalRef);
                        }
                    }
                } catch (e) {
                    alert("Lỗi thực thi phê duyệt: " + e.message);
                }
            });
        });
    });
}