"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author_id: string;
  users?: { name: string; email: string } | null;
};

type ActivityStats = {
  postsThisWeek: number;
  commentsThisWeek: number;
};

const TEMPLATES = [
  {
    id: 1,
    label: "Share what you're building",
    text: "I'm building ___ for ___ because ___",
    category: "idea",
  },
  {
    id: 2,
    label: "Ask for help",
    text: "I'm stuck on ___ — looking for help with ___",
    category: "idea",
  },
  {
    id: 3,
    label: "Post an update",
    text: "Update: I shipped ___; next I'm trying ___",
    category: "update",
  },
];

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState<ActivityStats>({ postsThisWeek: 0, commentsThisWeek: 0 });

  useEffect(() => {
    async function checkAuthAndFetchData() {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setUser(authData.user);
      setAuthChecked(true);

      // Fetch posts and activity stats in parallel
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekAgoISO = oneWeekAgo.toISOString();

      const [postsResult, postsCountResult, commentsCountResult] = await Promise.all([
        supabase
          .from("posts")
          .select("*, users(name, email)")
          .order("created_at", { ascending: false }),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgoISO),
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgoISO),
      ]);

      if (!postsResult.error) {
        setPosts(postsResult.data ?? []);
      }

      setStats({
        postsThisWeek: postsCountResult.count ?? 0,
        commentsThisWeek: commentsCountResult.count ?? 0,
      });

      setLoading(false);
    }

    checkAuthAndFetchData();
  }, []);

  const HeroSection = () => (
    <div className="text-center mb-10">
      <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
        What are you building?
      </h1>
      <p className="text-gray-500 max-w-md mx-auto mb-6">
        Share unfinished ideas. Get thoughtful responses from people who get it.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/posts/new?category=idea"
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Post an idea
        </Link>
        <Link
          href="/posts/new?category=update"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Share an update
        </Link>
      </div>
    </div>
  );

  const TemplatesSection = () => (
    <div className="mb-8">
      <p className="text-sm font-medium text-gray-600 mb-3">Start writing</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((template) => (
          <Link
            key={template.id}
            href={`/posts/new?category=${template.category}&template=${template.id}`}
            className="template-card group"
          >
            <p className="text-xs font-medium text-gray-500 mb-1.5 group-hover:text-indigo-600 transition-colors">
              {template.label}
            </p>
            <p className="text-sm text-gray-700 italic">"{template.text}"</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const ActivityStrip = () => (
    <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-8">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
        <span>{stats.postsThisWeek} post{stats.postsThisWeek !== 1 ? "s" : ""} this week</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
        <span>{stats.commentsThisWeek} comment{stats.commentsThisWeek !== 1 ? "s" : ""} this week</span>
      </div>
    </div>
  );

  const SkeletonCard = () => (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="skeleton w-14 h-5 rounded-full"></div>
        <div className="skeleton w-32 h-4"></div>
      </div>
      <div className="skeleton w-3/4 h-5 mb-2"></div>
      <div className="skeleton w-full h-4 mb-1"></div>
      <div className="skeleton w-2/3 h-4"></div>
    </div>
  );

  const FeedSection = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent posts</h2>
      </div>
      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="card card-hover block p-5 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={`pill ${post.category === "idea" ? "pill-idea" : "pill-update"}`}>
                {post.category}
              </span>
              <span className="text-xs text-gray-400">
                {post.users?.name ?? "Unknown"} · {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-gray-500 line-clamp-2">
              {post.body.length > 140 ? post.body.slice(0, 140) + "…" : post.body}
            </p>
            <div className="mt-3 flex items-center text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Read more
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  // Loading state with skeleton
  if (loading) {
    return (
      <div>
        <HeroSection />
        <TemplatesSection />
        <div className="flex items-center justify-center gap-6 text-sm text-gray-400 mb-8">
          <div className="skeleton w-28 h-4"></div>
          <div className="skeleton w-32 h-4"></div>
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  // Not logged in
  if (authChecked && !user) {
    return (
      <div>
        <HeroSection />
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-1">Join the community</p>
          <p className="text-sm text-gray-400 mb-4">Log in to see what others are building and share your own ideas.</p>
          <Link href="/login" className="btn-primary inline-block">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div>
        <HeroSection />
        <TemplatesSection />
        <ActivityStrip />
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-600 mb-1">No posts yet</p>
          <p className="text-sm text-gray-400 mb-4">Be the first to share what you're working on.</p>
          <Link href="/posts/new?category=idea" className="btn-primary inline-block">
            Create First Post
          </Link>
        </div>
      </div>
    );
  }

  // Main feed view
  return (
    <div>
      <HeroSection />
      <TemplatesSection />
      <ActivityStrip />
      <FeedSection />
    </div>
  );
}
