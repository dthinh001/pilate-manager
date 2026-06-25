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
  if (!current.profile.active) redirect("/login?error=inactive");
  return current;
}

export async function requireRole(roles: UserRole[]) {
  const current = await requireUser();
  if (!roles.includes(current.profile.role)) redirect("/dashboard");
  return current;
}
