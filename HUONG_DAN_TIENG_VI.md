# Hướng dẫn nhanh - Pilates MVP

Đây là bản MVP cho website đặt lịch phòng tập Pilates.

## Bản này đã sửa các góp ý mới

1. Toàn bộ giao diện người dùng đã chuyển sang tiếng Việt.
2. Học viên sau khi đặt lớp sẽ chỉ thấy lịch đã đặt và nút hủy lịch. Không còn dropdown chọn slot gây khó hiểu.
3. Học viên chỉ đặt được lớp trong tuần hiện tại, tính từ thứ 2 đến chủ nhật.
4. Giáo viên không thể điểm danh khi chưa đến giờ học.
5. Nếu điểm danh nhầm, giáo viên hoặc admin có thể sửa lại điểm danh sau khi buổi học đã bắt đầu.
6. Dashboard có Supabase Realtime để tự cập nhật lịch/lượt đặt, kèm fallback refresh mỗi 30 giây.

## Cách chạy lần đầu

1. Tạo Supabase project.
2. Vào SQL Editor, paste toàn bộ file `db/schema.sql` và Run.
3. Copy `.env.example` thành `.env.local` rồi điền key Supabase.
4. Tạo admin đầu tiên trong Supabase Auth > Users.
5. Chạy SQL để gán quyền admin:

```sql
insert into public.profiles (id, email, full_name, role, active)
select id, email, 'Studio Admin', 'admin', true
from auth.users
where email = 'email-admin-cua-ban@example.com'
on conflict (id)
do update set
  role = 'admin',
  full_name = 'Studio Admin',
  active = true;
```

6. Chạy app:

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Nếu đang dùng database từ bản cũ

Chạy thêm file này trong Supabase SQL Editor:

```text
db/patch_v3_week_attendance_realtime.sql
```

Nếu không chạy patch, code mới vẫn chạy giao diện nhưng database cũ chưa có đủ rule mới.

## Lưu ý

- `SUPABASE_SERVICE_ROLE_KEY` chỉ được dùng ở server.
- Không đưa `.env.local` lên GitHub public.
- Bản này chưa có thanh toán online, SMS tự động hoặc Zalo notification tự động.

## Tuy chinh trang chu, logo va anh

Ban co the sua noi dung trang chu trong file:

```text
content/studio.json
```

Cac muc de sua nhanh:

- `studioName`: ten phong tap hien tren goc trai.
- `logo`: duong dan logo.
- `hero.badge`: nhan nho tren tieu de.
- `hero.title`: tieu de lon.
- `hero.description`: mo ta ben duoi tieu de.
- `hero.trialButtonText`: chu tren nut dang ky tap thu.
- `hero.images`: danh sach anh tren trang chu.

Anh mac dinh nam trong:

```text
public/studio/
```

Neu muon thay anh ma khong sua code, hay thay file va giu nguyen ten:

```text
logo.svg
hero-1.svg
hero-2.svg
hero-3.svg
```

Neu dung file `.png` hoac `.jpg`, hay cap nhat duong dan trong `content/studio.json`.
