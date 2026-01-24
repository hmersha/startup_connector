"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [reputation, setReputation] = useState<number | null>(null);

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
    <nav className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/70 backdrop-blur-lg">
      <div className="mx-auto max-w-2xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold text-gray-900 hover:text-gray-900"
          >
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
              CollabSpace
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Feed
            </Link>
            {user && (
              <>
                <Link
                  href="/members"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Members
                </Link>
                <Link
                  href="/messages"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Messages
                </Link>
                <Link
                  href="/profile"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Profile
                </Link>
              </>
            )}
            {user && reputation !== null && (
              <Link
                href="/reputation"
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <span className="flex items-center justify-center w-6 h-6 bg-indigo-50 rounded-full text-xs font-semibold border border-indigo-100">
                  {reputation}
                </span>
              </Link>
            )}
            {user ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
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
