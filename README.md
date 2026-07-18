# Quản lý đơn đề nghị

Công cụ local để lưu và theo dõi trạng thái các đơn đề nghị (bằng ảnh chụp/scan) theo từng Khoa/Phòng của bệnh viện.

## Cách chạy

Mở PowerShell tại thư mục này (`D:\QLđơn`), gõ:

```
npm start
```

Sau đó mở trình duyệt vào: http://localhost:3000

Để dừng, quay lại cửa sổ PowerShell và nhấn `Ctrl + C`.

## Cách dùng

- **Chọn Khoa/Phòng**: màn hình đầu tiên liệt kê 71 Khoa/Phòng (chia theo Cơ sở chính, Cơ sở 1, Cơ sở 2), có ô tìm nhanh theo tên. Mỗi khoa hiển thị số đơn chưa xong / hoàn thành. Bấm vào một khoa để vào quản lý đơn của khoa đó.
- **Thêm đơn**: trong màn hình của một khoa, chọn/kéo thả ảnh đơn vào ô upload, có thể thêm ghi chú, bấm "Tải lên".
- **Đổi trạng thái**: bấm "Đánh dấu hoàn thành" / "Đánh dấu chưa hoàn thành" trên từng đơn.
- **Ghi lý do chưa hoàn thành**: gõ vào ô "Lý do chưa hoàn thành" dưới mỗi đơn, tự lưu khi bấm ra ngoài ô.
- **Lọc trong 1 khoa**: dùng 3 nút "Tất cả / Chưa hoàn thành / Hoàn thành" phía trên danh sách.
- **Phân trang**: danh sách đơn hiển thị 10 đơn/trang, dùng nút "← Trước / Sau →" để chuyển trang.
- **Tìm kiếm toàn cục**: từ màn hình danh sách Khoa/Phòng, bấm nút "🔍 Tìm kiếm đơn theo ngày / trạng thái" để xem đơn của **tất cả** các khoa, lọc theo khoảng ngày tạo và/hoặc trạng thái.
- **Xem ảnh to**: bấm vào ảnh thu nhỏ.
- **Xóa đơn**: bấm nút "✕" trên đơn.

## Dữ liệu lưu ở đâu

- Ảnh đơn: thư mục `uploads/`
- Thông tin đơn (khoa, ghi chú, lý do, trạng thái, ngày): file `data/orders.json`
- Danh sách 71 Khoa/Phòng: file `data/departments.json`

Muốn sao lưu, chỉ cần copy các thứ trên sang nơi khác.
