import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/app-nav";

const CHEAT_SHEET = [
  {
    topic: "Document Purpose",
    articles: "Legal formation document filed with the State of North Carolina establishing the HOA as a non-profit.",
    ccrs: "The legal \"contract\" recorded with the county that ties the rules, restrictions, and obligations to the land.",
    bylaws: "The internal operations manual detailing how the HOA is governed and run.",
    arc: "The design and aesthetic rulebook for the neighborhood.",
  },
  {
    topic: "Meetings & Notices",
    articles: "",
    ccrs: "",
    bylaws: "Primary: Dictates frequency of annual/board meetings, advance notice requirements, and quorum math.",
    arc: "",
  },
  {
    topic: "Voting Rights & Elections",
    articles: "",
    ccrs: "Secondary: Defines who is a member (e.g., Class A vs. Class B) and how voting weight is allocated.",
    bylaws: "Primary: Explains the mechanics of voting, proxies, and how Board members are elected or removed.",
    arc: "",
  },
  {
    topic: "Board of Directors",
    articles: "Secondary: Names initial incorporators and establishes baseline corporate liability.",
    ccrs: "",
    bylaws: "Primary: Outlines Board powers, duties, term lengths, and specific officer roles (President, Treasurer, etc.).",
    arc: "",
  },
  {
    topic: "Assessments (Dues)",
    articles: "",
    ccrs: "Primary: Establishes the legal obligation to pay, max allowable increases, late fees, and lien rights.",
    bylaws: "Secondary: Details the administrative process for drafting the annual budget and collecting dues.",
    arc: "",
  },
  {
    topic: "Property Use Rules",
    articles: "",
    ccrs: "Primary: Contains the core restrictive covenants (e.g., limits on pets, commercial vehicles, leasing, nuisances, trash).",
    bylaws: "",
    arc: "",
  },
  {
    topic: "Maintenance Duties",
    articles: "",
    ccrs: "Primary: Explicitly divides maintenance responsibilities between the Owner (the lot/home) and the HOA (common areas/amenities).",
    bylaws: "",
    arc: "",
  },
  {
    topic: "Architectural Changes",
    articles: "",
    ccrs: "Secondary: Grants the HOA the legal authority to mandate approvals and establishes the ARC committee.",
    bylaws: "",
    arc: "Primary: Specific design standards (fences, paint colors, sheds, landscaping) and the exact application/approval process.",
  },
  {
    topic: "How to Amend",
    articles: "Primary: Outlines statutory process for amending the corporate articles.",
    ccrs: "Primary: Requires 67% affirmative vote of total membership (recorded with the county).",
    bylaws: "Primary: Requires majority vote of a quorum of members at a meeting.",
    arc: "Primary: Requires a simple majority vote of the Board of Directors.",
  },
];

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

  const isAdmin = profile.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-neutral-900">
          HOA Documents Cheat Sheet
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Where to find things across the Articles of Incorporation, CC&amp;Rs,
          Bylaws, and ARC Guidelines. Unofficial — always confirm against the
          actual documents for anything binding.
        </p>

        <div className="mt-6 overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Articles of Incorporation</th>
                <th className="px-3 py-2">CC&amp;Rs (Declaration)</th>
                <th className="px-3 py-2">Bylaws</th>
                <th className="px-3 py-2">ARC Guidelines</th>
              </tr>
            </thead>
            <tbody>
              {CHEAT_SHEET.map((row) => (
                <tr key={row.topic} className="border-b border-neutral-100 align-top last:border-0">
                  <td className="px-3 py-2.5 font-medium text-neutral-900">{row.topic}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{row.articles || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{row.ccrs || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{row.bylaws || "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{row.arc || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center">
          <p className="text-sm font-medium text-neutral-700">
            Ask-a-question chat is coming to this page
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            For now, use the{" "}
            <a href="/chat" className="font-medium text-neutral-900 underline">
              document assistant
            </a>{" "}
            to ask about the CC&amp;Rs, Bylaws, ARC Guidelines, and meeting minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
