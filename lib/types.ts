export type UserRole = "admin" | "teacher" | "student";
export type BookingStatus = "booked" | "cancelled" | "completed" | "absent";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SlotSummary = {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  remaining_seats: number;
  status: "open" | "cancelled";
  note: string | null;
};
