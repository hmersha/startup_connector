"use client";

import { useState, useEffect, use } from "react";
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

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  users?: { name: string; email: string } | null;
};

export default function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
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

      // Only fetch post and comments if user is authenticated
      const [postResult, commentsResult] = await Promise.all([
        supabase
          .from("posts")
          .select("*, users(name, email)")
          .eq("id", id)
          .single(),
        supabase
          .from("comments")
          .select("*, users(name, email)")
          .eq("post_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (postResult.data) {
        setPost(postResult.data);
      }
      if (commentsResult.data) {
        setComments(commentsResult.data);
      }
      setLoading(false);
    }

    fetchData();
  }, [id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentBody.trim()) return;

    setSubmitting(true);
    setError("");

    const { data, error } = await supabase
      .from("comments")
      .insert({
        body: commentBody,
        post_id: id,
        author_id: user.id,
      })
      .select("*, users(name, email)")
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      setComments([...comments, data]);
      setCommentBody("");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Post</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600 mb-4">
            Please log in to view this post and its comments.
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

  if (!post) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
      </div>
    );
  }

  return (
    <div>
      <article className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {post.category}
          </span>
          <span className="text-xs text-gray-500">
            by {post.users?.name ?? "Unknown"}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-3">{post.title}</h1>
        <p className="text-gray-700 whitespace-pre-wrap">{post.body}</p>
      </article>

      <section>
        <h2 className="text-lg font-semibold mb-4">
          Comments ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-gray-500 mb-4">No comments yet.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-50 border border-gray-200 rounded p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {comment.users?.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{comment.body}</p>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form onSubmit={handleAddComment} className="space-y-3">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              required
              rows={3}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Write a comment..."
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Add Comment"}
            </button>
          </form>
        ) : (
          <p className="text-gray-500">Log in to add a comment.</p>
        )}
      </section>
    </div>
  );
}
