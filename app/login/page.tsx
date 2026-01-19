"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
          setLoading(false);
          return;
        }
        const currentUser = data?.user ?? null;
        if (currentUser) {
          setUser(currentUser);
          upsertUser(currentUser);
          router.push("/");
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to check auth:", err);
        setLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
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

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        <p className="text-gray-600 mb-4">Signed in as {user.email}</p>
        <button
          onClick={handleSignOut}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Sign Out
        </button>
        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Send Magic Link
        </button>
      </form>
      {message && (
        <p
          className={`mt-4 ${message.startsWith("Error") ? "text-red-600" : "text-green-600"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
