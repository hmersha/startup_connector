"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

async function upsertUser(user: User) {
  await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.email?.split("@")[0] ?? "Unknown",
    },
    { onConflict: "id" }
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on initial load
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          console.error("Auth error:", error.message);
          // Clear any stale session on auth error
          supabase.auth.signOut();
          setLoading(false);
          return;
        }
        const currentUser = data?.user ?? null;
        if (currentUser) {
          setUser(currentUser);
          // Don't redirect - let user see they're logged in and optionally sign out
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to check auth:", err);
        setLoading(false);
      });

    // Listen for auth state changes - only redirect on actual sign-in
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      // Only redirect when user actually signs in, not on initial session
      if (event === "SIGNED_IN" && currentUser) {
        upsertUser(currentUser);
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Check your email for the magic link!");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMessage("Signed out successfully.");
  };

  const Header = () => (
    <div className="mb-8 text-center">
      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <h1 className="section-header">Welcome back</h1>
      <p className="section-subtitle">
        Sign in to access CollabSpace
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-sm mx-auto">
        <Header />
        <div className="card p-8 text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="max-w-sm mx-auto">
        <Header />
        <div className="card p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-medium text-white">
                {(user.email ?? "U")[0].toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-600">Signed in as</p>
            <p className="font-medium text-gray-900">{user.email}</p>
          </div>

          <div className="space-y-3">
            <Link href="/" className="btn-primary block text-center">
              Go to Feed
            </Link>
            <button
              onClick={handleSignOut}
              className="btn-secondary w-full"
            >
              Sign Out
            </button>
          </div>

          {message && (
            <div className="mt-4 bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg border border-emerald-100 text-center">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto">
      <Header />

      <div className="card p-6">
        <form onSubmit={handleSignIn} className="space-y-5">
          <div>
            <label htmlFor="email" className="label">
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="you@example.com"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Send Magic Link
          </button>
        </form>

        {message && (
          <div
            className={`mt-4 text-sm px-4 py-3 rounded-lg border text-center ${
              message.startsWith("Error")
                ? "bg-red-50 text-red-700 border-red-100"
                : "bg-emerald-50 text-emerald-700 border-emerald-100"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            We'll send you a magic link to sign in.
            <br />
            No password needed.
          </p>
        </div>
      </div>
    </div>
  );
}
