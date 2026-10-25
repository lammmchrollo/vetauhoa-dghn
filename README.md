# RailGo – Hệ thống bán vé tàu hỏa

Ứng dụng phục vụ đồ án học phần **Đánh giá hiệu năng hệ thống**. Dự án gồm website responsive, REST API, dữ liệu mẫu và bộ khung kiểm thử Postman, Puppeteer, JMeter.

## Chạy dự án

```powershell
npm install
npm start
```

Mở `http://localhost:3000`.

## Tài khoản mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `customer@railgo.vn` | `Customer@123` |
| Nhân viên | `staff@railgo.vn` | `Staff@123` |
| Quản trị viên | `admin@railgo.vn` | `Admin@123` |

## Cấu trúc

- `src/`: backend và REST API.
- `public/`: giao diện người dùng.
- `data/`: dữ liệu khởi tạo; dữ liệu lúc chạy nằm trong `runtime.json`.
- `docs/`: tài liệu đồ án.
- `tests/`: Postman, Puppeteer và JMeter.

## Chế độ lỗi phục vụ kiểm thử

Biến môi trường `BUG_MODE=true` giữ các lỗi cài sẵn theo Bug Manifest. Đây là yêu cầu của đồ án. Không chia sẻ Bug Manifest cho tester ghép cặp trước buổi đối chiếu.
