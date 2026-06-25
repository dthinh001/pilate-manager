# Huong dan nhanh - Pilates MVP

Day la ban code MVP cho website dat lich phong tap Pilates.

## Da co trong ban nay

1. Trang chu
- Ten studio
- Anh placeholder
- Nut dang ky tap thu dan sang Zalo
- Nut login

2. Dang nhap
- Email + password bang Supabase Auth
- Khong co public sign up
- Admin tao tai khoan cho giao vien va hoc vien

3. Phan quyen
- admin
- teacher
- student

4. Admin
- Moi user bang email
- Gan role
- Bat/tat active user
- Cap nhat tong so buoi va so buoi con lai cho hoc vien
- Xem lich lop
- Xem lich su booking/diem danh

5. Giao vien
- Tao khung gio bat ky, vi du 18:15 - 19:15
- Tuy chinh suc chua lop
- Xem hoc vien da dat
- Huy lop
- Diem danh completed/absent

6. Hoc vien
- Xem lop con cho
- Dat lich
- Huy lich
- Doi lich sang khung gio khac
- Xem lich su tap
- Xem so buoi con lai

## Quy tac booking

- Dat lich tru 1 buoi ngay lap tuc.
- Huy truoc han cho phep se hoan lai 1 buoi.
- Huy qua sat gio thi khong hoan buoi.
- Doi lich chi cho phep truoc han cho phep va khong tru them buoi.
- Giao vien/admin huy lop thi hoan buoi cho tat ca hoc vien.
- Hoc vien khong duoc dat 2 lop trung gio.
- Lop khong duoc vuot qua suc chua.

Mac dinh han huy/doi lich la 6 tieng truoc gio hoc. Co the sua trong bang studio_settings.

## Cach chay

1. Tao Supabase project.
2. Vao SQL Editor, paste toan bo file db/schema.sql va run.
3. Copy .env.example thanh .env.local va dien key.
4. Tao admin dau tien trong Supabase Auth > Users.
5. Chay SQL:

update public.profiles
set role = 'admin', full_name = 'Studio Admin'
where email = 'email-admin-cua-ban@example.com';

6. Chay lenh:

npm install
npm run dev

Mo http://localhost:3000

## Luu y

- SUPABASE_SERVICE_ROLE_KEY chi duoc dung o server, khong bao gio dua vao frontend.
- Ban nay chua co payment online, SMS, Zalo notification tu dong.
- Text UI dang de don gian, ban co the sua trong cac file app/page.tsx, app/login/page.tsx, app/dashboard/*.
