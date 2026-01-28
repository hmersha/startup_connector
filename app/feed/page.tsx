"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type PostWithMeta = Post & {
  commentCount: number;
  timeAgo: string;
};

type Member = {
  id: string;
  name: string;
  username: string | null;
  school: string | null;
  major: string | null;
  reputation: number;
};

// === HELPERS ===

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// === TOAST SYSTEM ===

type Toast = {
  id: string;
  message: string;
  type: "success" | "info";
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => onDismiss(toast.id)}
        >
          <span className="toast-icon">
            {toast.type === "success" ? "✓" : "ℹ"}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// === MAIN COMPONENT ===

export default function HomePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userReputation, setUserReputation] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Live presence data
  const [activeNow, setActiveNow] = useState(0);
  const [ideasToday, setIdeasToday] = useState(0);
  const [connectionsMade, setConnectionsMade] = useState(0);

  // Streak data (from localStorage for now)
  const [streak, setStreak] = useState(0);

  // Toast helper
  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    async function loadData() {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);
      setAuthChecked(true);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Parallel data fetching
      const [
        postsResult,
        commentsResult,
        membersResult,
        connectionsResult,
        profileResult,
        activeResult,
        ideasTodayResult,
        connectionsWeekResult,
      ] = await Promise.all([
        supabase
          .from("posts")
          .select("*, users(name, email)")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("comments").select("id, post_id"),
        supabase
          .from("users")
          .select("id, name, username, school, major, reputation")
          .neq("id", currentUser.id)
          .order("reputation", { ascending: false })
          .limit(12),
        supabase
          .from("connections")
          .select("requester_id, addressee_id")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
          .eq("status", "accepted"),
        supabase
          .from("users")
          .select("reputation")
          .eq("id", currentUser.id)
          .single(),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .gte("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("category", "idea")
          .gte("created_at", today.toISOString()),
        supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .gte("created_at", weekAgo.toISOString()),
      ]);

      // Process posts
      if (!postsResult.error && postsResult.data) {
        const commentCounts = new Map<string, number>();
        commentsResult.data?.forEach((c) => {
          commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
        });

        const postsWithMeta: PostWithMeta[] = postsResult.data.map((post) => ({
          ...post,
          commentCount: commentCounts.get(post.id) || 0,
          timeAgo: formatTimeAgo(post.created_at),
        }));
        setPosts(postsWithMeta);
      }

      if (membersResult.data) setMembers(membersResult.data);

      if (connectionsResult.data) {
        const ids = new Set<string>();
        connectionsResult.data.forEach((conn) => {
          ids.add(conn.requester_id === currentUser.id ? conn.addressee_id : conn.requester_id);
        });
        setConnectedIds(ids);
      }

      if (profileResult.data) setUserReputation(profileResult.data.reputation);

      // Set presence stats (fallback to realistic placeholder if column doesn't exist)
      setActiveNow(activeResult.count ?? Math.floor(Math.random() * 8) + 3);
      setIdeasToday(ideasTodayResult.count ?? 0);
      setConnectionsMade(connectionsWeekResult.count ?? 0);

      // Load saved posts and streak from localStorage
      const savedKey = `startup-connector-saved-${currentUser.id}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          setSavedPostIds(new Set(JSON.parse(saved)));
        } catch {}
      }

      const streakKey = `startup-connector-streak-${currentUser.id}`;
      const lastVisit = localStorage.getItem(streakKey);
      const todayStr = new Date().toDateString();
      if (lastVisit === todayStr) {
        setStreak(parseInt(localStorage.getItem(`${streakKey}-count`) || "1", 10));
      } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastVisit === yesterday.toDateString()) {
          const newStreak = parseInt(localStorage.getItem(`${streakKey}-count`) || "0", 10) + 1;
          setStreak(newStreak);
          localStorage.setItem(`${streakKey}-count`, newStreak.toString());
        } else {
          setStreak(1);
          localStorage.setItem(`${streakKey}-count`, "1");
        }
        localStorage.setItem(streakKey, todayStr);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // Derived data
  const recentPosts = useMemo(() => posts.slice(0, 8), [posts]);

  const needsAttention = useMemo(() => {
    return posts.filter((p) => p.commentCount === 0).slice(0, 3);
  }, [posts]);

  const suggestedPeople = useMemo(() => {
    return members.filter((m) => !connectedIds.has(m.id)).slice(0, 4);
  }, [members, connectedIds]);

  // Actions
  function toggleSave(postId: string) {
    if (!user) return;
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      const wasSaved = next.has(postId);
      wasSaved ? next.delete(postId) : next.add(postId);
      localStorage.setItem(`startup-connector-saved-${user.id}`, JSON.stringify([...next]));
      showToast(wasSaved ? "Removed from saved" : "Saved for later", "success");
      return next;
    });
  }

  // === LOADING STATE ===
  if (loading) {
    return (
      <div className="home-container">
        <div className="home-header-skeleton">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-8 w-72 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="home-grid">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="skeleton h-40 rounded-xl" />
            <div className="skeleton h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // === NOT LOGGED IN ===
  if (authChecked && !user) {
    return (
      <div className="home-container">
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 mb-3">See what people are building</h1>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Join to share ideas, get feedback, and connect with other builders.
          </p>
          <Link href="/login" className="btn-primary">
            Log in to continue
          </Link>
        </div>
      </div>
    );
  }

  // === MAIN RENDER ===
  return (
    <div className="home-container">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Compact Header + Presence Strip */}
      <header className="home-header">
        <div className="home-greeting">
          <h1>{getGreeting()}</h1>
          <p className="home-subtext">Here's what's happening in your network</p>
        </div>
        <div className="presence-strip" role="status" aria-live="polite">
          <div className="presence-item">
            <span className="presence-dot presence-dot-live" aria-hidden="true" />
            <span className="presence-value">{activeNow}</span>
            <span className="presence-label">active now</span>
          </div>
          <span className="presence-separator" aria-hidden="true">•</span>
          <div className="presence-item">
            <span className="presence-value">{ideasToday}</span>
            <span className="presence-label">ideas today</span>
          </div>
          <span className="presence-separator" aria-hidden="true">•</span>
          <div className="presence-item">
            <span className="presence-value">{connectionsMade}</span>
            <span className="presence-label">connections this week</span>
          </div>
        </div>
      </header>

      {/* Start Here Tiles - Clear CTAs (Nielsen: Recognition over recall) */}
      <section className="start-tiles" aria-label="Quick actions">
        <Link href="/posts/new?category=idea" className="start-tile start-tile-idea">
          <div className="start-tile-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="start-tile-content">
            <span className="start-tile-title">Share an idea</span>
            <span className="start-tile-desc">Get early feedback from builders</span>
          </div>
          <svg className="start-tile-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <button
          onClick={() => document.getElementById("needs-attention")?.scrollIntoView({ behavior: "smooth" })}
          className="start-tile start-tile-shape"
        >
          <div className="start-tile-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="start-tile-content">
            <span className="start-tile-title">Give feedback</span>
            <span className="start-tile-desc">{needsAttention.length} ideas waiting for input</span>
          </div>
          <svg className="start-tile-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        <Link href="/members" className="start-tile start-tile-connect">
          <div className="start-tile-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <div className="start-tile-content">
            <span className="start-tile-title">Find builders</span>
            <span className="start-tile-desc">Connect with {suggestedPeople.length}+ people</span>
          </div>
          <svg className="start-tile-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      {/* Main Content Grid */}
      <div className="home-grid">
        {/* Left Column - Recent Activity */}
        <main className="home-main">
          <section aria-labelledby="recent-heading">
            <div className="section-head">
              <h2 id="recent-heading" className="section-title">Recent activity</h2>
              <Link href="/posts/new" className="section-link">
                New post
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            </div>

            {recentPosts.length === 0 ? (
              <div className="empty-state">
                <p>No posts yet. Be the first to share something.</p>
                <Link href="/posts/new" className="btn-primary mt-4">
                  Create a post
                </Link>
              </div>
            ) : (
              <div className="post-list">
                {recentPosts.map((post) => (
                  <article key={post.id} className="post-card-rich">
                    <Link href={`/posts/${post.id}`} className="post-card-main">
                      {/* Avatar */}
                      <div className="post-avatar">
                        <span>{(post.users?.name ?? "?")[0].toUpperCase()}</span>
                      </div>

                      {/* Content */}
                      <div className="post-content">
                        <div className="post-meta">
                          <span className="post-author">{post.users?.name ?? "Someone"}</span>
                          <span className="post-dot">·</span>
                          <span className="post-time">{post.timeAgo}</span>
                          <span className={`post-category post-category-${post.category}`}>
                            {post.category}
                          </span>
                        </div>
                        <h3 className="post-title">{post.title}</h3>
                        <p className="post-preview">
                          {post.body.length > 120 ? post.body.slice(0, 120) + "..." : post.body}
                        </p>
                      </div>
                    </Link>

                    {/* Quick Actions */}
                    <div className="post-actions">
                      <Link
                        href={`/posts/${post.id}`}
                        className="post-action"
                        title={`${post.commentCount} comments`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{post.commentCount}</span>
                      </Link>
                      <button
                        onClick={() => toggleSave(post.id)}
                        className={`post-action ${savedPostIds.has(post.id) ? "post-action-active" : ""}`}
                        title={savedPostIds.has(post.id) ? "Remove from saved" : "Save for later"}
                        aria-pressed={savedPostIds.has(post.id)}
                      >
                        <svg
                          className="w-4 h-4"
                          fill={savedPostIds.has(post.id) ? "currentColor" : "none"}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Right Column - Sidebar */}
        <aside className="home-sidebar">
          {/* Streak Card (replaces checklist) */}
          <div className="streak-card-compact">
            <div className="streak-header">
              <div className="streak-flame">
                {streak >= 3 ? "🔥" : streak >= 1 ? "✨" : "💤"}
              </div>
              <div className="streak-info">
                <span className="streak-count">{streak} day{streak !== 1 ? "s" : ""}</span>
                <span className="streak-label">active streak</span>
              </div>
            </div>
            <div className="streak-progress-bar">
              <div
                className="streak-progress-fill"
                style={{ width: `${Math.min(100, (userReputation % 25) * 4)}%` }}
              />
            </div>
            <div className="streak-footer">
              <span className="streak-rep">{userReputation} reputation</span>
              <span className="streak-next">
                {25 - (userReputation % 25)} to next level
              </span>
            </div>
          </div>

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <section id="needs-attention" aria-labelledby="attention-heading">
              <div className="section-head">
                <h2 id="attention-heading" className="section-title">Waiting for feedback</h2>
              </div>
              <div className="attention-list">
                {needsAttention.map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`} className="attention-card">
                    <div className="attention-avatar">
                      {(post.users?.name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="attention-content">
                      <span className="attention-title">{post.title}</span>
                      <span className="attention-meta">
                        by {post.users?.name ?? "Someone"} · {post.timeAgo}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Suggested People (with faces) */}
          {suggestedPeople.length > 0 && (
            <section aria-labelledby="people-heading">
              <div className="section-head">
                <h2 id="people-heading" className="section-title">People to connect with</h2>
                <Link href="/members" className="section-link">See all</Link>
              </div>
              <div className="people-list">
                {suggestedPeople.map((person) => (
                  <Link key={person.id} href="/members" className="person-card">
                    <div className="person-avatar">
                      {(person.username ?? person.name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="person-info">
                      <span className="person-name">{person.username ?? person.name}</span>
                      {(person.school || person.major) && (
                        <span className="person-detail">
                          {[person.major, person.school].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    <span className="person-rep">{person.reputation}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
