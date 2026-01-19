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
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setUser(authData.user);
      setAuthChecked(true);

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

  const SkeletonPost = () => (
    <div>
      <div className="mb-6">
        <div className="skeleton w-24 h-4"></div>
      </div>
      <div className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="skeleton w-14 h-5 rounded-full"></div>
          <div className="skeleton w-32 h-4"></div>
        </div>
        <div className="skeleton w-3/4 h-7 mb-4"></div>
        <div className="space-y-2">
          <div className="skeleton w-full h-4"></div>
          <div className="skeleton w-full h-4"></div>
          <div className="skeleton w-2/3 h-4"></div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <SkeletonPost />;
  }

  if (authChecked && !user) {
    return (
      <div>
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to feed
          </Link>
        </div>
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">
            Log in to view this post and join the conversation.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div>
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to feed
          </Link>
        </div>
        <div className="card p-8 text-center">
          <p className="text-gray-500">Post not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to feed
        </Link>
      </div>

      <article className="card p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className={`pill ${post.category === "idea" ? "pill-idea" : "pill-update"}`}>
            {post.category}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-white">
              {(post.users?.name ?? "U")[0].toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-gray-600">{post.users?.name ?? "Unknown"}</span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{post.body}</p>
        </div>
      </article>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
          {comments.length > 0 && (
            <span className="text-sm text-gray-400">({comments.length})</span>
          )}
        </div>

        {comments.length === 0 ? (
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Be the first to comment.</p>
                <p className="text-gray-400 text-xs mt-1">Ask a question, offer a resource, or just say hi.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {comments.map((comment) => (
              <div key={comment.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-white">
                      {(comment.users?.name ?? "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.users?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{comment.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {user && (
          <div className="card p-5">
            <form onSubmit={handleAddComment} className="space-y-4">
              <div>
                <label htmlFor="comment" className="label">
                  Add to the conversation
                </label>
                <textarea
                  id="comment"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  required
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Ask a clarifying question, share a resource, or offer encouragement..."
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Posting..." : "Comment"}
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
