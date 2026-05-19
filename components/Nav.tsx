"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState<number | null>(null);

  const isLandingPage = pathname === "/";

  useEffect(() => {
    async function loadUserAndReputation() {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: userData } = await supabase
          .from("users")
          .select("reputation")
          .eq("id", currentUser.id)
          .single();

        if (userData) {
          setReputation(userData.reputation);
        }
      }
    }

    loadUserAndReputation();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setReputation(null);
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        supabase
          .from("users")
          .select("reputation")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setReputation(data.reputation);
          });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className={`sticky top-0 z-50 border-b border-slate-700/50 ${isLandingPage ? "bg-transparent backdrop-blur-md" : "bg-slate-900/80 backdrop-blur-lg"}`}>
      <div className="nav-container">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold group"
          >
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-400 bg-clip-text text-transparent transition-all duration-300 group-hover:from-indigo-300 group-hover:via-indigo-400 group-hover:to-violet-300">
              CollabSpace
            </span>
          </Link>
          <div className="flex items-center gap-5">
            {/* Logged out: Home (landing page) */}
            {!user && (
              <Link href="/" className="nav-link">
                Home
              </Link>
            )}

            {/* Logged in: Feed + other pages */}
            {user && (
              <>
                <Link href="/feed" className="nav-link">
                  Feed
                </Link>
                <Link href="/discover" className="nav-link">
                  Discover
                </Link>
                <Link href="/sprints" className="nav-link">
                  Sprints
                </Link>
                <Link href="/posts/new" className="nav-link">
                  New Post
                </Link>
                <Link href="/members" className="nav-link">
                  Members
                </Link>
                <Link href="/connections" className="nav-link">
                  Connections
                </Link>
                <Link href="/messages" className="nav-link">
                  Messages
                </Link>
                <Link href="/profile" className="nav-link">
                  Profile
                </Link>
              </>
            )}

            {/* Reputation badge */}
            {user && reputation !== null && (
              <Link
                href="/reputation"
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <span className="rep-badge">
                  {reputation}
                </span>
              </Link>
            )}

            {/* Login/Logout */}
            {user ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="nav-link font-medium"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-400/50 hover:text-indigo-300 transition-all duration-200"
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
