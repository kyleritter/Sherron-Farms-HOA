import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/app-nav";
import DocumentsList from "./documents-list";

export default async function DocumentsPage() {
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

  const isAdmin = profile.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-neutral-900">
          Source Documents
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          The governing documents behind the HOA Docs cheat sheet and the
          chat assistant, straight from the source. Opens in a new tab.
        </p>

        <DocumentsList />
      </div>
    </div>
  );
}
