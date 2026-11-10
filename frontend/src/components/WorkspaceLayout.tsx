"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChartNoAxesColumnIncreasing,
  CircleUserRound,
  CreditCard,
  Compass,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const navigation = [
  { href: "/seer", label: "Overview", icon: Compass },
  { href: "/seer/repositories", label: "Saved repositories", icon: Bookmark },
  { href: "/seer/reports", label: "Reports", icon: ChartNoAxesColumnIncreasing },
  { href: "/seer/profile", label: "Profile & appearance", icon: CircleUserRound },
  { href: "/seer/plans", label: "Manage subscription", icon: CreditCard },
];

export function WorkspaceLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#030908] text-slate-100 md:flex">
      <aside className="border-b border-emerald-950/60 bg-[#020706] md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <Link href="/seer" className="flex items-center gap-3 border-b border-emerald-950/40 px-5 py-5">
          <span className="flex size-10 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-950 font-bold text-emerald-300">R</span>
          <span>
            <span className="block font-bold tracking-wider">REPOSEER</span>
            <span className="block text-xs text-slate-500">Your repository workspace</span>
          </span>
        </Link>
        <nav aria-label="Workspace navigation" className="flex gap-2 overflow-x-auto p-3 md:flex-1 md:flex-col">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/seer" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-emerald-500 text-slate-950"
                    : "text-slate-400 hover:bg-emerald-950/40 hover:text-slate-100"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-emerald-950/40 p-4 md:block">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <Sparkles size={14} className="text-emerald-400" aria-hidden="true" />
            <span className="truncate">{user?.email || "Signed in"}</span>
          </div>
          <button
            type="button"
            onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed:", error))}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 transition hover:bg-rose-950/30 hover:text-rose-300"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
        <header className="mb-7 border-b border-emerald-950/40 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Workspace</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
          <div className="mt-4 flex items-center justify-between gap-3 md:hidden">
            <span className="max-w-[65vw] truncate text-xs text-slate-400">{user?.email || "Signed in"}</span>
            <button type="button" onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed:", error))} className="text-xs font-semibold text-rose-300">
              Sign out
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
