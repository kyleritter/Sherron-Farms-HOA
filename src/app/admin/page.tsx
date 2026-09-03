import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveUser, rejectUser } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/chat");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status, created_at")
    .order("created_at", { ascending: false });

  const pending = (profiles ?? []).filter((p) => p.status === "pending");
  const others = (profiles ?? []).filter((p) => p.status !== "pending");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold text-neutral-900">
        Resident Access — Admin
      </h1>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-500">
          Pending approval ({pending.length})
        </h2>
        <div className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {pending.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">
              Nothing pending.
            </p>
          )}
          {pending.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {p.full_name || p.email}
                </p>
                <p className="text-xs text-neutral-500">{p.email}</p>
              </div>
              <div className="flex gap-2">
                <form action={approveUser.bind(null, p.id)}>
                  <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700">
                    Approve
                  </button>
                </form>
                <form action={rejectUser.bind(null, p.id)}>
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-500">
          All other residents ({others.length})
        </h2>
        <div className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {others.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {p.full_name || p.email}
                </p>
                <p className="text-xs text-neutral-500">{p.email}</p>
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {p.status} · {p.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
