"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function cleanPhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

function validateRole(role: string): asserts role is UserRole {
  if (!["admin", "teacher", "student"].includes(role)) {
    throw new Error("Invalid role");
  }
}

async function upsertProfile(params: {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
}) {
  const admin = createAdminClient();
  const { id, email, fullName, phone, role } = params;

  const { error: profileError } = await admin.from("profiles").upsert({
    id,
    email,
    full_name: fullName,
    phone: phone || null,
    role,
    active: true,
  });
  if (profileError) throw new Error(profileError.message);

  if (role === "student") {
    const { error: membershipError } = await admin.from("student_memberships").upsert({
      student_id: id,
      total_sessions: 0,
      remaining_sessions: 0,
    }, { onConflict: "student_id" });
    if (membershipError) throw new Error(membershipError.message);
  }
}

// Default MVP flow: create the account directly, without sending Supabase's invite email.
// This avoids Supabase built-in email rate limits while you are testing.
export async function createUserByAdmin(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student") as UserRole;
  const phone = cleanPhone(String(formData.get("phone") || ""));
  const password = String(formData.get("password") || "");

  if (!email || !fullName || !phone || !password) {
    throw new Error("Missing required fields");
  }
  if (password.length < 8) throw new Error("Password must have at least 8 characters");
  validateRole(role);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, phone },
  });

  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (!userId) throw new Error("User was not created");

  await upsertProfile({ id: userId, email, fullName, phone, role });

  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?created=1");
}

// Optional flow: send Supabase invite email. This can hit rate limits on free/default email settings.
export async function inviteUser(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student") as UserRole;
  const phone = cleanPhone(String(formData.get("phone") || ""));

  if (!email || !fullName || !phone) throw new Error("Missing required fields");
  validateRole(role);

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/update-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, role, phone },
  });

  if (error) {
    const message = error.message.toLowerCase().includes("rate limit")
      ? "Supabase email rate limit exceeded. Use Create user instead, or configure custom SMTP in Supabase."
      : error.message;
    throw new Error(message);
  }

  const userId = data.user?.id;
  if (userId) {
    await upsertProfile({ id: userId, email, fullName, phone, role });
  }

  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?invited=1");
}

export async function updateUserRole(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const id = String(formData.get("id") || "");
  const role = String(formData.get("role") || "student") as UserRole;
  if (!id) throw new Error("Missing user id");
  validateRole(role);

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

export async function updateUserContact(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const phone = cleanPhone(String(formData.get("phone") || ""));

  if (!id || !fullName || !phone) throw new Error("Missing required fields");

  const { error } = await admin.from("profiles").update({
    full_name: fullName,
    phone,
  }).eq("id", id);
  if (error) throw new Error(error.message);

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
