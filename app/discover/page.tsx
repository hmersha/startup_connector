"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/PageShell";
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

// === DISCOVER REDESIGN HELPERS ===

const SPRINT_TYPE_LABELS: Record<string, string> = {
  validation: "Feedback Sprint",
  mvp_scope: "MVP Scope Sprint",
  build: "Build Sprint",
};

function getSuggestedSprint(builder: BuilderProfile): { type: string; goal: string } {
  const lookingFor = builder.looking_for || [];
  const hasTraction = Boolean(builder.traction_signal);
  const stage = builder.stage;

  if (lookingFor.some((l) => ["cofounder", "advisor"].includes(l))) {
    return {
      type: "validation",
      goal: `Get feedback on ${builder.project_name || "your idea"} and see if you're aligned`,
    };
  }
  if (stage === "idea" || stage === "prototype") {
    return {
      type: "mvp_scope",
      goal: `Map out the first version of ${builder.project_name || "the project"} together`,
    };
  }
  if (hasTraction) {
    return {
      type: "build",
      goal: `Test one growth hypothesis to validate what's working`,
    };
  }
  return {
    type: "validation",
    goal: `Share feedback on each other's ideas and find a common angle`,
  };
}

function getMomentumSignal(builder: BuilderProfile): string | null {
  if (builder.traction_signal) return builder.traction_signal;
  if (builder.project_name && builder.stage === "users") return `Building ${builder.project_name}`;
  if (builder.stage === "revenue") return "Has revenue";
  return null;
}

// === TOP OPPORTUNITY CARD ===

function TopOpportunityCard({
  builder,
  isSaved,
  isPending,
  isConnected,
  isConnecting,
  onProposeSprint,
  onConnect,
  onSave,
  onPass,
}: {
  builder: ScoredBuilder;
  isSaved: boolean;
  isPending: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onProposeSprint: () => void;
  onConnect: () => void;
  onSave: () => void;
  onPass: () => void;
}) {
  const displayName = builder.username || builder.name || "Builder";
  const initials = displayName.slice(0, 2).toUpperCase();
  const suggested = getSuggestedSprint(builder);

  return (
    <div className="d-top-opp">
      <span className="d-top-opp-label">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        Top Match
      </span>

      <div className="d-top-opp-header">
        <div className="d-top-opp-avatar">{initials}</div>
        <div className="d-top-opp-meta">
          <p className="d-top-opp-name">{displayName}</p>
          {builder.project_name && (
            <p className="d-top-opp-project">{builder.project_name}</p>
          )}
          {builder.one_liner && (
            <p className="d-top-opp-oneliner">{builder.one_liner}</p>
          )}
        </div>
      </div>

      {builder.matchReasons.length > 0 && (
        <div className="d-top-opp-reasons">
          {builder.matchReasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="d-top-opp-reason">
              <span className="d-top-opp-reason-dot" />
              {reason}
            </div>
          ))}
        </div>
      )}

      <div className="d-top-opp-sprint">
        <div className="d-top-opp-sprint-header">
          <span className="d-top-opp-sprint-label">Suggested sprint</span>
          <span className="d-top-opp-sprint-type">
            {SPRINT_TYPE_LABELS[suggested.type] ?? suggested.type}
          </span>
        </div>
        <p className="d-top-opp-sprint-goal">{suggested.goal}</p>
      </div>

      <div className="d-top-opp-actions">
        {isConnected ? (
          <Link href="/messages" className="d-top-opp-cta">Message</Link>
        ) : (
          <button onClick={onProposeSprint} className="d-top-opp-cta">
            Propose this sprint
          </button>
        )}
        <div className="flex items-center gap-2">
          {!isConnected && !isPending && (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="d-top-opp-secondary"
            >
              {isConnecting ? "..." : "Connect"}
            </button>
          )}
          {isPending && (
            <span className="d-top-opp-secondary text-slate-500 cursor-default">Sent</span>
          )}
          <button
            onClick={onSave}
            className={`d-top-opp-secondary ${isSaved ? "text-indigo-300 border-indigo-500/30" : ""}`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
          <button onClick={onPass} className="d-top-opp-secondary text-slate-500">
            Pass
          </button>
        </div>
      </div>
    </div>
  );
}

// === COMPACT MATCH CARD ===

function CompactMatchCard({
  builder,
  isPending,
  isConnected,
  isConnecting,
  onProposeSprint,
  onConnect,
}: {
  builder: ScoredBuilder;
  isPending: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onProposeSprint: () => void;
  onConnect: () => void;
}) {
  const displayName = builder.username || builder.name || "Builder";
  const initials = displayName.slice(0, 2).toUpperCase();
  const hint =
    builder.matchReasons[0] ??
    (builder.project_name ? `Working on ${builder.project_name}` : null) ??
    builder.one_liner ??
    "Potential collaborator";

  return (
    <div className="d-compact-card">
      <div className="d-compact-avatar">{initials}</div>
      <div className="d-compact-body">
        <p className="d-compact-name">{displayName}</p>
        <p className="d-compact-hint">{hint}</p>
      </div>
      <div className="d-compact-actions">
        {isConnected ? (
          <Link href="/messages" className="d-compact-connect-btn">Message</Link>
        ) : (
          <>
            <button onClick={onProposeSprint} className="d-compact-sprint-btn">
              Sprint
            </button>
            {isPending ? (
              <span className="d-compact-connect-btn text-slate-600 cursor-default">Sent</span>
            ) : (
              <button onClick={onConnect} disabled={isConnecting} className="d-compact-connect-btn">
                {isConnecting ? "..." : "Connect"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// === IDEA CARD ===

const IDEA_CATEGORY_CLASS: Record<string, string> = {
  build: "d-idea-category-build",
  validate: "d-idea-category-validate",
  feedback: "d-idea-category-feedback",
};

function IdeaCard({ post }: { post: RecentPost }) {
  const author = post.users?.[0]?.username || post.users?.[0]?.name || "Someone";
  const catClass = IDEA_CATEGORY_CLASS[post.category] ?? "d-idea-category-default";

  return (
    <div className="d-idea-card">
      <div className="d-idea-top">
        <span className={`d-idea-category ${catClass}`}>{post.category}</span>
        <span className="d-idea-age">{formatTimeAgo(post.created_at)}</span>
      </div>
      <p className="d-idea-title">{post.title}</p>
      <p className="d-idea-author">by {author}</p>
      <Link href={`/posts/${post.id}`} className="d-idea-sprint-btn block text-center">
        View &amp; Collaborate
      </Link>
    </div>
  );
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
            <p className="text-xs text-slate-600 text-center mt-1">
              Start small — a sprint before a cold message
            </p>
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
  const [sprintModalDefaultType, setSprintModalDefaultType] = useState<string | undefined>();
  const [sprintModalDefaultGoal, setSprintModalDefaultGoal] = useState<string | undefined>();
  const [sprintCounts, setSprintCounts] = useState<Map<string, number>>(new Map());

  // Search + filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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

  // Filtered "For You" matches (search + filter chips)
  const filteredMatches = useMemo(() => {
    let results = forYouMatches;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((b) =>
        [b.name, b.username, b.one_liner, b.project_name, b.traction_signal]
          .concat(b.categories, b.skills, b.looking_for)
          .some((v) => v?.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "sprint-ready") {
      results = results.filter(
        (b) => (sprintCounts.get(b.id) ?? 0) > 0 || Boolean(b.collaboration_intent)
      );
    } else if (activeFilter === "has-traction") {
      results = results.filter((b) => Boolean(b.traction_signal));
    } else if (activeFilter === "same-school") {
      results = results.filter(
        (b) =>
          userProfile?.school &&
          b.school?.toLowerCase() === userProfile.school?.toLowerCase()
      );
    } else if (activeFilter === "saved") {
      results = results.filter((b) => savedIds.has(b.id));
    }

    return results;
  }, [forYouMatches, searchQuery, activeFilter, sprintCounts, userProfile, savedIds]);

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

      // Ignore duplicate key errors (user clicked Connect twice)
      if (!error || error.code === "23505") {
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

  const openSprintModal = useCallback(
    (builder: BuilderProfile, defaultType?: string, defaultGoal?: string) => {
      setSprintModalBuilder(builder);
      setSprintModalDefaultType(defaultType);
      setSprintModalDefaultGoal(defaultGoal);
    },
    []
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
      <PageShell
        title="Find teammates for your next venture"
        rail={
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
      </PageShell>
    );
  }

  if (authChecked && !user) {
    return (
      <PageShell>
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
      </PageShell>
    );
  }

  // Right rail content
  const activeSprintCount = sprintCounts.get(user?.id ?? "") ?? 0;

  const rightRailContent = (
    <>
      {/* Your Next Moves */}
      <div className="d-next-move-widget">
        <p className="d-next-move-title">Your Next Moves</p>
        <div className="d-next-move-list">
          {!hasBuilderCard && (
            <Link href="/profile?tab=builder" className="d-next-move-item">
              <svg className="d-next-move-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="d-next-move-text">
                Complete your Builder Card
                <span className="d-next-move-sub">Get better matches + appear in others' results</span>
              </span>
            </Link>
          )}
          {filteredMatches.length > 0 && (
            <button
              onClick={() => { const s = getSuggestedSprint(filteredMatches[0]); openSprintModal(filteredMatches[0], s.type, s.goal); }}
              className="d-next-move-item w-full text-left"
            >
              <svg className="d-next-move-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="d-next-move-text">
                Propose a sprint to your top match
                <span className="d-next-move-sub">Start with a small, structured collaboration</span>
              </span>
            </button>
          )}
          <Link href="/sprints" className="d-next-move-item">
            <svg className="d-next-move-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="d-next-move-text">
              View your sprints
              {activeSprintCount > 0 && (
                <span className="d-next-move-sub">{activeSprintCount} sprint{activeSprintCount !== 1 ? "s" : ""} completed</span>
              )}
            </span>
          </Link>
          <Link href="/feed" className="d-next-move-item">
            <svg className="d-next-move-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="d-next-move-text">
              Post in the community feed
              <span className="d-next-move-sub">Share what you're building</span>
            </span>
          </Link>
        </div>
      </div>

      {/* Recent Momentum */}
      {recentPosts.length > 0 && (
        <div className="d-momentum-widget">
          <p className="d-momentum-title">Community Momentum</p>
          <div className="d-momentum-list">
            {recentPosts.slice(0, 4).map((post) => (
              <Link key={post.id} href={`/posts/${post.id}`} className="d-momentum-item hover:opacity-80 transition-opacity">
                <span className="d-momentum-dot" />
                <div className="d-momentum-body">
                  <p className="d-momentum-text">{post.title}</p>
                  <p className="d-momentum-time">
                    {post.users?.[0]?.username || post.users?.[0]?.name || "Someone"} · {formatTimeAgo(post.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
    </>
  );

  const currentBuilders = activeTab === "for-you" ? forYouMatches : paginatedBuilders;

  // Filter options for "For You" tab
  const filterOptions = [
    { key: "all", label: "All" },
    { key: "sprint-ready", label: "Sprint-ready" },
    { key: "has-traction", label: "Has traction" },
    ...(userProfile?.school ? [{ key: "same-school", label: "Same school" }] : []),
    ...(savedIds.size > 0 ? [{ key: "saved", label: "Saved" }] : []),
  ];

  const topMatch = filteredMatches[0] ?? null;
  const nextMatches = filteredMatches.slice(1, 5);
  const ideaPosts = recentPosts.slice(0, 4);

  return (
    <>
    <PageShell rail={rightRailContent}>
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

      {/* ── FOR YOU TAB ── */}
      {activeTab === "for-you" && (
        <>
          {/* Hero */}
          <div className="d-hero">
            <div className="d-hero-eyebrow">
              <span className="d-hero-badge">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zm4.22 1.22a1 1 0 00-1.414 0L12.95 5.05a1 1 0 001.414 1.414l.857-.857A1 1 0 0015.22 4.22zM17 9a1 1 0 100 2h1a1 1 0 100-2h-1zM6.05 12.95a1 1 0 00-1.414-1.414L3.78 12.39a1 1 0 001.414 1.414l.857-.857zM4 10a1 1 0 10-2 0 1 1 0 002 0zM7.05 4.22a1 1 0 00-1.414 1.414l.857.857a1 1 0 001.414-1.414L7.05 4.22z" />
                </svg>
                Sprint-first matching
              </span>
            </div>
            <h1 className="d-hero-headline">Find someone worth building with.</h1>
            <p className="d-hero-sub">
              Ranked by compatibility · Propose a sprint before a cold message
            </p>

            {/* Search */}
            <div className="d-search-row">
              <svg className="d-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="d-search-input"
                placeholder="Search by name, skill, project, or traction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter chips */}
            <div className="d-filter-row">
              {filterOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`d-filter-chip ${activeFilter === f.key ? "d-filter-chip-active" : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Incomplete builder card notice */}
          {!hasBuilderCard && (
            <div className="discover-notice mb-4">
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

          {/* Empty state */}
          {filteredMatches.length === 0 ? (
            <div className="discover-empty">
              <div className="discover-empty-icon">
                <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="discover-empty-title">
                {searchQuery ? "No results for that search" : "No matches yet"}
              </h2>
              <p className="discover-empty-text">
                {searchQuery
                  ? "Try different keywords or clear your search."
                  : !hasBuilderCard
                  ? "Complete your Builder Card to get matched with other builders."
                  : "Try a different filter or check back as more builders join."}
              </p>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="btn-secondary">
                  Clear search
                </button>
              )}
              {!hasBuilderCard && !searchQuery && (
                <Link href="/profile?tab=builder" className="btn-primary">
                  Complete Builder Card
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Top Opportunity */}
              {topMatch && (
                <TopOpportunityCard
                  builder={topMatch}
                  isSaved={savedIds.has(topMatch.id)}
                  isPending={pendingIds.has(topMatch.id)}
                  isConnected={connectedIds.has(topMatch.id)}
                  isConnecting={connectingId === topMatch.id}
                  onProposeSprint={() => {
                    const s = getSuggestedSprint(topMatch);
                    openSprintModal(topMatch, s.type, s.goal);
                  }}
                  onConnect={() => handleConnect(topMatch.id)}
                  onSave={() => handleSave(topMatch.id)}
                  onPass={() => handlePass(topMatch.id)}
                />
              )}

              {/* Next Best Matches */}
              {nextMatches.length > 0 && (
                <div className="d-compact-queue">
                  <div className="d-compact-queue-header">
                    <span className="d-compact-queue-label">Next Best Matches</span>
                    <span className="text-xs text-slate-500">{nextMatches.length} more</span>
                  </div>
                  <div className="d-compact-list">
                    {nextMatches.map((builder) => (
                      <CompactMatchCard
                        key={builder.id}
                        builder={builder}
                        isPending={pendingIds.has(builder.id)}
                        isConnected={connectedIds.has(builder.id)}
                        isConnecting={connectingId === builder.id}
                        onProposeSprint={() => {
                          const s = getSuggestedSprint(builder);
                          openSprintModal(builder, s.type, s.goal);
                        }}
                        onConnect={() => handleConnect(builder.id)}
                      />
                    ))}
                  </div>

                  {filteredMatches.length > 5 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 text-center mb-3">
                        + {filteredMatches.length - 5} more matches in your pool
                      </p>
                      <div className="discover-grid-v2">
                        {filteredMatches.slice(5).map((builder) => (
                          <BuilderCard
                            key={builder.id}
                            builder={builder}
                            isSaved={savedIds.has(builder.id)}
                            isPending={pendingIds.has(builder.id)}
                            isConnected={connectedIds.has(builder.id)}
                            onPass={() => handlePass(builder.id)}
                            onConnect={() => handleConnect(builder.id)}
                            onSave={() => handleSave(builder.id)}
                            onProposeSprint={() => {
                              const s = getSuggestedSprint(builder);
                              openSprintModal(builder, s.type, s.goal);
                            }}
                            isConnecting={connectingId === builder.id}
                            showMatchReasons
                            sprintCount={sprintCounts.get(builder.id) ?? 0}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sprint-ready Ideas */}
              {ideaPosts.length > 0 && (
                <div className="d-ideas-section">
                  <div className="d-ideas-header">
                    <span className="d-ideas-label">Sprint-ready Ideas from the Community</span>
                    <Link href="/feed" className="text-xs text-indigo-400 hover:text-indigo-300">
                      See all
                    </Link>
                  </div>
                  <div className="d-ideas-grid">
                    {ideaPosts.map((post) => (
                      <IdeaCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── ALL BUILDERS TAB ── */}
      {activeTab === "all-builders" && (
        <>
          {paginatedBuilders.length === 0 ? (
            <div className="discover-empty">
              <div className="discover-empty-icon">
                <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="discover-empty-title">No builders found</h2>
              <p className="discover-empty-text">
                Check back soon as more builders join the community.
              </p>
            </div>
          ) : (
            <>
              <div className="discover-grid-v2">
                {paginatedBuilders.map((builder) => {
                  const scored: ScoredBuilder = { ...builder, score: 0, matchReasons: [] };
                  return (
                    <BuilderCard
                      key={builder.id}
                      builder={scored}
                      isSaved={savedIds.has(builder.id)}
                      isPending={pendingIds.has(builder.id)}
                      isConnected={connectedIds.has(builder.id)}
                      onPass={() => handlePass(builder.id)}
                      onConnect={() => handleConnect(builder.id)}
                      onSave={() => handleSave(builder.id)}
                      onProposeSprint={() => openSprintModal(builder)}
                      isConnecting={connectingId === builder.id}
                      showMatchReasons={false}
                      sprintCount={sprintCounts.get(builder.id) ?? 0}
                    />
                  );
                })}
              </div>

              {hasMoreBuilders && (
                <div className="discover-load-more">
                  <button onClick={() => setPage((p) => p + 1)} className="btn-secondary">
                    Load More Builders
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageShell>

    {sprintModalBuilder && user && (
      <ProposeSprintModal
        builder={sprintModalBuilder}
        currentUserId={user.id}
        defaultSprintType={sprintModalDefaultType}
        defaultGoal={sprintModalDefaultGoal}
        onClose={() => {
          setSprintModalBuilder(null);
          setSprintModalDefaultType(undefined);
          setSprintModalDefaultGoal(undefined);
        }}
      />
    )}
    </>
  );
}
