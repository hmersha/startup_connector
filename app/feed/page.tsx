"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AppShell from "@/components/AppShell";

// === TYPES ===

type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author_id: string;
  users?: { name: string; email: string; username: string | null } | null;
};

type PostWithMeta = Post & {
  commentCount: number;
  timeAgo: string;
  dayGroup: string;
  isFromConnection: boolean;
};

type SavedBuilder = {
  id: string;
  username: string | null;
  name: string | null;
  stage: string | null;
};

type FilterType = "all" | "idea" | "feedback" | "question" | "showcase" | "connections";

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

function getDayGroup(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const postDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (postDay.getTime() === today.getTime()) return "Today";
  if (postDay.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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
          <span className="toast-icon">{toast.type === "success" ? "✓" : "ℹ"}</span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// === MAIN COMPONENT ===

export default function FeedPage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userReputation, setUserReputation] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isSearching, setIsSearching] = useState(false);

  // Right rail data
  const [savedBuilders, setSavedBuilders] = useState<SavedBuilder[]>([]);
  const [myPendingPosts, setMyPendingPosts] = useState<PostWithMeta[]>([]);

  // Live presence data
  const [activeNow, setActiveNow] = useState(0);
  const [ideasToday, setIdeasToday] = useState(0);
  const [connectionsMade, setConnectionsMade] = useState(0);

  // Streak data
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

  // === DATA LOADING ===

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
        connectionsResult,
        profileResult,
        activeResult,
        ideasTodayResult,
        connectionsWeekResult,
        savedBuildersResult,
      ] = await Promise.all([
        supabase
          .from("posts")
          .select("*, users(name, email, username)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("comments").select("id, post_id"),
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
        supabase
          .from("saved_builders")
          .select("saved_user_id, users:saved_user_id(id, username, name, stage)")
          .eq("user_id", currentUser.id)
          .limit(5),
      ]);

      // Build connected IDs set
      const connIds = new Set<string>();
      connectionsResult.data?.forEach((conn) => {
        connIds.add(conn.requester_id === currentUser.id ? conn.addressee_id : conn.requester_id);
      });
      setConnectedIds(connIds);

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
          dayGroup: getDayGroup(post.created_at),
          isFromConnection: connIds.has(post.author_id),
        }));
        setPosts(postsWithMeta);

        // My posts waiting for feedback
        const myPending = postsWithMeta.filter(
          (p) => p.author_id === currentUser.id && p.commentCount === 0
        );
        setMyPendingPosts(myPending);
      }

      if (profileResult.data) setUserReputation(profileResult.data.reputation);

      // Presence stats
      setActiveNow(activeResult.count ?? Math.floor(Math.random() * 8) + 3);
      setIdeasToday(ideasTodayResult.count ?? 0);
      setConnectionsMade(connectionsWeekResult.count ?? 0);

      // Saved builders
      if (savedBuildersResult.data) {
        const builders = savedBuildersResult.data
          .map((row) => row.users as unknown as SavedBuilder)
          .filter(Boolean);
        setSavedBuilders(builders);
      }

      // Load saved posts from localStorage
      const savedKey = `startup-connector-saved-${currentUser.id}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        try {
          setSavedPostIds(new Set(JSON.parse(saved)));
        } catch {}
      }

      // Streak logic
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

  // === SEARCH ===

  const handleSearch = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) {
        setSearchQuery("");
        return;
      }

      setIsSearching(true);
      setSearchQuery(query);

      const { data } = await supabase
        .from("posts")
        .select("*, users(name, email, username)")
        .or(`title.ilike.%${query}%,body.ilike.%${query}%,category.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) {
        const { data: comments } = await supabase
          .from("comments")
          .select("id, post_id")
          .in("post_id", data.map((p) => p.id));

        const commentCounts = new Map<string, number>();
        comments?.forEach((c) => {
          commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
        });

        const postsWithMeta: PostWithMeta[] = data.map((post) => ({
          ...post,
          commentCount: commentCounts.get(post.id) || 0,
          timeAgo: formatTimeAgo(post.created_at),
          dayGroup: getDayGroup(post.created_at),
          isFromConnection: connectedIds.has(post.author_id),
        }));
        setPosts(postsWithMeta);
      }

      setIsSearching(false);
    },
    [user, connectedIds]
  );

  const clearSearch = useCallback(async () => {
    setSearchQuery("");
    setActiveFilter("all");

    if (!user) return;

    const { data } = await supabase
      .from("posts")
      .select("*, users(name, email, username)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const { data: comments } = await supabase
        .from("comments")
        .select("id, post_id")
        .in("post_id", data.map((p) => p.id));

      const commentCounts = new Map<string, number>();
      comments?.forEach((c) => {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
      });

      const postsWithMeta: PostWithMeta[] = data.map((post) => ({
        ...post,
        commentCount: commentCounts.get(post.id) || 0,
        timeAgo: formatTimeAgo(post.created_at),
        dayGroup: getDayGroup(post.created_at),
        isFromConnection: connectedIds.has(post.author_id),
      }));
      setPosts(postsWithMeta);
    }
  }, [user, connectedIds]);

  // === DERIVED DATA ===

  // "Needs Feedback" - posts with 0-1 comments, not by viewer
  const needsFeedback = useMemo(() => {
    if (!user) return [];
    return posts
      .filter((p) => p.author_id !== user.id && p.commentCount <= 1)
      .slice(0, 4);
  }, [posts, user]);

  // Filtered posts for "Recent Activity"
  const filteredPosts = useMemo(() => {
    if (!user) return [];

    let filtered = posts.filter((p) => p.author_id !== user.id || p.commentCount > 1);

    if (activeFilter === "connections") {
      filtered = filtered.filter((p) => p.isFromConnection);
    } else if (activeFilter !== "all") {
      filtered = filtered.filter((p) => p.category === activeFilter);
    }

    return filtered;
  }, [posts, activeFilter, user]);

  // Group by day
  const groupedPosts = useMemo(() => {
    const groups: Record<string, PostWithMeta[]> = {};
    filteredPosts.forEach((post) => {
      if (!groups[post.dayGroup]) {
        groups[post.dayGroup] = [];
      }
      groups[post.dayGroup].push(post);
    });
    return groups;
  }, [filteredPosts]);

  // === ACTIONS ===

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
      <AppShell
        rightRail={
          <div className="space-y-5">
            <div className="skeleton h-32 rounded-xl" />
            <div className="skeleton h-40 rounded-xl" />
            <div className="skeleton h-32 rounded-xl" />
          </div>
        }
      >
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-8 w-64 rounded-full" />
          </div>
          {/* Search skeleton */}
          <div className="skeleton h-12 rounded-xl" />
          {/* Tiles skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
          {/* Posts skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  // === NOT LOGGED IN ===
  if (authChecked && !user) {
    return (
      <AppShell>
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
          <Link href="/login" className="btn-primary">Log in to continue</Link>
        </div>
      </AppShell>
    );
  }

  // === RIGHT RAIL ===
  const rightRailContent = (
    <>
      {/* Streak & Rep Card */}
      <div className="rail-widget">
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
          <span className="streak-next">{25 - (userReputation % 25)} to next level</span>
        </div>
      </div>

      {/* My Posts Waiting for Feedback */}
      {myPendingPosts.length > 0 && (
        <div className="rail-widget">
          <div className="rail-widget-header">
            <h3 className="rail-widget-title">Waiting for feedback</h3>
            <span className="feed-rail-count">{myPendingPosts.length}</span>
          </div>
          <div className="feed-pending-list">
            {myPendingPosts.slice(0, 3).map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="feed-pending-item">
                <span className={`feed-pending-category feed-pending-${post.category}`}>
                  {post.category}
                </span>
                <span className="feed-pending-title">{post.title}</span>
                <span className="feed-pending-time">{post.timeAgo}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Saved Builders */}
      {savedBuilders.length > 0 && (
        <div className="rail-widget">
          <div className="rail-widget-header">
            <h3 className="rail-widget-title">Saved builders</h3>
            <Link href="/discover" className="rail-widget-link">View all</Link>
          </div>
          <div className="feed-saved-builders">
            {savedBuilders.map((builder) => (
              <div key={builder.id} className="feed-saved-builder">
                <div className="feed-saved-avatar">
                  {(builder.username || builder.name || "?")[0].toUpperCase()}
                </div>
                <span className="feed-saved-name">{builder.username || builder.name}</span>
                {builder.stage && (
                  <span className="feed-saved-stage">{builder.stage}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // Count for display
  const displayCount = searchQuery
    ? posts.length
    : filteredPosts.length + needsFeedback.length;

  // === MAIN RENDER ===
  return (
    <AppShell rightRail={rightRailContent}>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header + Status Pills */}
      <header className="feed-header-v2">
        <div className="feed-greeting-v2">
          <h1 className="feed-greeting-title">{getGreeting()}</h1>
          <p className="feed-greeting-subtitle">Here's what's happening in your network</p>
        </div>
        <div className="feed-status-pills">
          <div className="feed-status-pill">
            <span className="feed-status-dot feed-status-dot-live" />
            <span className="feed-status-value">{activeNow}</span>
            <span className="feed-status-label">active</span>
          </div>
          <div className="feed-status-pill">
            <span className="feed-status-value">{ideasToday}</span>
            <span className="feed-status-label">ideas today</span>
          </div>
          <div className="feed-status-pill">
            <span className="feed-status-value">{connectionsMade}</span>
            <span className="feed-status-label">connections</span>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="feed-search-bar">
        <svg className="feed-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search posts by title, body, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
          className="feed-search-input"
        />
        {searchQuery && (
          <button onClick={clearSearch} className="feed-search-clear" aria-label="Clear search">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <button
          onClick={() => handleSearch(searchQuery)}
          disabled={!searchQuery.trim() || isSearching}
          className="feed-search-btn"
        >
          {isSearching ? "..." : "Search"}
        </button>
      </div>

      {/* Search Results Status */}
      {searchQuery && (
        <div className="feed-search-status">
          <span className="feed-search-results">
            {posts.length} result{posts.length !== 1 ? "s" : ""} for "{searchQuery}"
          </span>
          <button onClick={clearSearch} className="feed-search-clear-link">
            Clear search
          </button>
        </div>
      )}

      {/* Primary Action Tiles */}
      {!searchQuery && (
        <section className="feed-action-tiles">
          <Link href="/posts/new?category=idea" className="feed-action-tile feed-action-idea">
            <div className="feed-action-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="feed-action-title">Share an idea</span>
            <span className="feed-action-desc">Get early feedback</span>
          </Link>

          <button
            onClick={() => document.getElementById("needs-feedback")?.scrollIntoView({ behavior: "smooth" })}
            className="feed-action-tile feed-action-feedback"
          >
            <div className="feed-action-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="feed-action-title">Give feedback</span>
            <span className="feed-action-desc">{needsFeedback.length} waiting</span>
          </button>

          <Link href="/discover" className="feed-action-tile feed-action-discover">
            <div className="feed-action-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <span className="feed-action-title">Find builders</span>
            <span className="feed-action-desc">Discover teammates</span>
          </Link>
        </section>
      )}

      {/* Needs Feedback Section */}
      {!searchQuery && needsFeedback.length > 0 && (
        <section id="needs-feedback" className="feed-section">
          <div className="feed-section-header">
            <h2 className="feed-section-title">Needs Feedback</h2>
            <span className="feed-section-hint">Be the first to help</span>
          </div>
          <div className="feed-needs-feedback-grid">
            {needsFeedback.map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="feed-feedback-card">
                <div className="feed-feedback-header">
                  <span className={`feed-feedback-category feed-cat-${post.category}`}>
                    {post.category}
                  </span>
                  <span className="feed-feedback-time">{post.timeAgo}</span>
                </div>
                <h3 className="feed-feedback-title">{post.title}</h3>
                <p className="feed-feedback-preview">
                  {post.body.length > 80 ? post.body.slice(0, 80) + "..." : post.body}
                </p>
                <div className="feed-feedback-footer">
                  <div className="feed-feedback-author">
                    <span className="feed-feedback-avatar">
                      {(post.users?.name ?? "?")[0].toUpperCase()}
                    </span>
                    <span className="feed-feedback-author-name">
                      {post.users?.username || post.users?.name || "Someone"}
                    </span>
                  </div>
                  <span className="feed-feedback-cta">Help →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Activity Section */}
      <section className="feed-section">
        <div className="feed-section-header">
          <h2 className="feed-section-title">
            {searchQuery ? "Search Results" : "Recent Activity"}
          </h2>
          {!searchQuery && (
            <Link href="/posts/new" className="feed-new-post-link">
              New post
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          )}
        </div>

        {/* Filter Chips */}
        {!searchQuery && (
          <div className="feed-filter-chips">
            {(["all", "idea", "feedback", "question", "showcase", "connections"] as FilterType[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`feed-filter-chip ${activeFilter === filter ? "feed-filter-chip-active" : ""}`}
              >
                {filter === "all" ? "All" :
                 filter === "connections" ? "From Connections" :
                 filter.charAt(0).toUpperCase() + filter.slice(1) + "s"}
              </button>
            ))}
          </div>
        )}

        {/* Posts List Grouped by Day */}
        {Object.keys(groupedPosts).length === 0 ? (
          <div className="feed-empty-state">
            <svg className="feed-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="feed-empty-text">
              {searchQuery
                ? "No posts match your search."
                : activeFilter === "connections"
                ? "No posts from your connections yet."
                : "No posts yet. Be the first to share something!"}
            </p>
            {!searchQuery && (
              <Link href="/posts/new" className="btn-primary mt-4">Create a post</Link>
            )}
          </div>
        ) : (
          <div className="feed-posts-grouped">
            {Object.entries(groupedPosts).map(([day, dayPosts]) => (
              <div key={day} className="feed-day-group">
                <h3 className="feed-day-label">{day}</h3>
                <div className="feed-day-posts">
                  {dayPosts.map((post) => (
                    <article key={post.id} className="feed-post-card">
                      <Link href={`/posts/${post.id}`} className="feed-post-main">
                        <div className="feed-post-avatar">
                          {(post.users?.name ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="feed-post-content">
                          <div className="feed-post-meta">
                            <span className="feed-post-author">
                              {post.users?.username || post.users?.name || "Someone"}
                            </span>
                            <span className="feed-post-dot">·</span>
                            <span className="feed-post-time">{post.timeAgo}</span>
                            <span className={`feed-post-category feed-cat-${post.category}`}>
                              {post.category}
                            </span>
                            {post.isFromConnection && (
                              <span className="feed-post-connection">connection</span>
                            )}
                          </div>
                          <h3 className="feed-post-title">{post.title}</h3>
                          <p className="feed-post-preview">
                            {post.body.length > 120 ? post.body.slice(0, 120) + "..." : post.body}
                          </p>
                        </div>
                      </Link>
                      <div className="feed-post-actions">
                        <Link
                          href={`/posts/${post.id}`}
                          className="feed-post-action"
                          title={`${post.commentCount} comments`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>{post.commentCount}</span>
                        </Link>
                        <button
                          onClick={() => toggleSave(post.id)}
                          className={`feed-post-action ${savedPostIds.has(post.id) ? "feed-post-action-active" : ""}`}
                          title={savedPostIds.has(post.id) ? "Remove from saved" : "Save for later"}
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
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
