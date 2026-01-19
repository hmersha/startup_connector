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

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function checkAuthAndFetchPosts() {
      // First check authentication
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        // No authenticated user - show login prompt
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setUser(authData.user);
      setAuthChecked(true);

      // Only fetch posts if user is authenticated
      const { data, error } = await supabase
        .from("posts")
        .select("*, users(name, email)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching posts:", error);
      } else {
        setPosts(data ?? []);
      }
      setLoading(false);
    }

    checkAuthAndFetchPosts();
  }, []);

  const Header = () => (
    <div className="mb-8">
      <h1 className="section-header">Feed</h1>
      <p className="section-subtitle">
        Ideas and updates from the community
      </p>
    </div>
  );

  const NormsBox = () => (
    <div className="card p-4 mb-8">
      <p className="text-sm font-medium text-gray-700 mb-2">Community Guidelines</p>
      <ul className="text-xs text-gray-500 space-y-1">
        <li className="flex items-start gap-2">
          <span className="text-indigo-400 mt-0.5">•</span>
          Be respectful and constructive in all interactions
        </li>
        <li className="flex items-start gap-2">
          <span className="text-indigo-400 mt-0.5">•</span>
          Share genuine opportunities and insights
        </li>
        <li className="flex items-start gap-2">
          <span className="text-indigo-400 mt-0.5">•</span>
          Keep conversations relevant to startups
        </li>
      </ul>
    </div>
  );

  if (loading) {
    return (
      <div>
        <Header />
        <NormsBox />
        <div className="card p-8 text-center">
          <p className="text-gray-500">Loading posts...</p>
        </div>
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div>
        <Header />
        <NormsBox />
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            Log in to view posts and join the community.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div>
        <Header />
        <NormsBox />
        <div className="card p-8 text-center">
          <p className="text-gray-500">No posts yet. Be the first to share!</p>
          <Link href="/posts/new" className="btn-primary inline-block mt-4">
            Create Post
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <NormsBox />

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="card card-hover block p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`pill ${post.category === "idea" ? "pill-idea" : "pill-update"}`}>
                {post.category}
              </span>
              <span className="text-xs text-gray-400">
                {post.users?.name ?? "Unknown"} · {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1.5">
              {post.title}
            </h2>
            <p className="text-sm text-gray-500 line-clamp-2">{post.body}</p>
            <div className="mt-3 text-xs font-medium text-indigo-600">
              View post →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
