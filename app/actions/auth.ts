"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Email hoặc mật khẩu không đúng";
  if (normalized.includes("email not confirmed")) return "Email chưa được xác nhận";
  if (normalized.includes("rate limit")) return "Hệ thống gửi email đang bị giới hạn tạm thời, vui lòng thử lại sau";
  return message;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  redirect("/dashboard");
}

export async function sendPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?error=Vui lòng nhập email");

  const supabase = await createClient();
  const redirectTo = `${getSiteUrl()}/auth/callback?next=/update-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect("/update-password?error=Mật khẩu cần có ít nhất 8 ký tự");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/update-password?error=${encodeURIComponent(friendlyAuthError(error.message))}`);
  }

  redirect("/dashboard");
}
