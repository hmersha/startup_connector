"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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

type ScoredBuilder = BuilderProfile & {
  score: number;
  matchReasons: string[];
};

// === MATCHING ALGORITHM ===

const STAGE_ORDER = ["idea", "prototype", "users", "revenue"];

// Skills that complement what someone is looking for
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
  },
  connectedIds: Set<string>,
  pendingIds: Set<string>,
  dismissedIds: Set<string>,
  lessLikeThisIds: Set<string>
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Already connected or pending - exclude
  if (connectedIds.has(candidate.id) || pendingIds.has(candidate.id)) {
    return { score: -100, reasons: [] };
  }

  // Previously dismissed - heavy penalty
  if (dismissedIds.has(candidate.id)) {
    return { score: -50, reasons: [] };
  }

  // Less like this - moderate penalty but still show if high score
  if (lessLikeThisIds.has(candidate.id)) {
    score -= 20;
  }

  // Category overlap: +4 per match
  const categoryOverlap = candidate.categories.filter((c) =>
    currentUser.categories.includes(c)
  );
  if (categoryOverlap.length > 0) {
    score += categoryOverlap.length * 4;
    reasons.push(`Interested in ${categoryOverlap.slice(0, 2).join(", ")}`);
  }

  // Stage matching: +5 exact, +2 adjacent
  const stageDistance = getStageDistance(candidate.stage, currentUser.stage);
  if (stageDistance === 0) {
    score += 5;
    reasons.push(`Same stage: ${candidate.stage}`);
  } else if (stageDistance === 1) {
    score += 2;
    reasons.push(`Similar stage: ${candidate.stage}`);
  }

  // Skills complement looking_for: +4 per complementary skill
  let complementCount = 0;
  for (const lookingFor of currentUser.looking_for) {
    const complementarySkills = SKILL_COMPLEMENT_MAP[lookingFor] || [];
    const hasComplement = candidate.skills.some((s) =>
      complementarySkills.includes(s.toLowerCase())
    );
    if (hasComplement) {
      complementCount++;
    }
  }
  if (complementCount > 0) {
    score += complementCount * 4;
    reasons.push(`Has skills you're looking for`);
  }

  // Reverse: their looking_for matches my skills
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

  // Same school: +2
  if (
    currentUser.school &&
    candidate.school &&
    currentUser.school.toLowerCase() === candidate.school.toLowerCase()
  ) {
    score += 2;
    reasons.push(`Same school: ${candidate.school}`);
  }

  // Boost for active users
  if (candidate.last_active_at) {
    const lastActive = new Date(candidate.last_active_at);
    const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActive < 1) {
      score += 2;
      reasons.push("Recently active");
    } else if (daysSinceActive < 7) {
      score += 1;
    }
  }

  // Boost for having a one_liner (more complete profile)
  if (candidate.one_liner) {
    score += 1;
  }

  // If no specific reasons, add a generic one
  if (reasons.length === 0 && score > 0) {
    reasons.push("Potential collaborator");
  }

  return { score, reasons };
}

// === COMPONENTS ===

function BuilderCard({
  builder,
  onConnect,
  onDismiss,
  onLessLikeThis,
  onGenerateIntro,
  isConnecting,
  isGeneratingIntro,
}: {
  builder: ScoredBuilder;
  onConnect: () => void;
  onDismiss: () => void;
  onLessLikeThis: () => void;
  onGenerateIntro: () => void;
  isConnecting: boolean;
  isGeneratingIntro: boolean;
}) {
  const displayName = builder.username || builder.name || "Builder";
  const initials = displayName.slice(0, 2).toUpperCase();
  const showOneLiner = builder.visibility !== "private";

  return (
    <div className="discover-card">
      <div className="discover-card-header">
        <div className="discover-avatar">
          <span>{initials}</span>
        </div>
        <div className="discover-info">
          <h3 className="discover-name">{displayName}</h3>
          {builder.school && (
            <p className="discover-school">{builder.school}</p>
          )}
        </div>
        <div className="discover-rep">
          <span className="discover-rep-value">{builder.reputation}</span>
          <span className="discover-rep-label">rep</span>
        </div>
      </div>

      {showOneLiner && builder.one_liner ? (
        <p className="discover-one-liner">{builder.one_liner}</p>
      ) : builder.visibility === "private" ? (
        <p className="discover-private-notice">Connect to see full profile</p>
      ) : null}

      {/* Tags */}
      <div className="discover-tags">
        {builder.stage && (
          <span className="discover-tag discover-tag-stage">{builder.stage}</span>
        )}
        {builder.categories.slice(0, 3).map((cat) => (
          <span key={cat} className="discover-tag discover-tag-category">
            {cat}
          </span>
        ))}
      </div>

      {/* Match reasons */}
      {builder.matchReasons.length > 0 && (
        <div className="discover-reasons">
          <span className="discover-reasons-label">Why matched</span>
          <ul className="discover-reasons-list">
            {builder.matchReasons.slice(0, 3).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="discover-actions">
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="discover-btn discover-btn-connect"
        >
          {isConnecting ? "..." : "Connect"}
        </button>
        <button
          onClick={onGenerateIntro}
          disabled={isGeneratingIntro}
          className="discover-btn discover-btn-ai"
          title="AI-generate an intro message"
        >
          {isGeneratingIntro ? (
            <span className="ai-spinner" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
          Intro
        </button>
        <button onClick={onDismiss} className="discover-btn discover-btn-dismiss">
          Dismiss
        </button>
        <button
          onClick={onLessLikeThis}
          className="discover-btn discover-btn-less"
          title="Show fewer like this"
        >
          Less like this
        </button>
      </div>
    </div>
  );
}

// === INTRO MODAL ===

function IntroModal({
  intro,
  targetName,
  onClose,
  error,
}: {
  intro: string;
  targetName: string;
  onClose: () => void;
  error: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(intro);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = intro;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Intro for {targetName}
          </div>
          <button onClick={onClose} className="ai-modal-close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="ai-modal-error">{error}</div>
        ) : (
          <>
            <div className="ai-modal-body">
              <p className="ai-modal-intro">{intro}</p>
            </div>
            <div className="ai-modal-footer">
              <button onClick={handleCopy} className="btn-primary text-sm px-4 py-2">
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
              <span className="ai-modal-hint">Paste this when you message them</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// === MAIN PAGE ===

export default function DiscoverPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<BuilderProfile | null>(null);
  const [candidates, setCandidates] = useState<BuilderProfile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [feedbacks, setFeedbacks] = useState<MatchFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [introModal, setIntroModal] = useState<{
    targetName: string;
    intro: string;
    error: string | null;
  } | null>(null);
  const [generatingIntroFor, setGeneratingIntroFor] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setRemovedIds(new Set()); // Reset removed IDs on refresh
    } else {
      setLoading(true);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      setAuthChecked(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const currentUser = authData.user;
    setUser(currentUser);
    setAuthChecked(true);

    // Fetch in parallel
    const [profileResult, candidatesResult, connectionsResult, feedbackResult] =
      await Promise.all([
        // Current user's profile
        supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id)
          .single(),
        // Candidate users (excluding self, limit 80)
        supabase
          .from("users")
          .select("*")
          .neq("id", currentUser.id)
          .in("visibility", ["public", "match_only"])
          .limit(80),
        // Connections
        supabase
          .from("connections")
          .select("requester_id, addressee_id, status")
          .or(
            `requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`
          ),
        // Match feedback
        supabase
          .from("match_feedback")
          .select("target_user_id, action")
          .eq("user_id", currentUser.id),
      ]);

    if (profileResult.data) {
      setUserProfile(profileResult.data as BuilderProfile);
    }

    if (candidatesResult.data) {
      setCandidates(candidatesResult.data as BuilderProfile[]);
    }

    if (connectionsResult.data) {
      setConnections(connectionsResult.data);
    }

    if (feedbackResult.data) {
      setFeedbacks(feedbackResult.data);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute scored and sorted matches
  const topMatches = useMemo(() => {
    if (!userProfile || candidates.length === 0) return [];

    // Build sets for quick lookup
    const connectedIds = new Set<string>();
    const pendingIds = new Set<string>();
    connections.forEach((c) => {
      const otherId =
        c.requester_id === userProfile.id ? c.addressee_id : c.requester_id;
      if (c.status === "accepted") {
        connectedIds.add(otherId);
      } else if (c.status === "pending") {
        pendingIds.add(otherId);
      }
    });

    const dismissedIds = new Set<string>();
    const lessLikeThisIds = new Set<string>();
    feedbacks.forEach((f) => {
      if (f.action === "dismiss") dismissedIds.add(f.target_user_id);
      if (f.action === "less_like_this") lessLikeThisIds.add(f.target_user_id);
    });

    // Score each candidate
    const scored: ScoredBuilder[] = candidates
      .filter((c) => !removedIds.has(c.id))
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
          },
          connectedIds,
          pendingIds,
          dismissedIds,
          lessLikeThisIds
        );
        return { ...candidate, score, matchReasons: reasons };
      })
      .filter((c) => c.score > -50) // Exclude heavily penalized
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return scored;
  }, [userProfile, candidates, connections, feedbacks, removedIds]);

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
        // Update local state
        setConnections((prev) => [
          ...prev,
          { requester_id: user.id, addressee_id: targetId, status: "pending" },
        ]);
        setRemovedIds((prev) => new Set([...prev, targetId]));
      }

      setConnectingId(null);
    },
    [user]
  );

  const handleDismiss = useCallback(
    async (targetId: string) => {
      if (!user) return;

      // Insert feedback
      await supabase.from("match_feedback").upsert(
        { user_id: user.id, target_user_id: targetId, action: "dismiss" },
        { onConflict: "user_id,target_user_id" }
      );

      // Remove from list immediately
      setRemovedIds((prev) => new Set([...prev, targetId]));
      setFeedbacks((prev) => [
        ...prev.filter((f) => f.target_user_id !== targetId),
        { target_user_id: targetId, action: "dismiss" },
      ]);
    },
    [user]
  );

  const handleLessLikeThis = useCallback(
    async (targetId: string) => {
      if (!user) return;

      // Insert feedback
      await supabase.from("match_feedback").upsert(
        { user_id: user.id, target_user_id: targetId, action: "less_like_this" },
        { onConflict: "user_id,target_user_id" }
      );

      // Remove from list immediately
      setRemovedIds((prev) => new Set([...prev, targetId]));
      setFeedbacks((prev) => [
        ...prev.filter((f) => f.target_user_id !== targetId),
        { target_user_id: targetId, action: "less_like_this" },
      ]);
    },
    [user]
  );

  // Generate AI intro
  const handleGenerateIntro = useCallback(
    async (builder: ScoredBuilder) => {
      if (!user || !userProfile) return;

      const targetName = builder.username || builder.name || "Builder";
      setGeneratingIntroFor(builder.id);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          setIntroModal({ targetName, intro: "", error: "Not authenticated. Please log in again." });
          setGeneratingIntroFor(null);
          return;
        }

        const response = await fetch("/api/ai/generate-intro", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentUser: {
              username: userProfile.username,
              one_liner: userProfile.one_liner,
              categories: userProfile.categories,
              stage: userProfile.stage,
              looking_for: userProfile.looking_for,
              skills: userProfile.skills,
              school: userProfile.school,
            },
            targetUser: {
              username: builder.username,
              one_liner: builder.one_liner,
              categories: builder.categories,
              stage: builder.stage,
              looking_for: builder.looking_for,
              skills: builder.skills,
              school: builder.school,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setIntroModal({ targetName, intro: "", error: data.error || "Failed to generate intro." });
        } else {
          setIntroModal({ targetName, intro: data.intro, error: null });
        }
      } catch {
        setIntroModal({ targetName, intro: "", error: "Network error. Please try again." });
      }

      setGeneratingIntroFor(null);
    },
    [user, userProfile]
  );

  // === RENDER ===

  if (loading) {
    return (
      <div className="discover-container">
        <div className="discover-header">
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="discover-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (authChecked && !user) {
    return (
      <div className="discover-container">
        <div className="discover-cta">
          <div className="discover-cta-icon">
            <svg
              className="w-12 h-12 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="discover-cta-title">Find your co-founders</h1>
          <p className="discover-cta-text">
            Log in to discover builders who match your interests and goals.
          </p>
          <Link href="/login" className="btn-primary">
            Log in to discover
          </Link>
        </div>
      </div>
    );
  }

  // Check if user has set up their builder card
  const hasBuilderCard =
    userProfile &&
    ((userProfile.categories && userProfile.categories.length > 0) ||
      userProfile.stage ||
      (userProfile.looking_for && userProfile.looking_for.length > 0));

  return (
    <div className="discover-container">
      <header className="discover-header">
        <div>
          <h1 className="discover-title">Discover Builders</h1>
          <p className="discover-subtitle">
            People who match your interests and goals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="discover-refresh-btn"
            title="Refresh matches"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {!hasBuilderCard && (
            <Link href="/profile?tab=builder" className="discover-setup-btn">
              Set up your Builder Card
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </header>

      {!hasBuilderCard && (
        <div className="discover-notice">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Complete your Builder Card in{" "}
            <Link href="/profile?tab=builder" className="text-indigo-400 hover:text-indigo-300">
              Profile
            </Link>{" "}
            to get better matches.
          </span>
        </div>
      )}

      {topMatches.length === 0 ? (
        <div className="discover-empty">
          <div className="discover-empty-icon">
            <svg
              className="w-12 h-12 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h2 className="discover-empty-title">No matches found</h2>
          <p className="discover-empty-text">
            {!hasBuilderCard
              ? "Complete your Builder Card to get matched with other builders."
              : candidates.length === 0
              ? "No other builders with public profiles yet. Check back soon!"
              : "You've seen all available matches. Check back later as more people join."}
          </p>
          <div className="discover-empty-actions">
            {!hasBuilderCard ? (
              <Link href="/profile?tab=builder" className="btn-primary">
                Complete Builder Card
              </Link>
            ) : (
              <>
                <button
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                  className="btn-secondary"
                >
                  {refreshing ? "Refreshing..." : "Refresh Matches"}
                </button>
                <Link href="/profile?tab=builder" className="btn-secondary">
                  Update Builder Card
                </Link>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="discover-grid">
          {topMatches.map((builder) => (
            <BuilderCard
              key={builder.id}
              builder={builder}
              onConnect={() => handleConnect(builder.id)}
              onDismiss={() => handleDismiss(builder.id)}
              onLessLikeThis={() => handleLessLikeThis(builder.id)}
              onGenerateIntro={() => handleGenerateIntro(builder)}
              isConnecting={connectingId === builder.id}
              isGeneratingIntro={generatingIntroFor === builder.id}
            />
          ))}
        </div>
      )}

      {topMatches.length > 0 && topMatches.length < 5 && (
        <p className="discover-footer-note">
          Showing {topMatches.length} matches. More will appear as the community grows.
        </p>
      )}

      {/* AI Intro Modal */}
      {introModal && (
        <IntroModal
          intro={introModal.intro}
          targetName={introModal.targetName}
          error={introModal.error}
          onClose={() => setIntroModal(null)}
        />
      )}
    </div>
  );
}
