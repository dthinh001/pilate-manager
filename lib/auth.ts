import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) return null;

  return { user, profile: profile as Profile, supabase };
}

export async function requireUser() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");
  if (!current.profile.active) redirect("/login?error=T%C3%A0i%20kho%E1%BA%A3n%20%C4%91ang%20b%E1%BB%8B%20kh%C3%B3a");
  return current;
}

export async function requireRole(roles: UserRole[]) {
  const current = await requireUser();
  if (!roles.includes(current.profile.role)) redirect("/dashboard");
  return current;
}
