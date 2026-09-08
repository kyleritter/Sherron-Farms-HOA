"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";

const LINKS = [
  { href: "/hoa-docs", label: "HOA Docs" },
  { href: "/financials", label: "Financials" },
  { href: "/ideas", label: "Ideas" },
];

export default function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/verify");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b-2 border-brand-green bg-white px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="SF-HOA-Doc-Ref logo"
          width={32}
          height={32}
          className="shrink-0"
          priority
        />
        <span className="hidden text-sm font-semibold tracking-wide text-brand-dark sm:inline">
          SF-HOA-Doc-Ref
        </span>
      </div>
      <nav className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-brand-green text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              pathname?.startsWith("/admin")
                ? "bg-brand-brown text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <ShieldCheck size={15} />
            Admin
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </header>
  );
}
