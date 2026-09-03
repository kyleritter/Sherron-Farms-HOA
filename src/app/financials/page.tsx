import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/app-nav";

export default async function FinancialsPage() {
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
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Financials</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          The HOA&apos;s financial status — budget, reserves, dues collection —
          will be displayed here. Coming soon.
        </p>
      </div>
    </div>
  );
}
