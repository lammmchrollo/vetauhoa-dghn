# RailGo – Hệ thống bán vé tàu hỏa

Ứng dụng phục vụ đồ án học phần **Đánh giá hiệu năng hệ thống**. Dự án gồm website responsive, REST API, dữ liệu mẫu và bộ khung kiểm thử Postman, Puppeteer, JMeter.

## Chạy dự án

```powershell
npm install
npm start
```

Mở `http://localhost:3000`.

## Deploy nhanh lên Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lammmchrollo/vetauhoa-dghn)

1. Bấm nút **Deploy to Render** phía trên và đăng nhập bằng GitHub.
2. Chọn repository `vetauhoa-dghn`, giữ nguyên cấu hình trong `render.yaml`.
3. Bấm **Apply/Deploy Blueprint** và chờ trạng thái chuyển sang `Live`.
4. Mở đường dẫn dạng `https://railgo-vetauhoa.onrender.com` do Render cung cấp.

Bản Free có thể mất khoảng một phút để khởi động lại sau 15 phút không có truy cập. Dữ liệu phát sinh được lưu tạm và sẽ trở về dữ liệu mẫu sau khi dịch vụ khởi động lại hoặc được triển khai lại; điều này phù hợp cho bản demo học phần.

## Tài khoản mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Khách hàng | `customer@railgo.vn` | `Customer@123` |
| Nhân viên | `staff@railgo.vn` | `Staff@123` |
| Quản trị viên | `admin@railgo.vn` | `Admin@123` |

Vé mẫu của tài khoản khách hàng: `RG-20261028-0001`.

## Cấu trúc

- `src/`: backend và REST API.
- `public/`: giao diện người dùng.
- `data/`: dữ liệu khởi tạo; dữ liệu lúc chạy nằm trong `runtime.json`.
- `docs/`: tài liệu đồ án.
- `tests/`: Postman, Puppeteer và JMeter.

## Chế độ lỗi phục vụ kiểm thử

Biến môi trường `BUG_MODE=true` giữ các lỗi cài sẵn theo Bug Manifest. Đây là yêu cầu của đồ án. Không chia sẻ Bug Manifest cho tester ghép cặp trước buổi đối chiếu.
