"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const TEMPLATES: Record<string, string> = {
  "1": "I'm building ___ for ___ because ___",
  "2": "I'm stuck on ___ — looking for help with ___",
  "3": "Update: I shipped ___; next I'm trying ___",
};

async function updatePresence(userId: string) {
  await supabase
    .from("users")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId);
}

function NewPostContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCategory = searchParams.get("category") === "update" ? "update" : "idea";
  const templateId = searchParams.get("template");
  const initialBody = templateId && TEMPLATES[templateId] ? TEMPLATES[templateId] : "";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState(initialBody);
  const [category, setCategory] = useState(initialCategory);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError("");

    const { error } = await supabase.from("posts").insert({
      title,
      body,
      category,
      author_id: user.id,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      // Update presence on post creation
      await updatePresence(user.id);
      router.push("/");
    }
  };

  const Header = () => (
    <div className="mb-8">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 mb-4 inline-block">
        ← Back to feed
      </Link>
      <h1 className="section-header">
        {category === "idea" ? "Share an idea" : "Post an update"}
      </h1>
      <p className="section-subtitle">
        Short, unfinished is encouraged. Just start writing.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div>
        <Header />
        <div className="card p-8 text-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <Header />
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-slate-200 mb-4">
            Log in to create a post.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  const sentenceCount = body.split(/[.!?]+/).filter(s => s.trim()).length;

  return (
    <div>
      <Header />

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="category" className="label">
              Type
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
            >
              <option value="idea">Idea — something you're thinking about</option>
              <option value="update">Update — progress on something you're building</option>
            </select>
          </div>

          <div>
            <label htmlFor="title" className="label">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input-field"
              placeholder="What's the one-liner?"
            />
            <p className="helper-text">Keep it short — you'll explain more below.</p>
          </div>

          <div>
            <label htmlFor="body" className="label">
              Details
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={8}
              className="input-field resize-none font-normal"
              placeholder="Share the context, what you've tried, or what you're looking for..."
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="helper-text">Aim for 2–10 sentences. Unfinished thoughts welcome.</p>
              <p className={`text-xs ${sentenceCount > 10 ? "text-amber-400" : "text-slate-500"}`}>
                ~{sentenceCount} sentence{sentenceCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? "Posting..." : "Post"}
            </button>
            <Link href="/" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
          Posts are visible to all logged-in members. Be kind.
        </p>
      </div>
    </div>
  );
}

// Wrap in Suspense boundary for useSearchParams
export default function NewPostPage() {
  return (
    <Suspense fallback={
      <div className="max-w-xl mx-auto">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="card p-6 space-y-4">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-10 w-32" />
        </div>
      </div>
    }>
      <NewPostContent />
    </Suspense>
  );
}
