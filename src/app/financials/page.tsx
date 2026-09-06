import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/app-nav";
import PnlTable from "./pnl-table";
import DocumentRepository from "./document-repository";

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
    <div className="flex h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Financials
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              The HOA&apos;s monthly profit &amp; loss, plus the underlying
              statements and budget.
            </p>
          </div>
          <PnlTable />
          <DocumentRepository />
        </div>
      </div>
    </div>
  );
}
