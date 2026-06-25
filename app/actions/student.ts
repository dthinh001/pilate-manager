"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export async function bookSlot(formData: FormData) {
  const { supabase } = await requireRole(["student"]);
  const slotId = String(formData.get("slot_id") || "");
  const { error } = await supabase.rpc("book_slot", { target_slot_id: slotId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/student");
}

export async function cancelBooking(formData: FormData) {
  const { supabase } = await requireRole(["student"]);
  const bookingId = String(formData.get("booking_id") || "");
  const { error } = await supabase.rpc("cancel_booking", { target_booking_id: bookingId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/student");
}

export async function rescheduleBooking(formData: FormData) {
  const { supabase } = await requireRole(["student"]);
  const bookingId = String(formData.get("booking_id") || "");
  const newSlotId = String(formData.get("new_slot_id") || "");

  const { error } = await supabase.rpc("reschedule_booking", {
    target_booking_id: bookingId,
    new_slot_id: newSlotId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/student");
}
