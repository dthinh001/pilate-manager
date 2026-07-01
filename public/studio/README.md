# Thay logo và ảnh trang chủ

Bạn có thể thay file trong thư mục này mà không cần sửa code nếu giữ nguyên tên file:

- `logo.svg`: logo ở góc trái.
- `hero-1.svg`: ảnh nhỏ 1 trên trang chủ.
- `hero-2.svg`: ảnh nhỏ 2 trên trang chủ.
- `hero-3.svg`: ảnh lớn ngang trên trang chủ.

Nếu muốn dùng ảnh `.png` hoặc `.jpg`, hãy upload ảnh vào thư mục này rồi sửa đường dẫn trong file:

`content/studio.json`

Ví dụ đổi:

```json
"logo": "/studio/logo.png"
```

Các slogan, tiêu đề, mô tả và chữ trên nút trang chủ cũng sửa trong `content/studio.json`.
