import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatClient from "./chat-client";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status === "pending") redirect("/verify");

  return <ChatClient isAdmin={profile.role === "admin"} />;
}
