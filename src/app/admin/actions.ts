"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertIsAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Forbidden");
  return supabase;
}

export async function approveUser(userId: string) {
  const supabase = await assertIsAdmin();
  await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", userId);
  revalidatePath("/admin");
}

export async function rejectUser(userId: string) {
  const supabase = await assertIsAdmin();
  await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", userId);
  revalidatePath("/admin");
}
