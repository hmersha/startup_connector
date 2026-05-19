"use client";

import { useState, useEffect, useMemo, useCallback, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// === TYPES ===

type Post = {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author_id: string;
  users?: { id: string; name: string; email: string; username: string | null } | null;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  users?: { name: string; username: string | null } | null;
};

type PostWithMeta = Post & {
  commentCount: number;
  timeAgo: string;
  isFromConnection: boolean;
};

type BuilderMatch = {
  id: string;
  username: string | null;
  name: string | null;
  one_liner: string | null;
  categories: string[];
  looking_for: string[];
  skills: string[];
};

type UserProfile = {
  id: string;
  reputation: number;
  categories: string[];
  looking_for: string[];
  skills: string[];
};

type ReactionType = "interested" | "useful" | "curious";

type FeedbackStatus = "idle" | "saving" | "success" | "error";

// === HELPERS ===

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "1d";
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function findOverlaps(user: UserProfile, builder: BuilderMatch): string[] {
  const overlaps: string[] = [];
  const userCats = new Set(user.categories || []);
  const userSkills = new Set(user.skills || []);

  builder.categories?.forEach(c => {
    if (userCats.has(c)) overlaps.push(c);
  });
  builder.skills?.forEach(s => {
    if (userSkills.has(s)) overlaps.push(s);
  });

  return overlaps.slice(0, 2);
}

// === TOAST SYSTEM ===

type Toast = { id: string; message: string; type: "success" | "info" | "error" };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="hub-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`hub-toast hub-toast-${toast.type}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
          aria-live="polite"
        >
          <span className="hub-toast-icon">
            {toast.type === "success" ? "✓" : toast.type === "error" ? "!" : "•"}
          </span>
          <span className="hub-toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// === SKELETON COMPONENTS ===

function SkeletonPulse({ className = "" }: { className?: string }) {
  return <div className={`hub-skeleton ${className}`} />;
}

function FeedbackCardSkeleton() {
  return (
    <div className="hub-feedback-card hub-feedback-card-skeleton">
      <div className="hub-feedback-top">
        <SkeletonPulse className="w-14 h-4 rounded" />
        <SkeletonPulse className="w-8 h-3 rounded" />
      </div>
      <SkeletonPulse className="w-full h-4 rounded mb-2" />
      <SkeletonPulse className="w-3/4 h-3 rounded mb-1" />
      <SkeletonPulse className="w-1/2 h-3 rounded mb-3" />
      <div className="hub-feedback-footer">
        <SkeletonPulse className="w-20 h-3 rounded" />
        <SkeletonPulse className="w-12 h-3 rounded" />
      </div>
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="hub-post hub-post-skeleton">
      <div className="hub-post-main">
        <SkeletonPulse className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="hub-post-content">
          <div className="hub-post-meta mb-2">
            <SkeletonPulse className="w-24 h-3 rounded" />
            <SkeletonPulse className="w-8 h-3 rounded" />
            <SkeletonPulse className="w-14 h-4 rounded" />
          </div>
          <SkeletonPulse className="w-3/4 h-4 rounded mb-2" />
          <SkeletonPulse className="w-full h-3 rounded mb-1" />
          <SkeletonPulse className="w-2/3 h-3 rounded" />
        </div>
      </div>
      <div className="hub-post-actions">
        <div className="hub-reactions">
          <SkeletonPulse className="w-7 h-7 rounded" />
          <SkeletonPulse className="w-7 h-7 rounded" />
          <SkeletonPulse className="w-7 h-7 rounded" />
        </div>
        <SkeletonPulse className="w-10 h-6 rounded" />
      </div>
    </div>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="hub-match-card hub-match-card-skeleton">
      <div className="hub-match-main">
        <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="hub-match-info">
          <SkeletonPulse className="w-24 h-4 rounded mb-1" />
          <SkeletonPulse className="w-32 h-3 rounded" />
        </div>
      </div>
      <div className="hub-match-actions">
        <SkeletonPulse className="w-6 h-6 rounded" />
        <SkeletonPulse className="w-16 h-6 rounded" />
      </div>
    </div>
  );
}

function ModuleSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="hub-module hub-module-skeleton">
      <div className="hub-module-header">
        <SkeletonPulse className="w-28 h-4 rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonPulse key={i} className="w-full h-8 rounded" />
        ))}
      </div>
    </div>
  );
}

// === EMPTY STATE COMPONENTS ===

function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="hub-empty-state">
      <div className="hub-empty-icon">{icon}</div>
      <h3 className="hub-empty-title">{title}</h3>
      <p className="hub-empty-description">{description}</p>
      {actions && <div className="hub-empty-actions">{actions}</div>}
    </div>
  );
}

// === MAIN COMPONENT ===

export default function FeedPage() {
  // Core state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Search with debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Post detail panel (right rail)
  const [selectedPost, setSelectedPost] = useState<PostWithMeta | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reactions (stored in localStorage for now, used as signals)
  const [reactions, setReactions] = useState<Record<string, ReactionType>>({});

  // Builder matches for rail
  const [builderMatches, setBuilderMatches] = useState<BuilderMatch[]>([]);
  const [dismissedBuilders, setDismissedBuilders] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // My pending posts
  const [myPendingPosts, setMyPendingPosts] = useState<PostWithMeta[]>([]);

  // Presence stats
  const [activeNow, setActiveNow] = useState(0);
  const [ideasToday, setIdeasToday] = useState(0);
  const [newConnections, setNewConnections] = useState(0);

  // Streak
  const [streak, setStreak] = useState(0);


  // Comment submission status
  const [commentStatus, setCommentStatus] = useState<FeedbackStatus>("idle");

  // Reaction feedback status
  const [reactionStatus, setReactionStatus] = useState<Record<string, FeedbackStatus>>({});

  // Toast helper
  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
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

      const [
        postsResult,
        commentsResult,
        connectionsResult,
        profileResult,
        activeResult,
        ideasTodayResult,
        connectionsWeekResult,
        matchCandidatesResult,
      ] = await Promise.all([
        supabase
          .from("posts")
          .select("*, users(id, name, email, username)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("comments").select("id, post_id"),
        supabase
          .from("connections")
          .select("requester_id, addressee_id, status")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`),
        supabase
          .from("users")
          .select("id, reputation, categories, looking_for, skills")
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
          .from("users")
          .select("id, username, name, one_liner, categories, looking_for, skills")
          .neq("id", currentUser.id)
          .in("visibility", ["public", "match_only"])
          .limit(20),
      ]);

      // Build connection sets
      const connIds = new Set<string>();
      const pendIds = new Set<string>();
      connectionsResult.data?.forEach((conn) => {
        const otherId = conn.requester_id === currentUser.id ? conn.addressee_id : conn.requester_id;
        if (conn.status === "accepted") connIds.add(otherId);
        else if (conn.status === "pending") pendIds.add(otherId);
      });
      setConnectedIds(connIds);
      setPendingIds(pendIds);

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
          isFromConnection: connIds.has(post.author_id),
        }));
        setPosts(postsWithMeta);

        const myPending = postsWithMeta.filter(
          (p) => p.author_id === currentUser.id && p.commentCount === 0
        );
        setMyPendingPosts(myPending);
      }

      if (profileResult.data) {
        setUserProfile(profileResult.data as UserProfile);
      }

      // Builder matches (filter out connected/pending)
      if (matchCandidatesResult.data) {
        const filtered = matchCandidatesResult.data.filter(
          (b) => !connIds.has(b.id) && !pendIds.has(b.id)
        );
        setBuilderMatches(filtered.slice(0, 5) as BuilderMatch[]);
      }

      // Presence stats
      setActiveNow(activeResult.count ?? Math.floor(Math.random() * 8) + 3);
      setIdeasToday(ideasTodayResult.count ?? 0);
      setNewConnections(connectionsWeekResult.count ?? 0);

      // Load reactions from localStorage
      const reactionsKey = `hub-reactions-${currentUser.id}`;
      const savedReactions = localStorage.getItem(reactionsKey);
      if (savedReactions) {
        try {
          setReactions(JSON.parse(savedReactions));
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

  // === DEBOUNCED SEARCH ===

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setDebouncedQuery("");
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    async function performSearch() {
      if (!user || !debouncedQuery.trim()) return;

      setIsSearching(true);

      const { data } = await supabase
        .from("posts")
        .select("*, users(id, name, email, username)")
        .or(`title.ilike.%${debouncedQuery}%,body.ilike.%${debouncedQuery}%,category.ilike.%${debouncedQuery}%`)
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
          isFromConnection: connectedIds.has(post.author_id),
        }));
        setPosts(postsWithMeta);
      }

      setIsSearching(false);
    }

    performSearch();
  }, [debouncedQuery, user, connectedIds]);

  const clearSearch = useCallback(async () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedPost(null);

    if (!user) return;

    const { data } = await supabase
      .from("posts")
      .select("*, users(id, name, email, username)")
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
        isFromConnection: connectedIds.has(post.author_id),
      }));
      setPosts(postsWithMeta);
    }
  }, [user, connectedIds]);

  // === DERIVED DATA ===

  const needsFeedback = useMemo(() => {
    if (!user) return [];
    return posts
      .filter((p) => p.author_id !== user.id && p.commentCount <= 1)
      .slice(0, 4);
  }, [posts, user]);

  const activityPosts = useMemo(() => {
    if (!user) return [];
    return posts.filter((p) => p.author_id !== user.id || p.commentCount > 1);
  }, [posts, user]);

  const visibleMatches = useMemo(() => {
    return builderMatches.filter((b) => !dismissedBuilders.has(b.id));
  }, [builderMatches, dismissedBuilders]);

  // === POST DETAIL PANEL ===

  const openPostDetail = useCallback(async (post: PostWithMeta) => {
    setSelectedPost(post);
    setLoadingComments(true);
    setPostComments([]);

    const { data } = await supabase
      .from("comments")
      .select("*, users(name, username)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data) {
      setPostComments(data as Comment[]);
    }
    setLoadingComments(false);
  }, []);

  const closePostDetail = useCallback(() => {
    setSelectedPost(null);
    setPostComments([]);
    setNewComment("");
  }, []);

  const submitComment = useCallback(async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    setSubmittingComment(true);
    setCommentStatus("saving");

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: selectedPost.id,
        author_id: user.id,
        body: newComment.trim(),
      })
      .select("*, users(name, username)")
      .single();

    if (!error && data) {
      setPostComments((prev) => [...prev, data as Comment]);
      setNewComment("");
      setCommentStatus("success");
      showToast("Comment posted", "success");

      // Update comment count in posts
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, commentCount: p.commentCount + 1 } : p
        )
      );

      // Reset status after brief feedback
      setTimeout(() => setCommentStatus("idle"), 1500);
    } else {
      setCommentStatus("error");
      showToast("Failed to post comment", "error");
      setTimeout(() => setCommentStatus("idle"), 2000);
    }

    setSubmittingComment(false);
  }, [user, selectedPost, newComment, showToast]);

  // === REACTIONS ===

  const handleReaction = useCallback(
    (postId: string, reaction: ReactionType) => {
      if (!user) return;

      // Show brief visual feedback
      setReactionStatus((prev) => ({ ...prev, [postId]: "saving" }));

      setReactions((prev) => {
        const current = prev[postId];
        const next = current === reaction ? undefined : reaction;
        const updated = { ...prev };
        if (next) {
          updated[postId] = next;
        } else {
          delete updated[postId];
        }
        localStorage.setItem(`hub-reactions-${user.id}`, JSON.stringify(updated));
        return updated;
      });

      // Brief success feedback
      setTimeout(() => {
        setReactionStatus((prev) => ({ ...prev, [postId]: "success" }));
        setTimeout(() => {
          setReactionStatus((prev) => ({ ...prev, [postId]: "idle" }));
        }, 300);
      }, 100);
    },
    [user]
  );

  // === BUILDER ACTIONS ===

  const handleConnect = useCallback(
    async (builderId: string) => {
      if (!user) return;
      setConnectingId(builderId);

      const { error } = await supabase.from("connections").insert({
        requester_id: user.id,
        addressee_id: builderId,
        status: "pending",
      });

      if (!error) {
        setPendingIds((prev) => new Set([...prev, builderId]));
        showToast("Connection request sent", "success");
      }

      setConnectingId(null);
    },
    [user, showToast]
  );

  const handleDismissBuilder = useCallback((builderId: string) => {
    setDismissedBuilders((prev) => new Set([...prev, builderId]));
  }, []);

  // === KEYBOARD HANDLERS ===

  const handleSearchKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      clearSearch();
      (e.target as HTMLInputElement).blur();
    }
  }, [clearSearch]);


  // === LOADING STATE ===

  if (loading) {
    return (
      <div className="hub-shell">
        {/* Skeleton Header */}
        <header className="hub-header">
          <div className="hub-header-left">
            <SkeletonPulse className="w-32 h-6 rounded" />
            <div className="hub-pulse">
              <SkeletonPulse className="w-20 h-4 rounded" />
              <span className="hub-pulse-sep">·</span>
              <SkeletonPulse className="w-16 h-4 rounded" />
              <span className="hub-pulse-sep">·</span>
              <SkeletonPulse className="w-24 h-4 rounded" />
            </div>
          </div>
          <div className="hub-header-right">
            <SkeletonPulse className="w-48 h-10 rounded-lg" />
            <SkeletonPulse className="w-28 h-10 rounded-lg" />
          </div>
        </header>

        <div className="hub-grid">
          <main className="hub-main">
            {/* Needs Feedback Section Skeleton */}
            <section className="hub-section">
              <div className="hub-section-header">
                <SkeletonPulse className="w-28 h-4 rounded" />
                <SkeletonPulse className="w-24 h-3 rounded" />
              </div>
              <div className="hub-feedback-grid">
                {[1, 2, 3, 4].map((i) => (
                  <FeedbackCardSkeleton key={i} />
                ))}
              </div>
            </section>

            {/* Activity Section Skeleton */}
            <section className="hub-section">
              <div className="hub-section-header">
                <SkeletonPulse className="w-28 h-4 rounded" />
              </div>
              <div className="hub-activity-list">
                {[1, 2, 3, 4, 5].map((i) => (
                  <PostSkeleton key={i} />
                ))}
              </div>
            </section>
          </main>

          <aside className="hub-rail">
            {/* Builder Matches Skeleton */}
            <div className="hub-module">
              <div className="hub-module-header">
                <SkeletonPulse className="w-28 h-4 rounded" />
                <SkeletonPulse className="w-12 h-3 rounded" />
              </div>
              <div className="hub-match-deck">
                {[1, 2, 3].map((i) => (
                  <MatchCardSkeleton key={i} />
                ))}
              </div>
            </div>

            {/* Momentum Skeleton */}
            <ModuleSkeleton lines={2} />

            {/* Pending Skeleton */}
            <ModuleSkeleton lines={3} />
          </aside>
        </div>
      </div>
    );
  }

  // === NOT LOGGED IN ===

  if (authChecked && !user) {
    return (
      <div className="hub-shell">
        <div className="hub-auth-prompt">
          <div className="hub-auth-icon">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="hub-auth-title">Community Hub</h1>
          <p className="hub-auth-text">
            See what builders are working on, share ideas, and find teammates.
          </p>
          <Link href="/login" className="btn-primary">Log in to continue</Link>
        </div>
      </div>
    );
  }

  // === CONTEXT RAIL CONTENT ===

  const railContent = selectedPost ? (
    // Post Detail Panel
    <div className="hub-detail-panel">
      <div className="hub-detail-header">
        <h3 className="hub-detail-title">Post Details</h3>
        <button onClick={closePostDetail} className="hub-detail-close" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="hub-detail-content">
        <div className="hub-detail-meta">
          <span className={`hub-cat hub-cat-${selectedPost.category}`}>{selectedPost.category}</span>
          <span className="hub-detail-time">{selectedPost.timeAgo}</span>
        </div>
        <h2 className="hub-detail-post-title">{selectedPost.title}</h2>
        <p className="hub-detail-body">{selectedPost.body}</p>
        <div className="hub-detail-author">
          <div className="hub-detail-avatar">
            {(selectedPost.users?.name ?? "?")[0].toUpperCase()}
          </div>
          <span className="hub-detail-author-name">
            {selectedPost.users?.username || selectedPost.users?.name || "Someone"}
          </span>
        </div>
      </div>

      <div className="hub-detail-comments">
        <h4 className="hub-detail-comments-title">
          Comments ({postComments.length})
        </h4>

        {loadingComments ? (
          <div className="hub-detail-loading">Loading comments...</div>
        ) : postComments.length === 0 ? (
          <p className="hub-detail-no-comments">No comments yet. Be the first!</p>
        ) : (
          <div className="hub-comment-list">
            {postComments.map((comment) => (
              <div key={comment.id} className="hub-comment">
                <div className="hub-comment-avatar">
                  {(comment.users?.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="hub-comment-content">
                  <div className="hub-comment-meta">
                    <span className="hub-comment-author">
                      {comment.users?.username || comment.users?.name || "Someone"}
                    </span>
                    <span className="hub-comment-time">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="hub-comment-body">{comment.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hub-comment-form">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey && newComment.trim()) {
                submitComment();
              }
            }}
            placeholder="Add a comment..."
            className="hub-comment-input"
            rows={2}
            aria-label="Write a comment"
          />
          <button
            onClick={submitComment}
            disabled={!newComment.trim() || submittingComment}
            className={`hub-comment-submit ${
              commentStatus === "success" ? "hub-comment-submit-success" :
              commentStatus === "error" ? "hub-comment-submit-error" : ""
            }`}
          >
            {commentStatus === "saving" ? (
              <span className="hub-btn-loading">
                <span className="hub-spinner" />
                Posting...
              </span>
            ) : commentStatus === "success" ? (
              <span className="hub-btn-success">✓ Posted</span>
            ) : commentStatus === "error" ? (
              <span className="hub-btn-error">Failed</span>
            ) : (
              "Post"
            )}
          </button>
          <span className="hub-comment-hint">⌘ + Enter to submit</span>
        </div>
      </div>
    </div>
  ) : (
    // Default Rail Modules
    <>
      {/* Module 1: Builder Matches */}
      <div className="hub-module">
        <div className="hub-module-header">
          <h3 className="hub-module-title">Builder Matches</h3>
          <Link href="/discover" className="hub-module-link">See all</Link>
        </div>
        {visibleMatches.length > 0 ? (
          <div className="hub-match-deck">
            {visibleMatches.slice(0, 3).map((builder) => {
              const overlaps = userProfile ? findOverlaps(userProfile, builder) : [];
              const isPending = pendingIds.has(builder.id);

              return (
                <div key={builder.id} className="hub-match-card">
                  <div className="hub-match-main">
                    <div className="hub-match-avatar">
                      {(builder.username || builder.name || "?")[0].toUpperCase()}
                    </div>
                    <div className="hub-match-info">
                      <span className="hub-match-name">
                        {builder.username || builder.name}
                      </span>
                      {builder.one_liner && (
                        <span className="hub-match-liner">{builder.one_liner}</span>
                      )}
                      {overlaps.length > 0 && (
                        <div className="hub-match-overlaps">
                          {overlaps.map((o) => (
                            <span key={o} className="hub-match-overlap">{o}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="hub-match-actions">
                    <button
                      onClick={() => handleDismissBuilder(builder.id)}
                      className="hub-match-dismiss"
                      aria-label="Not interested"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {isPending ? (
                      <span className="hub-match-pending">Pending</span>
                    ) : (
                      <button
                        onClick={() => handleConnect(builder.id)}
                        disabled={connectingId === builder.id}
                        className="hub-match-connect"
                      >
                        {connectingId === builder.id ? (
                          <span className="hub-btn-loading">
                            <span className="hub-spinner-sm" />
                          </span>
                        ) : (
                          "Connect"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="hub-module-empty">
            <p className="hub-module-empty-text">No new matches right now</p>
            <Link href="/profile" className="hub-module-empty-link">
              Update your profile to get better matches
            </Link>
          </div>
        )}
      </div>

      {/* Module 2: Your Momentum */}
      <div className="hub-module">
        <div className="hub-module-header">
          <h3 className="hub-module-title">Your Momentum</h3>
        </div>
        <div className="hub-momentum">
          <div className="hub-momentum-streak">
            <span className="hub-momentum-flame">
              {streak >= 7 ? "🔥" : streak >= 3 ? "✨" : "💫"}
            </span>
            <div className="hub-momentum-info">
              <span className="hub-momentum-days">{streak} day streak</span>
              <span className="hub-momentum-label">Keep it going!</span>
            </div>
          </div>
          <div className="hub-momentum-rep">
            <div className="hub-momentum-rep-bar">
              <div
                className="hub-momentum-rep-fill"
                style={{ width: `${Math.min(100, (userProfile?.reputation || 0) % 25 * 4)}%` }}
              />
            </div>
            <div className="hub-momentum-rep-text">
              <span>{userProfile?.reputation || 0} rep</span>
              <span>{25 - ((userProfile?.reputation || 0) % 25)} to next level</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module 3: Waiting for Feedback */}
      <div className="hub-module">
        <div className="hub-module-header">
          <h3 className="hub-module-title">Waiting for Feedback</h3>
          {myPendingPosts.length > 0 && (
            <span className="hub-module-count">{myPendingPosts.length}</span>
          )}
        </div>
        {myPendingPosts.length > 0 ? (
          <div className="hub-pending-list">
            {myPendingPosts.slice(0, 3).map((post) => (
              <button
                key={post.id}
                onClick={() => openPostDetail(post)}
                className="hub-pending-item"
              >
                <span className={`hub-cat hub-cat-${post.category}`}>{post.category}</span>
                <span className="hub-pending-title">{post.title}</span>
                <span className="hub-pending-time">{post.timeAgo}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="hub-module-empty">
            <p className="hub-module-empty-text">No posts awaiting feedback</p>
            <Link href="/posts/new?category=feedback" className="hub-module-empty-link">
              Request feedback on something →
            </Link>
          </div>
        )}
      </div>
    </>
  );

  // === MAIN RENDER ===

  return (
    <div className="hub-shell">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Strip */}
      <header className="hub-header">
        <div className="hub-header-left">
          <h1 className="hub-greeting">{getGreeting()}</h1>
          <div className="hub-pulse">
            <span className="hub-pulse-item">
              <span className="hub-pulse-dot" />
              <span className="hub-pulse-value">{activeNow}</span>
              <span className="hub-pulse-label">active</span>
            </span>
            <span className="hub-pulse-sep">·</span>
            <span className="hub-pulse-item">
              <span className="hub-pulse-value">{ideasToday}</span>
              <span className="hub-pulse-label">ideas</span>
            </span>
            <span className="hub-pulse-sep">·</span>
            <span className="hub-pulse-item">
              <span className="hub-pulse-value">{newConnections}</span>
              <span className="hub-pulse-label">new connections</span>
            </span>
          </div>
        </div>

        <div className="hub-header-right">
          {/* Search */}
          <div className="hub-search" role="search">
            <svg className="hub-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="hub-search-input"
              aria-label="Search posts"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="hub-search-clear"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {isSearching && (
              <span className="hub-search-loading" aria-live="polite">
                <span className="hub-spinner" />
              </span>
            )}
          </div>

          {/* New Post CTA */}
          <Link href="/posts/new" className="hub-new-post-btn">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Post
          </Link>
        </div>
      </header>

      {/* Search Status */}
      {debouncedQuery && (
        <div className="hub-search-status">
          <span>{posts.length} results for "{debouncedQuery}"</span>
          <button onClick={clearSearch} className="hub-search-clear-link">Clear</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="hub-grid">
        {/* Main Column */}
        <main className="hub-main">
          {/* Needs Feedback Section */}
          {!debouncedQuery && needsFeedback.length > 0 && (
            <section className="hub-section">
              <div className="hub-section-header">
                <h2 className="hub-section-title">Needs Feedback</h2>
                <span className="hub-section-hint">Be the first to help</span>
              </div>
              <div className="hub-feedback-grid">
                {needsFeedback.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => openPostDetail(post)}
                    className="hub-feedback-card"
                  >
                    <div className="hub-feedback-top">
                      <span className={`hub-cat hub-cat-${post.category}`}>{post.category}</span>
                      <span className="hub-feedback-time">{post.timeAgo}</span>
                    </div>
                    <h3 className="hub-feedback-title">{post.title}</h3>
                    <p className="hub-feedback-preview">
                      {post.body.length > 60 ? post.body.slice(0, 60) + "..." : post.body}
                    </p>
                    <div className="hub-feedback-footer">
                      <span className="hub-feedback-author">
                        {post.users?.username || post.users?.name || "Someone"}
                      </span>
                      <span className="hub-feedback-cta">Help →</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Recent Activity */}
          <section className="hub-section">
            <div className="hub-section-header">
              <h2 className="hub-section-title">
                {debouncedQuery ? "Search Results" : "Recent Activity"}
              </h2>
            </div>

            {activityPosts.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                }
                title={debouncedQuery ? "No matching posts" : "No posts yet"}
                description={
                  debouncedQuery
                    ? `We couldn't find any posts matching "${debouncedQuery}". Try a different search or browse all posts.`
                    : "Be the first to share something with the community. Your ideas, questions, and progress updates help others."
                }
                actions={
                  debouncedQuery ? (
                    <button onClick={clearSearch} className="hub-empty-btn">
                      Clear search
                    </button>
                  ) : (
                    <div className="hub-empty-actions-row">
                      <Link href="/posts/new?category=idea" className="hub-empty-btn hub-empty-btn-primary">
                        Share an idea
                      </Link>
                      <Link href="/members" className="hub-empty-btn">
                        Invite someone
                      </Link>
                    </div>
                  )
                }
              />
            ) : (
              <div className="hub-activity-list">
                {activityPosts.map((post) => (
                  <article key={post.id} className="hub-post">
                    <button
                      onClick={() => openPostDetail(post)}
                      className="hub-post-main"
                    >
                      <div className="hub-post-avatar">
                        {(post.users?.name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="hub-post-content">
                        <div className="hub-post-meta">
                          <span className="hub-post-author">
                            {post.users?.username || post.users?.name || "Someone"}
                          </span>
                          <span className="hub-post-time">{post.timeAgo}</span>
                          <span className={`hub-cat hub-cat-${post.category}`}>{post.category}</span>
                          {post.isFromConnection && (
                            <span className="hub-post-connection">connection</span>
                          )}
                        </div>
                        <h3 className="hub-post-title">{post.title}</h3>
                        <p className="hub-post-preview">
                          {post.body.length > 100 ? post.body.slice(0, 100) + "..." : post.body}
                        </p>
                      </div>
                    </button>

                    {/* Quick Reactions + Comment Count */}
                    <div className={`hub-post-actions ${reactionStatus[post.id] === "success" ? "hub-post-actions-feedback" : ""}`}>
                      <div className="hub-reactions" role="group" aria-label="React to this post">
                        <button
                          onClick={() => handleReaction(post.id, "interested")}
                          className={`hub-reaction ${reactions[post.id] === "interested" ? "hub-reaction-active" : ""}`}
                          aria-label="Interested"
                          aria-pressed={reactions[post.id] === "interested"}
                        >
                          👀
                        </button>
                        <button
                          onClick={() => handleReaction(post.id, "useful")}
                          className={`hub-reaction ${reactions[post.id] === "useful" ? "hub-reaction-active" : ""}`}
                          aria-label="Useful"
                          aria-pressed={reactions[post.id] === "useful"}
                        >
                          💡
                        </button>
                        <button
                          onClick={() => handleReaction(post.id, "curious")}
                          className={`hub-reaction ${reactions[post.id] === "curious" ? "hub-reaction-active" : ""}`}
                          aria-label="Curious"
                          aria-pressed={reactions[post.id] === "curious"}
                        >
                          🤔
                        </button>
                      </div>
                      <button
                        onClick={() => openPostDetail(post)}
                        className="hub-post-comments"
                        aria-label={`${post.commentCount} comments, click to view`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post.commentCount}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Context Rail */}
        <aside className="hub-rail">
          {railContent}
        </aside>
      </div>
    </div>
  );
}
