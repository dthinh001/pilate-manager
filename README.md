# Pilates Booking MVP

Bản MVP Next.js + Supabase cho website đặt lịch phòng tập Pilates.

## Chức năng chính

- Trang chủ tiếng Việt, có nút đăng ký tập thử qua Zalo.
- Đăng nhập bằng email và mật khẩu.
- 3 quyền: quản trị viên, giáo viên, học viên.
- Admin tạo tài khoản trực tiếp, nhập email, số điện thoại, mật khẩu ban đầu và quyền.
- Admin quản lý số buổi tập còn lại của học viên.
- Giáo viên tạo lịch dạy linh hoạt theo giờ bắt đầu, giờ kết thúc và số học viên tối đa.
- Học viên xem lịch đã đặt và đặt lớp còn chỗ trong tuần hiện tại, tính từ thứ 2 đến chủ nhật.
- Học viên đổi lịch theo cách đơn giản: hủy lịch cũ rồi đặt lịch mới.
- Giáo viên chỉ điểm danh được sau khi đã đến giờ học.
- Giáo viên và admin có thể sửa lại điểm danh sau giờ học nếu bấm nhầm.
- Dashboard tự refresh bằng Supabase Realtime, kèm fallback refresh định kỳ 30 giây.

## Chưa làm trong v1

- Thanh toán online.
- SMS / Zalo notification tự động.
- App mobile.
- Gói membership phức tạp.

## Cài đặt lần đầu

### 1. Tạo Supabase project

Tạo project trên Supabase, sau đó vào SQL Editor và chạy toàn bộ file:

```text
db/schema.sql
```

### 2. Cấu hình Auth Redirect

Trong Supabase Dashboard:

```text
Authentication -> URL Configuration
```

Khi chạy local:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
Redirect URL: http://localhost:3000/update-password
```

Khi deploy thật thì thêm domain thật, ví dụ:

```text
https://domain-cua-ban.com/auth/callback
https://domain-cua-ban.com/update-password
```

### 3. Tạo `.env.local`

Copy `.env.example` thành `.env.local` rồi điền key Supabase.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ZALO_URL=https://zalo.me/84xxxxxxxxx
NEXT_PUBLIC_STUDIO_TIME_ZONE=Asia/Ho_Chi_Minh
STUDIO_UTC_OFFSET=+07:00
```

`SUPABASE_SERVICE_ROLE_KEY` chỉ dùng ở server. Không đưa key này lên frontend hoặc GitHub public.

### 4. Tạo admin đầu tiên

Vì app không cho đăng ký công khai, admin đầu tiên cần tạo trong Supabase:

```text
Authentication -> Users -> Add user
```

Sau đó chạy SQL, đổi email bên dưới thành email của bạn:

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

### 5. Chạy local

```bash
npm install
npm run dev
```

Mở:

```text
http://localhost:3000
```

## Nếu bạn đã chạy bản cũ

Nếu database Supabase đã tạo từ bản cũ, chạy thêm file patch này trong SQL Editor:

```text
db/patch_v3_week_attendance_realtime.sql
```

Patch này sẽ:

- Đảm bảo bảng `profiles` có cột `phone`.
- Chặn học viên đặt lịch ngoài tuần hiện tại.
- Chặn giáo viên điểm danh trước giờ học.
- Cho phép sửa lại điểm danh sau khi đã đến giờ học.
- Bật Supabase Realtime cho bảng `teacher_slots` và `bookings`.

## Quy tắc booking

- Đặt lịch trừ 1 buổi ngay lập tức.
- Hủy trước hạn cho phép sẽ hoàn lại 1 buổi.
- Hủy quá sát giờ thì không hoàn buổi.
- Giáo viên/admin hủy lớp thì hoàn buổi cho toàn bộ học viên đã đặt.
- Học viên không được đặt 2 lớp trùng giờ.
- Lớp không được vượt quá số học viên tối đa.
- Học viên chỉ đặt được lớp trong tuần hiện tại, từ thứ 2 đến chủ nhật.

Mặc định hạn hủy lịch là 6 tiếng trước giờ học. Có thể sửa trong bảng `studio_settings`.

## v4 UI notes

Homepage content is editable from `content/studio.json`. Replace homepage assets in `public/studio/` to update logo and images. The admin dashboard uses collapsible sections to avoid showing every management table at once.
