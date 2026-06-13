import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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

const btnLoginAdmin = document.getElementById('btn-login-admin');

if (btnLoginAdmin) {
    btnLoginAdmin.addEventListener('click', () => {
        const userInput = document.getElementById('login-user').value.trim();
        const pwdInput = document.getElementById('login-pwd').value.trim();

        if (!userInput || !pwdInput) {
            return alert("Vui lòng nhập đầy đủ Tên tài khoản và Mật khẩu!");
        }

        // Khóa nút bấm để tránh double-click gửi trùng request liên tục
        btnLoginAdmin.disabled = true;
        btnLoginAdmin.innerText = "ĐANG XÁC THỰC...";

        // Quét kiểm tra node 'users' trên Firebase Realtime Database
        onValue(ref(rtdb, "users"), (snapshot) => {
            let loginSuccess = false;
            let targetPage = "nhanvien.html"; // Mặc định hướng trang

            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const user = child.val();
                    const dbUsername = user.username || child.key; // Fallback lấy key nếu không có trường username độc lập

                    // Đối soát tài khoản và mật khẩu trùng khớp
                    if (dbUsername === userInput && user.password === pwdInput) {
                        const userRole = user.role || "Nhân viên";

                        // 👉 CHẶN PHÂN QUYỀN CỐT LÕI: Trang loginad.html chỉ cho phép các quyền Quản trị vào hệ thống
                        if (userRole === "Trưởng phòng" || userRole === "Trưởng nhóm" || userRole === "Admin" || userRole === "Quản trị") {
                            loginSuccess = true;
                            
                            // Ghi nhớ phiên đăng nhập vào hệ thống localStorage của thiết bị
                            localStorage.setItem('logged_staff_name', user.name);
                            
                            // ĐIỀU HƯỚNG SANG TRANG TRƯỞNG PHÒNG ĐIỀU HÀNH
                            targetPage = "truongphong.html";
                        } else {
                            // Nếu là nhân viên thường cố tình vào trang này đăng nhập, hệ thống sẽ phát cảnh báo từ chối
                            alert("Tài khoản của bạn không có quyền truy cập vào Phân hệ quản lý điều hành! Vui lòng dùng trang đăng nhập của Nhân viên.");
                            btnLoginAdmin.disabled = false;
                            btnLoginAdmin.innerHTML = `<i class="fa fa-right-to-bracket text-xs"></i> XÁC THỰC QUẢN TRỊ`;
                        }
                    }
                });

                if (loginSuccess) {
                    // Chuyển hướng sang trang quản trị truongphong.html mượt mà
                    window.location.href = targetPage;
                } else if (!btnLoginAdmin.disabled) {
                    // Nếu duyệt hết mảng mà không có cờ loginSuccess bật lên -> Sai thông tin đăng nhập
                    alert("Tên đăng nhập hoặc mật khẩu quản trị không chính xác! Vui lòng thử lại.");
                    btnLoginAdmin.disabled = false;
                    btnLoginAdmin.innerHTML = `<i class="fa fa-right-to-bracket text-xs"></i> XÁC THỰC QUẢN TRỊ`;
                }
            } else {
                alert("Không thể kết nối đến cơ sở dữ liệu xác thực người dùng Firebase!");
                btnLoginAdmin.disabled = false;
                btnLoginAdmin.innerHTML = `<i class="fa fa-right-to-bracket text-xs"></i> XÁC THỰC QUẢN TRỊ`;
            }
        }, { onlyOnce: true }); // Chạy duy nhất 1 lần lấy dữ liệu để tiết kiệm request và tăng tốc độ xử lý
    });
}