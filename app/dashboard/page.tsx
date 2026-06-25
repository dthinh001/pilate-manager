import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function DashboardRouterPage() {
  const { profile } = await requireUser();

  if (profile.role === "admin") redirect("/dashboard/admin");
  if (profile.role === "teacher") redirect("/dashboard/teacher");
  redirect("/dashboard/student");
}
