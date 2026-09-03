import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HoaDocsClient from "./hoa-docs-client";

export default async function HoaDocsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status === "pending") redirect("/verify");

  return <HoaDocsClient isAdmin={profile.role === "admin"} />;
}
