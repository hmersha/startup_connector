"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/discover", label: "Discover", match: ["/discover"] },
  { href: "/sprints",  label: "Sprints",  match: ["/sprints"] },
  {
    href: "/network",
    label: "Network",
    match: ["/network", "/messages", "/members", "/connections"],
  },
  { href: "/profile",  label: "Profile",  match: ["/profile"] },
];

export default function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  const isLandingPage = pathname === "/";

  function isActive(match: string[]) {
    return match.some((m) => pathname === m || pathname.startsWith(m + "/"));
  }

  useEffect(() => {
    async function loadUser() {
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData?.user ?? null);
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") setUser(null);
        else if (session?.user) setUser(session.user);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-slate-700/50 ${
        isLandingPage
          ? "bg-transparent backdrop-blur-md"
          : "bg-slate-900/80 backdrop-blur-lg"
      }`}
    >
      <div className="nav-container">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-lg font-semibold group">
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-indigo-300 group-hover:via-indigo-400 group-hover:to-violet-300">
              CollabSpace
            </span>
          </Link>

          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
            {/* Logged-in nav */}
            {user &&
              NAV_ITEMS.map(({ href, label, match }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-2 sm:px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive(match)
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-700/40"
                  }`}
                >
                  {label}
                </Link>
              ))}

            {/* Logged-out home link */}
            {!user && (
              <Link href="/" className="nav-link whitespace-nowrap">
                Home
              </Link>
            )}

            {/* Auth button */}
            {user ? (
              <button
                onClick={async () => { await supabase.auth.signOut(); }}
                className="ml-1 sm:ml-3 text-sm text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-2 text-sm font-medium px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-400/50 hover:text-indigo-300 transition-all duration-200 whitespace-nowrap"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
