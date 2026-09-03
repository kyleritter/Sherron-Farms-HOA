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

  return <ChatClient />;
}
