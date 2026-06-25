"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function inviteUser(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student") as UserRole;

  if (!email || !fullName) throw new Error("Missing required fields");
  if (!["admin", "teacher", "student"].includes(role)) throw new Error("Invalid role");

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/update-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, role },
  });

  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      active: true,
    });
    if (profileError) throw new Error(profileError.message);

    if (role === "student") {
      await admin.from("student_memberships").upsert({
        student_id: userId,
        total_sessions: 0,
        remaining_sessions: 0,
      }, { onConflict: "student_id" });
    }
  }

  revalidatePath("/dashboard/admin");
}

export async function updateUserRole(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "student") as UserRole;
  if (!id || !["admin", "teacher", "student"].includes(role)) throw new Error("Invalid role update");

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);

  if (role === "student") {
    await admin.from("student_memberships").upsert({
      student_id: id,
      total_sessions: 0,
      remaining_sessions: 0,
    }, { onConflict: "student_id" });
  }

  revalidatePath("/dashboard/admin");
}

export async function updateMembership(formData: FormData) {
  const { profile } = await requireRole(["admin"]);
  const admin = createAdminClient();

  const studentId = String(formData.get("student_id") || "");
  const totalSessions = Number(formData.get("total_sessions") || 0);
  const remainingSessions = Number(formData.get("remaining_sessions") || 0);
  const expiresOnRaw = String(formData.get("expires_on") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!studentId) throw new Error("Missing student");
  if (totalSessions < 0 || remainingSessions < 0) throw new Error("Invalid session count");

  const { error } = await admin.from("student_memberships").upsert({
    student_id: studentId,
    total_sessions: totalSessions,
    remaining_sessions: remainingSessions,
    expires_on: expiresOnRaw || null,
    notes: notes || null,
    updated_by: profile.id,
  }, { onConflict: "student_id" });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function setUserActive(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "true") === "true";

  const { error } = await admin.from("profiles").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}
