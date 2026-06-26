"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function RealtimeRefresher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pilates-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "teacher_slots" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => router.refresh())
      .subscribe();

    const fallbackRefresh = window.setInterval(() => router.refresh(), 30000);

    return () => {
      window.clearInterval(fallbackRefresh);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
