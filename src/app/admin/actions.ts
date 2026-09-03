"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createClient, createAdminClient } from "@/lib/supabase/server";

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
  await assertIsAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ status: "approved" }).eq("id", userId);
  revalidatePath("/admin");
}

export async function rejectUser(userId: string) {
  await assertIsAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ status: "rejected" }).eq("id", userId);
  revalidatePath("/admin");
}

export async function changeCommunityPassword(formData: FormData) {
  await assertIsAdmin();
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!newPassword || newPassword.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const admin = createAdminClient();
  const { error } = await admin
    .from("community_settings")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) throw new Error("Couldn't update the community password.");
  revalidatePath("/admin");
}
