"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/PageShell";

type Post = {
  id: string;
  title: string;
  body: string | null;
  category: string;
  created_at: string;
  author_id: string;
  users: { name: string | null; username: string | null } | null;
};

const CATEGORY_STYLES: Record<string, string> = {
  build: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  validate: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  feedback: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  idea: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  question: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
};

function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FeedPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    setUser(authData?.user ?? null);
    setAuthChecked(true);

    const { data } = await supabase
      .from("posts")
      .select("id, title, body, category, created_at, author_id, users(name, username)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as unknown as Post[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const categories = ["all", ...Array.from(new Set(posts.map((p) => p.category)))];
  const filtered = activeCategory === "all" ? posts : posts.filter((p) => p.category === activeCategory);

  const rail = (
    <div className="space-y-4">
      <div className="rail-widget">
        <h3 className="rail-widget-title mb-3">Share something</h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Post an idea, ask for feedback, or share what you're building.
        </p>
        <Link href="/posts/new" className="btn-primary block text-center text-sm">
          + New Post
        </Link>
      </div>
      <div className="rail-widget">
        <h3 className="rail-widget-title mb-3">Categories</h3>
        <div className="space-y-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors capitalize ${
                activeCategory === cat
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <PageShell title="Community Feed" subtitle="Ideas, feedback, and builds" rail={rail}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (authChecked && !user) {
    return (
      <PageShell title="Community Feed" subtitle="Ideas, feedback, and builds">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-slate-400 mb-4">Log in to read and post in the community feed.</p>
          <Link href="/login" className="btn-primary">Log In</Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Community Feed" subtitle="Ideas, feedback, and builds from builders" rail={rail}>
      {/* Mobile new post CTA */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <div className="flex gap-2 flex-wrap">
          {categories.slice(0, 4).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                activeCategory === cat
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                  : "border-slate-700/40 text-slate-400 hover:text-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <Link href="/posts/new" className="btn-primary text-sm px-4 py-2 flex-shrink-0">
          + Post
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400 mb-4">No posts yet.</p>
          <Link href="/posts/new" className="btn-primary">Be the first to post</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const author = post.users?.username || post.users?.name || "Someone";
            const catStyle = CATEGORY_STYLES[post.category] ?? "bg-slate-500/10 text-slate-400 border border-slate-500/20";
            const isOwn = user?.id === post.author_id;

            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="card card-hover block p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize ${catStyle}`}>
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-500">{formatTimeAgo(post.created_at)}</span>
                      {isOwn && (
                        <span className="text-xs text-slate-600">· yours</span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-100 leading-snug mb-1">
                      {post.title}
                    </h2>
                    {post.body && (
                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                        {post.body}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">by {author}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
