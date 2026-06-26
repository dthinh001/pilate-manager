"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { datetimeLocalToIso } from "@/lib/time";

export async function createSlot(formData: FormData) {
  const { profile, supabase } = await requireRole(["teacher", "admin"]);

  const teacherIdFromForm = String(formData.get("teacher_id") || "");
  const teacherId = profile.role === "admin" && teacherIdFromForm ? teacherIdFromForm : profile.id;
  const startsAt = datetimeLocalToIso(String(formData.get("starts_at") || ""));
  const endsAt = datetimeLocalToIso(String(formData.get("ends_at") || ""));
  const capacity = Number(formData.get("capacity") || 1);
  const note = String(formData.get("note") || "").trim();

  if (capacity < 1) throw new Error("Số học viên tối đa phải lớn hơn 0");
  if (new Date(startsAt) <= new Date()) throw new Error("Không thể tạo lớp trong quá khứ");
  if (new Date(endsAt) <= new Date(startsAt)) throw new Error("Giờ kết thúc phải sau giờ bắt đầu");

  const { error } = await supabase.from("teacher_slots").insert({
    teacher_id: teacherId,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity,
    note: note || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/student");
}

export async function cancelSlot(formData: FormData) {
  const { supabase } = await requireRole(["teacher", "admin"]);
  const slotId = String(formData.get("slot_id") || "");
  const { error } = await supabase.rpc("cancel_slot", { target_slot_id: slotId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/student");
}

export async function markAttendance(formData: FormData) {
  const { supabase } = await requireRole(["teacher", "admin"]);
  const bookingId = String(formData.get("booking_id") || "");
  const status = String(formData.get("status") || "completed");

  const { error } = await supabase.rpc("mark_attendance", {
    target_booking_id: bookingId,
    new_status: status,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/teacher");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/student");
}
