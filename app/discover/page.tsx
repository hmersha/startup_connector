"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AppShell from "@/components/AppShell";
import ProposeSprintModal from "@/components/ProposeSprintModal";

// === TYPES ===

type BuilderProfile = {
  id: string;
  username: string | null;
  name: string | null;
  email: string;
  school: string | null;
  major: string | null;
  reputation: number;
  one_liner: string | null;
  categories: string[];
  stage: string | null;
  looking_for: string[];
  skills: string[];
  availability: string | null;
  visibility: string;
  last_active_at: string | null;
  // Signal fields
  project_name: string | null;
  traction_signal: string | null;
  collaboration_intent: string | null;
  commitment_level: string | null;
  working_style: string | null;
  equity_intent: string | null;
  timezone: string | null;
};

type Connection = {
  requester_id: string;
  addressee_id: string;
  status: string;
};

type MatchFeedback = {
  target_user_id: string;
  action: string;
};

type SavedBuilder = {
  saved_user_id: string;
};

type RecentPost = {
  id: string;
  title: string;
  category: string;
  created_at: string;
  users: { name: string; username: string | null }[];
};

type ScoredBuilder = BuilderProfile & {
  score: number;
  matchReasons: string[];
};

type Tab = "for-you" | "all-builders";

// === MATCHING ALGORITHM ===

const STAGE_ORDER = ["idea", "prototype", "users", "revenue"];

const SKILL_COMPLEMENT_MAP: Record<string, string[]> = {
  cofounder: ["leadership", "business", "strategy"],
  developer: ["frontend", "backend", "fullstack", "mobile", "devops"],
  designer: ["design", "ui", "ux", "product"],
  marketer: ["marketing", "growth", "sales", "content"],
  advisor: ["leadership", "strategy", "fundraising"],
};

function getStageDistance(stage1: string | null, stage2: string | null): number {
  if (!stage1 || !stage2) return -1;
  const idx1 = STAGE_ORDER.indexOf(stage1);
  const idx2 = STAGE_ORDER.indexOf(stage2);
  if (idx1 === -1 || idx2 === -1) return -1;
  return Math.abs(idx1 - idx2);
}

function computeMatchScore(
  candidate: BuilderProfile,
  currentUser: {
    id: string;
    categories: string[];
    stage: string | null;
    looking_for: string[];
    skills: string[];
    school: string | null;
    collaboration_intent: string | null;
  },
  connectedIds: Set<string>,
  pendingIds: Set<string>,
  dismissedIds: Set<string>,
  sprintCounts: Map<string, number>
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (connectedIds.has(candidate.id) || pendingIds.has(candidate.id)) {
    return { score: -100, reasons: [] };
  }

  if (dismissedIds.has(candidate.id)) {
    return { score: -50, reasons: [] };
  }

  const categoryOverlap = candidate.categories.filter((c) =>
    currentUser.categories.includes(c)
  );
  if (categoryOverlap.length > 0) {
    score += categoryOverlap.length * 4;
    reasons.push(`Interested in ${categoryOverlap.slice(0, 2).join(", ")}`);
  }

  const stageDistance = getStageDistance(candidate.stage, currentUser.stage);
  if (stageDistance === 0) {
    score += 5;
    reasons.push(`Same stage: ${candidate.stage}`);
  } else if (stageDistance === 1) {
    score += 2;
  }

  let complementCount = 0;
  for (const lookingFor of currentUser.looking_for) {
    const complementarySkills = SKILL_COMPLEMENT_MAP[lookingFor] || [];
    const hasComplement = candidate.skills.some((s) =>
      complementarySkills.includes(s.toLowerCase())
    );
    if (hasComplement) complementCount++;
  }
  if (complementCount > 0) {
    score += complementCount * 4;
    reasons.push(`Has skills you're looking for`);
  }

  for (const theirLookingFor of candidate.looking_for) {
    const complementarySkills = SKILL_COMPLEMENT_MAP[theirLookingFor] || [];
    const iMatch = currentUser.skills.some((s) =>
      complementarySkills.includes(s.toLowerCase())
    );
    if (iMatch) {
      score += 3;
      if (!reasons.includes("You have skills they need")) {
        reasons.push("You have skills they need");
      }
      break;
    }
  }

  if (
    currentUser.school &&
    candidate.school &&
    currentUser.school.toLowerCase() === candidate.school.toLowerCase()
  ) {
    score += 2;
    reasons.push(`Same school`);
  }

  if (candidate.last_active_at) {
    const lastActive = new Date(candidate.last_active_at);
    const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 1) {
      score += 2;
      reasons.push("Active today");
    } else if (daysSinceActive < 7) {
      score += 1;
    }
  }

  if (candidate.one_liner) score += 1;

  // Phase 9: sprint history — proven follow-through
  const candidateSprintCount = sprintCounts.get(candidate.id) ?? 0;
  if (candidateSprintCount >= 3) {
    score += 5;
    reasons.push("Proven collaborator");
  } else if (candidateSprintCount >= 1) {
    score += 3;
    reasons.push("Has sprinted before");
  }

  // Phase 9: collaboration intent alignment
  if (
    candidate.collaboration_intent &&
    currentUser.collaboration_intent &&
    candidate.collaboration_intent === currentUser.collaboration_intent
  ) {
    score += 3;
    reasons.push("Aligned on collaboration style");
  }

  if (reasons.length === 0 && score > 0) {
    reasons.push("Potential collaborator");
  }

  return { score, reasons };
}

// === HELPER FUNCTIONS ===

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

// === BUILDER CARD COMPONENT ===

const COLLAB_INTENT_LABELS: Record<string, string> = {
  equal_cofounder: "Equal Cofounder",
  trial_collaboration: "Trial Collaboration",
  founding_teammate: "Founding Teammate",
  advisor_mentor: "Advisor / Mentor",
  feedback_only: "Feedback Only",
  project_collaborator: "Project Collaborator",
};

function BuilderCard({
  builder,
  isSaved,
  isPending,
  isConnected,
  onPass,
  onConnect,
  onSave,
  onProposeSprint,
  isConnecting,
  showMatchReasons = false,
  sprintCount = 0,
}: {
  builder: ScoredBuilder | BuilderProfile;
  isSaved: boolean;
  isPending: boolean;
  isConnected: boolean;
  onPass: () => void;
  onConnect: () => void;
  onSave: () => void;
  onProposeSprint: () => void;
  isConnecting: boolean;
  showMatchReasons?: boolean;
  sprintCount?: number;
}) {
  const displayName = builder.username || builder.name || "Builder";
  const initials = displayName.slice(0, 2).toUpperCase();
  const isPrivate = builder.visibility === "private";
  const showDetails = !isPrivate || isConnected;
  const scoredBuilder = "matchReasons" in builder ? builder : null;

  const isActiveBuilder =
    builder.last_active_at &&
    (Date.now() - new Date(builder.last_active_at).getTime()) / 86400000 < 7;
  const hasClearIntent = Boolean(builder.collaboration_intent);
  const hasProject = Boolean(builder.project_name);
  const hasTraction = Boolean(builder.traction_signal);
  const hasSprintHistory = sprintCount > 0;

  return (
    <div className="discover-card-v2">
      {/* Header */}
      <div className="discover-card-header-v2">
        <div className="discover-avatar-v2">
          <span>{initials}</span>
        </div>
        <div className="discover-card-info">
          <h3 className="discover-card-name">{displayName}</h3>
          {showDetails && builder.project_name && (
            <p className="builder-project-name">{builder.project_name}</p>
          )}
          {showDetails && !builder.project_name && builder.school && (
            <p className="discover-card-school">{builder.school}</p>
          )}
        </div>
        <button
          onClick={onSave}
          className={`discover-save-btn ${isSaved ? "discover-save-btn-active" : ""}`}
          title={isSaved ? "Remove from saved" : "Save builder"}
        >
          <svg className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* Trust badges */}
      {showDetails && (isActiveBuilder || hasClearIntent || hasProject || hasSprintHistory) && (
        <div className="builder-trust-badges">
          {hasSprintHistory && (
            <span className="trust-badge trust-badge-sprint">
              {sprintCount === 1 ? "Sprinted once" : `${sprintCount} sprints`}
            </span>
          )}
          {isActiveBuilder && <span className="trust-badge trust-badge-active">Active this week</span>}
          {hasClearIntent && <span className="trust-badge trust-badge-intent">Clear intent</span>}
          {hasProject && hasTraction && <span className="trust-badge trust-badge-momentum">Has momentum</span>}
        </div>
      )}

      {/* One-liner */}
      {showDetails && builder.one_liner ? (
        <p className="discover-card-oneliner">{builder.one_liner}</p>
      ) : isPrivate && !isConnected ? (
        <p className="discover-card-private">Connect to see full profile</p>
      ) : !builder.one_liner ? (
        <p className="discover-card-empty">No bio yet</p>
      ) : null}

      {/* Traction signal */}
      {showDetails && builder.traction_signal && (
        <p className="builder-traction-signal">
          <svg className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
          {builder.traction_signal}
        </p>
      )}

      {/* Stage + collaboration intent */}
      {showDetails && (builder.stage || builder.collaboration_intent) && (
        <div className="discover-card-stage">
          {builder.stage && (
            <span className={`discover-stage-badge discover-stage-${builder.stage}`}>
              {builder.stage}
            </span>
          )}
          {builder.collaboration_intent && (
            <span className="builder-intent-badge">
              {COLLAB_INTENT_LABELS[builder.collaboration_intent] ?? builder.collaboration_intent}
            </span>
          )}
          {builder.commitment_level && (
            <span className="discover-availability">{builder.commitment_level}</span>
          )}
        </div>
      )}

      {/* Chips */}
      {showDetails && (
        <div className="discover-card-chips">
          {builder.categories.slice(0, 2).map((cat) => (
            <span key={cat} className="discover-chip discover-chip-category">{cat}</span>
          ))}
          {builder.looking_for.slice(0, 2).map((lf) => (
            <span key={lf} className="discover-chip discover-chip-looking">{lf}</span>
          ))}
          {builder.skills.slice(0, 1).map((skill) => (
            <span key={skill} className="discover-chip discover-chip-skill">{skill}</span>
          ))}
        </div>
      )}

      {/* Match Reasons */}
      {showMatchReasons && scoredBuilder && scoredBuilder.matchReasons.length > 0 && (
        <div className="discover-card-reasons">
          {scoredBuilder.matchReasons.slice(0, 2).map((reason, i) => (
            <span key={i} className="discover-reason">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="discover-card-actions">
        {isConnected ? (
          <Link href="/messages" className="discover-action-btn discover-action-message">Message</Link>
        ) : (
          <div className="discover-actions-v2">
            <button onClick={onProposeSprint} className="sprint-propose-btn">
              Propose Sprint
            </button>
            <div className="discover-secondary-actions">
              {isPending ? (
                <span className="discover-action-pending text-xs">Sent</span>
              ) : (
                <button onClick={onConnect} disabled={isConnecting} className="discover-action-sm discover-action-connect">
                  {isConnecting ? "..." : "Connect"}
                </button>
              )}
              <button onClick={onPass} className="discover-action-sm discover-action-pass">Pass</button>
              <button onClick={onSave} className={`discover-action-sm ${isSaved ? "text-indigo-400" : "text-slate-500"}`}>
                {isSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// === SAVED BUILDERS ROW ===

function SavedBuilderRow({
  builder,
  onRemove,
  onConnect,
  isPending,
  isConnected,
}: {
  builder: BuilderProfile;
  onRemove: () => void;
  onConnect: () => void;
  isPending: boolean;
  isConnected: boolean;
}) {
  const displayName = builder.username || builder.name || "Builder";

  return (
    <div className="saved-builder-row">
      <div className="saved-builder-avatar">
        {displayName.slice(0, 1).toUpperCase()}
      </div>
      <div className="saved-builder-info">
        <span className="saved-builder-name">{displayName}</span>
        {builder.stage && (
          <span className="saved-builder-stage">{builder.stage}</span>
        )}
      </div>
      <div className="saved-builder-actions">
        {isConnected ? (
          <Link href="/messages" className="text-xs text-indigo-400 hover:text-indigo-300">
            Message
          </Link>
        ) : isPending ? (
          <span className="text-xs text-slate-500">Pending</span>
        ) : (
          <button
            onClick={onConnect}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Connect
          </button>
        )}
        <button onClick={onRemove} className="saved-builder-remove" title="Remove">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// === COMMUNITY HIGHLIGHTS ===

function CommunityHighlights({ posts }: { posts: RecentPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="rail-widget">
      <div className="rail-widget-header">
        <h3 className="rail-widget-title">Community Highlights</h3>
        <Link href="/feed" className="rail-widget-link">See all</Link>
      </div>
      <div className="community-posts">
        {posts.map((post) => (
          <Link key={post.id} href={`/posts/${post.id}`} className="community-post">
            <div className="community-post-header">
              <span className={`community-post-category community-post-${post.category}`}>
                {post.category}
              </span>
              <span className="community-post-time">{formatTimeAgo(post.created_at)}</span>
            </div>
            <h4 className="community-post-title">{post.title}</h4>
            <p className="community-post-author">
              by {post.users?.[0]?.username || post.users?.[0]?.name || "Someone"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// === MAIN PAGE ===

export default function DiscoverPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<BuilderProfile | null>(null);
  const [candidates, setCandidates] = useState<BuilderProfile[]>([]);
  const [allBuilders, setAllBuilders] = useState<BuilderProfile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [feedbacks, setFeedbacks] = useState<MatchFeedback[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savedBuilders, setSavedBuilders] = useState<BuilderProfile[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("for-you");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [sprintModalBuilder, setSprintModalBuilder] = useState<BuilderProfile | null>(null);
  const [sprintCounts, setSprintCounts] = useState<Map<string, number>>(new Map());

  // Pagination for All Builders
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setAuthChecked(true);
      setLoading(false);
      return;
    }

    const currentUser = authData.user;
    setUser(currentUser);
    setAuthChecked(true);

    // Fetch in parallel
    const [
      profileResult,
      candidatesResult,
      allBuildersResult,
      connectionsResult,
      feedbackResult,
      savedResult,
      postsResult,
      completedSprintsResult,
    ] = await Promise.all([
      // Current user's profile
      supabase.from("users").select("*").eq("id", currentUser.id).single(),
      // For You: public + match_only
      supabase
        .from("users")
        .select("*")
        .neq("id", currentUser.id)
        .in("visibility", ["public", "match_only"])
        .limit(100),
      // All Builders: public + private only (NOT match_only)
      supabase
        .from("users")
        .select("*")
        .neq("id", currentUser.id)
        .in("visibility", ["public", "private"])
        .order("reputation", { ascending: false })
        .limit(200),
      // Connections
      supabase
        .from("connections")
        .select("requester_id, addressee_id, status")
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`),
      // Match feedback
      supabase
        .from("match_feedback")
        .select("target_user_id, action")
        .eq("user_id", currentUser.id),
      // Saved builders
      supabase
        .from("saved_builders")
        .select("saved_user_id")
        .eq("user_id", currentUser.id),
      // Recent posts for community highlights
      supabase
        .from("posts")
        .select("id, title, category, created_at, users(name, username)")
        .order("created_at", { ascending: false })
        .limit(5),
      // Completed sprint counts for trust signals + ranking
      supabase
        .from("sprints")
        .select("proposer_id, recipient_id")
        .eq("status", "completed"),
    ]);

    if (profileResult.data) {
      setUserProfile(profileResult.data as BuilderProfile);
    }

    if (candidatesResult.data) {
      setCandidates(candidatesResult.data as BuilderProfile[]);
    }

    if (allBuildersResult.data) {
      setAllBuilders(allBuildersResult.data as BuilderProfile[]);
    }

    if (connectionsResult.data) {
      setConnections(connectionsResult.data);
    }

    if (feedbackResult.data) {
      setFeedbacks(feedbackResult.data);
    }

    if (savedResult.data) {
      const ids = new Set(savedResult.data.map((s: SavedBuilder) => s.saved_user_id));
      setSavedIds(ids);
    }

    if (postsResult.data) {
      setRecentPosts(postsResult.data as unknown as RecentPost[]);
    }

    if (completedSprintsResult.data) {
      const counts = new Map<string, number>();
      completedSprintsResult.data.forEach((s: { proposer_id: string; recipient_id: string }) => {
        counts.set(s.proposer_id, (counts.get(s.proposer_id) ?? 0) + 1);
        counts.set(s.recipient_id, (counts.get(s.recipient_id) ?? 0) + 1);
      });
      setSprintCounts(counts);
    }

    setLoading(false);
  }, []);

  // Load saved builders details when savedIds change
  useEffect(() => {
    async function loadSavedBuilders() {
      if (savedIds.size === 0) {
        setSavedBuilders([]);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("*")
        .in("id", [...savedIds]);

      if (data) {
        setSavedBuilders(data as BuilderProfile[]);
      }
    }

    loadSavedBuilders();
  }, [savedIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build connection lookup sets
  const { connectedIds, pendingIds } = useMemo(() => {
    const connected = new Set<string>();
    const pending = new Set<string>();

    if (!userProfile) return { connectedIds: connected, pendingIds: pending };

    connections.forEach((c) => {
      const otherId = c.requester_id === userProfile.id ? c.addressee_id : c.requester_id;
      if (c.status === "accepted") {
        connected.add(otherId);
      } else if (c.status === "pending") {
        pending.add(otherId);
      }
    });

    return { connectedIds: connected, pendingIds: pending };
  }, [userProfile, connections]);

  // Dismissed IDs from feedback
  const dismissedIds = useMemo(() => {
    const ids = new Set<string>();
    feedbacks.forEach((f) => {
      if (f.action === "dismiss") ids.add(f.target_user_id);
    });
    return ids;
  }, [feedbacks]);

  // Compute "For You" matches
  const forYouMatches = useMemo(() => {
    if (!userProfile || candidates.length === 0) return [];

    const scored: ScoredBuilder[] = candidates
      .filter((c) => !passedIds.has(c.id) && !dismissedIds.has(c.id))
      .map((candidate) => {
        const { score, reasons } = computeMatchScore(
          candidate,
          {
            id: userProfile.id,
            categories: userProfile.categories || [],
            stage: userProfile.stage,
            looking_for: userProfile.looking_for || [],
            skills: userProfile.skills || [],
            school: userProfile.school,
            collaboration_intent: userProfile.collaboration_intent,
          },
          connectedIds,
          pendingIds,
          dismissedIds,
          sprintCounts
        );
        return { ...candidate, score, matchReasons: reasons };
      })
      .filter((c) => c.score > -50)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return scored;
  }, [userProfile, candidates, connectedIds, pendingIds, dismissedIds, passedIds, sprintCounts]);

  // Paginated All Builders
  const paginatedBuilders = useMemo(() => {
    const filtered = allBuilders.filter((b) => !passedIds.has(b.id));
    const start = 0;
    const end = page * PAGE_SIZE;
    return filtered.slice(start, end);
  }, [allBuilders, page, passedIds]);

  const hasMoreBuilders = useMemo(() => {
    const filtered = allBuilders.filter((b) => !passedIds.has(b.id));
    return filtered.length > page * PAGE_SIZE;
  }, [allBuilders, page, passedIds]);

  // Actions
  const handleConnect = useCallback(
    async (targetId: string) => {
      if (!user) return;
      setConnectingId(targetId);

      const { error } = await supabase.from("connections").insert({
        requester_id: user.id,
        addressee_id: targetId,
        status: "pending",
      });

      if (!error) {
        setConnections((prev) => [
          ...prev,
          { requester_id: user.id, addressee_id: targetId, status: "pending" },
        ]);
      }

      setConnectingId(null);
    },
    [user]
  );

  const handlePass = useCallback(
    async (targetId: string) => {
      if (!user) return;

      // Record as dismiss feedback
      await supabase.from("match_feedback").upsert(
        { user_id: user.id, target_user_id: targetId, action: "dismiss" },
        { onConflict: "user_id,target_user_id" }
      );

      setPassedIds((prev) => new Set([...prev, targetId]));
      setFeedbacks((prev) => [
        ...prev.filter((f) => f.target_user_id !== targetId),
        { target_user_id: targetId, action: "dismiss" },
      ]);
    },
    [user]
  );

  const handleSave = useCallback(
    async (targetId: string) => {
      if (!user) return;

      const wasSaved = savedIds.has(targetId);

      if (wasSaved) {
        // Unsave
        await supabase
          .from("saved_builders")
          .delete()
          .eq("user_id", user.id)
          .eq("saved_user_id", targetId);

        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      } else {
        // Save
        await supabase.from("saved_builders").insert({
          user_id: user.id,
          saved_user_id: targetId,
        });

        setSavedIds((prev) => new Set([...prev, targetId]));
      }
    },
    [user, savedIds]
  );

  // Check if user has builder card
  const hasBuilderCard =
    userProfile &&
    ((userProfile.categories && userProfile.categories.length > 0) ||
      userProfile.stage ||
      (userProfile.looking_for && userProfile.looking_for.length > 0));

  // === RENDER ===

  if (loading) {
    return (
      <AppShell
        title="Find teammates for your next venture"
        rightRail={
          <div className="space-y-5">
            <div className="skeleton h-48 rounded-xl" />
          </div>
        }
      >
        <div className="discover-tabs-skeleton">
          <div className="skeleton h-10 w-24 rounded-lg" />
          <div className="skeleton h-10 w-28 rounded-lg" />
        </div>
        <div className="discover-grid-v2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-72 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (authChecked && !user) {
    return (
      <AppShell>
        <div className="discover-cta">
          <div className="discover-cta-icon">
            <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="discover-cta-title">Find your co-founders</h1>
          <p className="discover-cta-text">
            Log in to discover builders who match your interests and goals.
          </p>
          <Link href="/login" className="btn-primary">Log in to discover</Link>
        </div>
      </AppShell>
    );
  }

  // Right rail content
  const rightRailContent = (
    <>
      {/* Saved Builders */}
      {savedBuilders.length > 0 && (
        <div className="rail-widget">
          <div className="rail-widget-header">
            <h3 className="rail-widget-title">Saved Builders</h3>
            <span className="text-xs text-slate-500">{savedBuilders.length}</span>
          </div>
          <div className="saved-builders-list">
            {savedBuilders.slice(0, 5).map((builder) => (
              <SavedBuilderRow
                key={builder.id}
                builder={builder}
                onRemove={() => handleSave(builder.id)}
                onConnect={() => handleConnect(builder.id)}
                isPending={pendingIds.has(builder.id)}
                isConnected={connectedIds.has(builder.id)}
              />
            ))}
            {savedBuilders.length > 5 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                +{savedBuilders.length - 5} more saved
              </p>
            )}
          </div>
        </div>
      )}

      {/* Community Highlights */}
      <CommunityHighlights posts={recentPosts} />
    </>
  );

  const currentBuilders = activeTab === "for-you" ? forYouMatches : paginatedBuilders;

  return (
    <>
    <AppShell
      title="Find teammates for your next venture"
      rightRail={rightRailContent}
    >
      {/* Tabs */}
      <div className="discover-tabs">
        <button
          onClick={() => setActiveTab("for-you")}
          className={`discover-tab ${activeTab === "for-you" ? "discover-tab-active" : ""}`}
        >
          For You
          {forYouMatches.length > 0 && (
            <span className="discover-tab-count">{forYouMatches.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("all-builders")}
          className={`discover-tab ${activeTab === "all-builders" ? "discover-tab-active" : ""}`}
        >
          All Builders
        </button>
      </div>

      {/* Builder Card Incomplete Notice */}
      {!hasBuilderCard && (
        <div className="discover-notice">
          <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">
            Complete your Builder Card to get better matches and appear in others' results.
          </span>
          <Link href="/profile?tab=builder" className="btn-primary text-sm px-3 py-1.5">
            Complete Profile
          </Link>
        </div>
      )}

      {/* Empty State */}
      {currentBuilders.length === 0 ? (
        <div className="discover-empty">
          <div className="discover-empty-icon">
            <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="discover-empty-title">
            {activeTab === "for-you" ? "No matches yet" : "No builders found"}
          </h2>
          <p className="discover-empty-text">
            {activeTab === "for-you"
              ? !hasBuilderCard
                ? "Complete your Builder Card to get matched with other builders."
                : "Try expanding your categories or skills in your profile to find more matches."
              : "Check back soon as more builders join the community."}
          </p>
          {!hasBuilderCard && (
            <Link href="/profile?tab=builder" className="btn-primary">
              Complete Builder Card
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="discover-grid-v2">
            {currentBuilders.map((builder) => (
              <BuilderCard
                key={builder.id}
                builder={builder}
                isSaved={savedIds.has(builder.id)}
                isPending={pendingIds.has(builder.id)}
                isConnected={connectedIds.has(builder.id)}
                onPass={() => handlePass(builder.id)}
                onConnect={() => handleConnect(builder.id)}
                onSave={() => handleSave(builder.id)}
                onProposeSprint={() => setSprintModalBuilder(builder)}
                isConnecting={connectingId === builder.id}
                showMatchReasons={activeTab === "for-you"}
                sprintCount={sprintCounts.get(builder.id) ?? 0}
              />
            ))}
          </div>

          {/* Load More (All Builders only) */}
          {activeTab === "all-builders" && hasMoreBuilders && (
            <div className="discover-load-more">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary"
              >
                Load More Builders
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>

    {sprintModalBuilder && user && (
      <ProposeSprintModal
        builder={sprintModalBuilder}
        currentUserId={user.id}
        onClose={() => setSprintModalBuilder(null)}
      />
    )}
    </>
  );
}
