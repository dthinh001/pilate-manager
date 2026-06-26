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
    throw new Error("Quyền người dùng không hợp lệ");
  }
}

function friendlyAdminError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already") && normalized.includes("email")) {
    return "Email này đã tồn tại. Nếu bạn vừa xóa user trong Supabase, hãy kiểm tra lại danh sách Auth Users hoặc dùng email khác để test.";
  }
  if (normalized.includes("rate limit")) {
    return "Supabase đang giới hạn gửi email. Hãy dùng Tạo tài khoản trực tiếp hoặc cấu hình SMTP riêng.";
  }
  return message;
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

export async function createUserByAdmin(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student") as UserRole;
  const phone = cleanPhone(String(formData.get("phone") || ""));
  const password = String(formData.get("password") || "");

  if (!email || !fullName || !phone || !password) {
    throw new Error("Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu ban đầu");
  }
  if (password.length < 8) throw new Error("Mật khẩu cần có ít nhất 8 ký tự");
  validateRole(role);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, phone },
  });

  if (error) throw new Error(friendlyAdminError(error.message));

  const userId = data.user?.id;
  if (!userId) throw new Error("Không tạo được tài khoản");

  await upsertProfile({ id: userId, email, fullName, phone, role });

  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?created=1");
}

export async function inviteUser(formData: FormData) {
  await requireRole(["admin"]);
  const admin = createAdminClient();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "student") as UserRole;
  const phone = cleanPhone(String(formData.get("phone") || ""));

  if (!email || !fullName || !phone) throw new Error("Vui lòng nhập đầy đủ họ tên, email và số điện thoại");
  validateRole(role);

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/update-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName, role, phone },
  });

  if (error) throw new Error(friendlyAdminError(error.message));

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
  if (!id) throw new Error("Thiếu user id");
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

  if (!id || !fullName || !phone) throw new Error("Vui lòng nhập đủ họ tên và số điện thoại");

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

  if (!studentId) throw new Error("Thiếu học viên");
  if (totalSessions < 0 || remainingSessions < 0) throw new Error("Số buổi không hợp lệ");

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
