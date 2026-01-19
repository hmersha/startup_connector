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

  const NormsBox = () => (
    <div className="mb-6 p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
      <p className="font-medium text-gray-700 mb-1">Community Norms</p>
      <ul className="list-disc list-inside space-y-0.5 text-xs">
        <li>Be respectful and constructive in all interactions</li>
        <li>Share genuine opportunities and insights</li>
        <li>Keep conversations relevant to startups and collaboration</li>
      </ul>
    </div>
  );

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Feed</h1>
        <NormsBox />
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Feed</h1>
        <NormsBox />
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">
            Please log in to view posts and join the community.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Feed</h1>
        <NormsBox />
        <p className="text-gray-600">No posts yet. Be the first to post!</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Feed</h1>

      <NormsBox />

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="block border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {post.category}
              </span>
              <span className="text-xs text-gray-500">
                by {post.users?.name ?? "Unknown"}
              </span>
            </div>
            <h2 className="text-lg font-semibold mb-1">{post.title}</h2>
            <p className="text-gray-600 text-sm line-clamp-2">{post.body}</p>
            <p className="text-xs text-gray-400 mt-2">
              {new Date(post.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
