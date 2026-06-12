const CACHE_NAME = 'homestech-v2'; // Đổi v1 thành v2 để trình duyệt nhận biết có cập nhật mới
const ASSETS_TO_CACHE = [
  './login.html',
  './nhanvien.html',
  './nhanvien-logic.js'
];

// Cài đặt và cache các tài nguyên tĩnh
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Kích hoạt worker và dọn dẹp cache cũ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Chiến lược phản hồi dữ liệu: Ưu tiên mạng mạng, lỗi mạng thì lôi cache静态
self.addEventListener('fetch', (e) => {
    // Chặn không cache các request Realtime của Firebase để tránh sai lệch dữ liệu
    if (e.request.url.includes('firebase') || e.request.url.includes('firestore')) {
        return;
    }
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
