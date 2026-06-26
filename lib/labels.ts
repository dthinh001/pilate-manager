import type { BookingStatus, UserRole } from "@/lib/types";

export function roleLabel(role: UserRole | string | null | undefined) {
  switch (role) {
    case "admin":
      return "Quản trị viên";
    case "teacher":
      return "Giáo viên";
    case "student":
      return "Học viên";
    default:
      return "Không rõ";
  }
}

export function bookingStatusLabel(status: BookingStatus | string | null | undefined) {
  switch (status) {
    case "booked":
      return "Đã đặt";
    case "cancelled":
      return "Đã hủy";
    case "completed":
      return "Có mặt";
    case "absent":
      return "Vắng";
    default:
      return "Không rõ";
  }
}

export function slotStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "open":
      return "Đang mở";
    case "cancelled":
      return "Đã hủy";
    default:
      return "Không rõ";
  }
}

export function activeLabel(active: boolean | null | undefined) {
  return active ? "Đang hoạt động" : "Đã khóa";
}
