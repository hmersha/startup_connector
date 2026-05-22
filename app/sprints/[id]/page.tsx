"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import PageShell from "@/components/PageShell";
import AddResourceModal from "@/components/AddResourceModal";
import { getPlaybook } from "@/lib/sprintPlaybooks";
import { getArtifactTemplate } from "@/lib/sprintArtifacts";
import {
  type SprintResource,
  STEP_LABELS,
  SUGGESTIONS_BY_SPRINT_TYPE,
  getResourceTypeLabel,
  getResourceIconPath,
  getResourceIconColor,
} from "@/lib/resourceTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type SprintUser = {
  id: string;
  name: string | null;
  username: string | null;
  one_liner: string | null;
  skills: string[];
};

type Sprint = {
  id: string;
  proposer_id: string;
  recipient_id: string;
  title: string;
  sprint_type: string;
  goal: string;
  expected_commitment: string | null;
  duration_days: number;
  deliverables: string[] | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  proposer: SprintUser | null;
  recipient: SprintUser | null;
};

type SprintUpdate = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  step_key: string | null;
  update_type: string | null;
};

type SprintArtifact = {
  id: string;
  sprint_id: string;
  artifact_type: string;
  content: Record<string, string>;
  updated_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPRINT_TYPE_LABELS: Record<string, string> = {
  validation:    "Feedback Sprint",
  mvp_scope:     "MVP Scope Sprint",
  build:         "Build / Validation Sprint",
  gtm:           "GTM Sprint",
  cofounder_fit: "Chemistry Sprint",
};

const OUTCOME_OPTIONS = [
  "Continue exploring",
  "Start cofounder conversation",
  "Stay connected",
  "Not a fit",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(days: number) {
  if (days <= 3) return "3 days";
  if (days <= 7) return "1 week";
  return "2 weeks";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── ResourceCard ─────────────────────────────────────────────────────────────

function ResourceCard({
  resource,
  currentUserId,
  isCompleted,
  copiedId,
  deletingId,
  onCopy,
  onEdit,
  onDelete,
}: {
  resource: SprintResource;
  currentUserId: string | null;
  isCompleted: boolean;
  copiedId: string | null;
  deletingId: string | null;
  onCopy: (url: string, id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconPath = getResourceIconPath(resource.resource_type);
  const iconColor = getResourceIconColor(resource.resource_type);
  const isDeleting = deletingId === resource.id;
  const isCopied = copiedId === resource.id;
  const canModify = resource.added_by === currentUserId && !isCompleted;

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:border-slate-600/50 transition-colors">
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconColor.bg}`}>
        <svg className={`w-4 h-4 ${iconColor.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200 truncate">{resource.title}</span>
          {resource.is_primary && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex-shrink-0">
              Primary
            </span>
          )}
          <span className="text-xs text-slate-500 flex-shrink-0">
            {getResourceTypeLabel(resource.resource_type)}
          </span>
          {resource.step_key && STEP_LABELS[resource.step_key] && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700/40 flex-shrink-0">
              {STEP_LABELS[resource.step_key]}
            </span>
          )}
        </div>
        {resource.description && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{resource.description}</p>
        )}
        <p className="text-xs text-slate-600 mt-0.5 truncate">{resource.url}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Open
        </a>

        {/* Copy link */}
        <button
          onClick={() => onCopy(resource.url, resource.id)}
          className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-700/40"
          title="Copy link"
        >
          {isCopied ? (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {canModify && (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-700/40"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
              title="Delete"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SprintRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sprintId = params.id as string;

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Complete flow
  const [showOutcome, setShowOutcome] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  // Connect flow
  const [isConnected, setIsConnected] = useState(false);
  const [connectionPending, setConnectionPending] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Sprint updates
  const [updates, setUpdates] = useState<SprintUpdate[]>([]);
  const [newUpdate, setNewUpdate] = useState("");
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Artifact
  const [artifact, setArtifact] = useState<SprintArtifact | null>(null);
  const [artifactDraft, setArtifactDraft] = useState<Record<string, string>>({});
  const [savingArtifact, setSavingArtifact] = useState(false);
  const [artifactSaved, setArtifactSaved] = useState(false);
  const [artifactError, setArtifactError] = useState("");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resources
  const [resources, setResources] = useState<SprintResource[]>([]);
  const [showAddResource, setShowAddResource] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState<string | undefined>(undefined);
  const [editingResource, setEditingResource] = useState<SprintResource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id ?? null;
      setCurrentUserId(uid);

      if (!uid) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("sprints")
        .select(`
          *,
          proposer:users!proposer_id(id, name, username, one_liner, skills),
          recipient:users!recipient_id(id, name, username, one_liner, skills)
        `)
        .eq("id", sprintId)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const s = data as unknown as Sprint;
      if (s.proposer_id !== uid && s.recipient_id !== uid) {
        setNotFound(true); setLoading(false); return;
      }

      setSprint(s);

      // Connection status
      const otherId = s.proposer_id === uid ? s.recipient_id : s.proposer_id;
      const [connResult, updatesResult, artifactResult, resourcesResult] = await Promise.all([
        supabase
          .from("connections")
          .select("status")
          .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`)
          .maybeSingle(),
        supabase
          .from("sprint_updates")
          .select("*")
          .eq("sprint_id", sprintId)
          .order("created_at", { ascending: true }),
        supabase
          .from("sprint_artifacts")
          .select("*")
          .eq("sprint_id", sprintId)
          .maybeSingle(),
        supabase
          .from("sprint_resources")
          .select("*")
          .eq("sprint_id", sprintId)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);

      if (connResult.data?.status === "accepted") setIsConnected(true);
      if (connResult.data?.status === "pending") setConnectionPending(true);
      if (updatesResult.data) setUpdates(updatesResult.data as SprintUpdate[]);
      if (artifactResult.data) {
        const a = artifactResult.data as SprintArtifact;
        setArtifact(a);
        setArtifactDraft(a.content ?? {});
      }
      if (resourcesResult.data) setResources(resourcesResult.data as SprintResource[]);

      setLoading(false);
    }

    load();

    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [sprintId]);

  // Realtime: sprint updates from the other participant
  useEffect(() => {
    if (!sprintId) return;
    const channel = supabase
      .channel(`sprint-updates:${sprintId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sprint_updates",
        filter: `sprint_id=eq.${sprintId}`,
      }, (payload) => {
        const incoming = payload.new as SprintUpdate;
        setUpdates((prev) => {
          if (prev.some((u) => u.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sprintId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAccept() {
    if (!sprint) return;
    await supabase.from("sprints")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", sprint.id);
    setSprint((s) => s ? { ...s, status: "accepted" } : s);
  }

  async function handleDecline() {
    if (!sprint) return;
    await supabase.from("sprints").update({ status: "declined" }).eq("id", sprint.id);
    router.push("/sprints");
  }

  async function handleMarkComplete() {
    if (!sprint || !selectedOutcome) return;
    setSaving(true);
    await supabase.from("sprints").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      outcome: selectedOutcome,
    }).eq("id", sprint.id);
    setSprint((s) => s ? { ...s, status: "completed", outcome: selectedOutcome } : s);
    setShowOutcome(false);
    setSaving(false);
  }

  async function handleConnect() {
    if (!sprint || !currentUserId) return;
    setConnecting(true);
    const otherId = sprint.proposer_id === currentUserId ? sprint.recipient_id : sprint.proposer_id;
    const { error } = await supabase.from("connections").insert({
      requester_id: currentUserId,
      addressee_id: otherId,
      status: "pending",
    });
    if (!error) setConnectionPending(true);
    setConnecting(false);
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    const body = newUpdate.trim();
    if (!currentUserId || !sprint || !body) return;
    setPostingUpdate(true);
    setNewUpdate("");

    const { data: inserted, error } = await supabase
      .from("sprint_updates")
      .insert({ sprint_id: sprint.id, author_id: currentUserId, body, step_key: selectedStep })
      .select("*")
      .single();

    if (!error && inserted) {
      setUpdates((prev) => {
        if (prev.some((u) => u.id === (inserted as SprintUpdate).id)) return prev;
        return [...prev, inserted as SprintUpdate];
      });
    } else if (error) {
      setNewUpdate(body);
    }
    setPostingUpdate(false);
  }

  async function handleSaveArtifact() {
    if (!sprint || !currentUserId) return;
    setSavingArtifact(true);
    setArtifactError("");

    let saveError: string | null = null;
    let saved: SprintArtifact | null = null;

    if (artifact) {
      const { data, error } = await supabase
        .from("sprint_artifacts")
        .update({ content: artifactDraft, updated_at: new Date().toISOString() })
        .eq("id", artifact.id)
        .select("*")
        .single();
      if (error) saveError = error.message;
      else if (data) saved = data as SprintArtifact;
    } else {
      const { data, error } = await supabase
        .from("sprint_artifacts")
        .insert({ sprint_id: sprint.id, artifact_type: sprint.sprint_type, content: artifactDraft })
        .select("*")
        .single();
      if (error) saveError = error.message;
      else if (data) saved = data as SprintArtifact;
    }

    if (saveError) {
      setArtifactError("Failed to save. Please try again.");
    } else if (saved) {
      setArtifact(saved);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setArtifactSaved(true);
      savedTimerRef.current = setTimeout(() => setArtifactSaved(false), 3000);
    }
    setSavingArtifact(false);
  }

  async function handleDeleteResource(resourceId: string) {
    setDeletingId(resourceId);
    const { error } = await supabase.from("sprint_resources").delete().eq("id", resourceId);
    if (!error) setResources((prev) => prev.filter((r) => r.id !== resourceId));
    setDeletingId(null);
  }

  async function handleCopyLink(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      setCopiedId(id);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard may be unavailable */ }
  }

  function handleResourceSaved(resource: SprintResource) {
    if (editingResource) {
      setResources((prev) => prev.map((r) => r.id === resource.id ? resource : r));
    } else {
      setResources((prev) => [...prev, resource]);
    }
    setShowAddResource(false);
    setEditingResource(null);
    setAddDefaultType(undefined);
  }

  function openAddResource(defaultType?: string) {
    setAddDefaultType(defaultType);
    setEditingResource(null);
    setShowAddResource(true);
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell title="Sprint Room">
        <div className="space-y-4 max-w-2xl">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (notFound || !sprint) {
    return (
      <PageShell title="Sprint Room">
        <div className="card p-8 text-center max-w-md">
          <p className="text-slate-400 mb-4">Sprint not found or you don&apos;t have access.</p>
          <Link href="/sprints" className="btn-secondary inline-block">Back to Sprints</Link>
        </div>
      </PageShell>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isProposer = sprint.proposer_id === currentUserId;
  const isRecipient = sprint.recipient_id === currentUserId;
  const isParticipant = isProposer || isRecipient;
  const isActive = sprint.status === "accepted" || sprint.status === "active";
  const isProposed = sprint.status === "proposed";
  const isCompleted = sprint.status === "completed";

  const otherParticipant = isProposer ? sprint.recipient : sprint.proposer;
  const otherName = otherParticipant?.username || otherParticipant?.name || "Builder";

  const playbook = getPlaybook(sprint.sprint_type);
  const template = getArtifactTemplate(sprint.sprint_type);
  const suggestions = SUGGESTIONS_BY_SPRINT_TYPE[sprint.sprint_type] ?? [];

  const proposerFirstMove = sprint.deliverables?.[0]?.replace(/^First move:\s*/i, "") ?? null;
  const hasArtifactContent = artifact && Object.values(artifact.content).some((v) => v);

  const statusLabel: Record<string, string> = {
    proposed: "Proposed", accepted: "Active", active: "Active",
    completed: "Completed", declined: "Declined", cancelled: "Cancelled",
  };

  function getAuthorName(authorId: string): string {
    if (authorId === sprint?.proposer_id) {
      return sprint?.proposer?.username || sprint?.proposer?.name || "Builder";
    }
    return sprint?.recipient?.username || sprint?.recipient?.name || "Builder";
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <PageShell title={sprint.title}>
      <div className="max-w-2xl space-y-6">

        {/* ── 1. Header ──────────────────────────────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`sprint-status-badge sprint-status-${sprint.status === "accepted" ? "active" : sprint.status}`}>
                  {statusLabel[sprint.status] ?? sprint.status}
                </span>
                <span className="sprint-type-label">
                  {SPRINT_TYPE_LABELS[sprint.sprint_type] ?? sprint.sprint_type}
                </span>
              </div>
              <h1 className="text-lg font-semibold text-slate-100">{sprint.title}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {formatDuration(sprint.duration_days)}
                {sprint.expected_commitment && ` · ${sprint.expected_commitment}`}
              </p>
              {(isProposed || isActive) && (
                <p className="text-xs text-slate-600 mt-2">
                  A sprint is a short, low-pressure way to collaborate. Do one useful thing together, then decide whether to connect.
                </p>
              )}
            </div>
            <Link href="/sprints" className="text-sm text-slate-500 hover:text-slate-300 flex-shrink-0">
              ← Sprints
            </Link>
          </div>
        </div>

        {/* ── 2. Mission / First Move / End Goal ─────────────────────────── */}
        {playbook ? (
          <div className="card p-6 border border-indigo-500/10 bg-indigo-500/[0.03]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Mission</p>
                <p className="text-slate-200 text-sm leading-relaxed">{playbook.mission}</p>
                <div className="mt-3 pt-3 border-t border-slate-700/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">First Move</p>
                    <p className="text-slate-400 text-sm">{playbook.firstMove}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">End Goal</p>
                    <p className="text-slate-400 text-sm">{sprint.goal}</p>
                  </div>
                </div>
                {proposerFirstMove && (
                  <div className="mt-3 pt-2 border-t border-slate-700/40">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Planned First Step</p>
                    <p className="text-slate-400 text-sm">{proposerFirstMove}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-6">
            <h2 className="sprint-room-section-title">Sprint Goal</h2>
            <p className="text-slate-300 text-sm leading-relaxed mt-2">{sprint.goal}</p>
            {proposerFirstMove && (
              <div className="mt-3 pt-3 border-t border-slate-700/40">
                <p className="text-xs font-medium text-slate-500 mb-1">Planned First Step</p>
                <p className="text-slate-400 text-sm">{proposerFirstMove}</p>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Sprint Path / Playbook Steps ────────────────────────────── */}
        {playbook && (isActive || isCompleted) && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="sprint-room-section-title">Sprint Path</h2>
              <div className="flex items-center gap-1.5">
                {playbook.steps.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      updates.some((u) => u.step_key === step.key)
                        ? "border-slate-600 bg-slate-700/50 text-slate-300"
                        : "border-slate-700/50 text-slate-500"
                    }`}>
                      {step.label}
                    </span>
                    {i < playbook.steps.length - 1 && (
                      <span className="text-slate-700 text-xs">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              {playbook.steps.map((step) => (
                <div key={step.key}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {step.label}
                  </p>
                  <ul className="space-y-1.5">
                    {step.prompts.map((prompt) => (
                      <li key={prompt} className="flex items-start gap-2 text-sm text-slate-500">
                        <span className="text-slate-700 mt-0.5 flex-shrink-0 select-none">·</span>
                        {prompt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Shared Sprint Artifact ───────────────────────────────────── */}
        {template && (isActive || isCompleted) && (
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h2 className="sprint-room-section-title">{template.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCompleted
                    ? "Artifact from this sprint — read only."
                    : "Fill this in together. Both participants can edit and save."}
                </p>
              </div>
              {!isCompleted && isParticipant && (
                <button
                  onClick={handleSaveArtifact}
                  disabled={savingArtifact}
                  className={`btn-primary text-sm px-4 py-1.5 flex-shrink-0 transition-all ${
                    artifactSaved ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                >
                  {savingArtifact ? "Saving…" : artifactSaved ? "Saved ✓" : "Save Artifact"}
                </button>
              )}
            </div>
            {artifact?.updated_at && (
              <p className="text-xs text-slate-600 mb-4">
                Last saved {formatTimeAgo(artifact.updated_at)}
              </p>
            )}
            {artifactError && (
              <p className="text-sm text-red-400 mb-4 bg-red-500/10 px-3 py-2 rounded-lg">{artifactError}</p>
            )}
            <div className="space-y-5">
              {template.fields.map((field) => (
                <div key={field.key}>
                  <label className="label">{field.label}</label>
                  {isCompleted ? (
                    <div className="mt-1 text-sm text-slate-300 bg-slate-800/40 rounded-lg px-3 py-2.5 min-h-[2.5rem] leading-relaxed whitespace-pre-wrap">
                      {artifactDraft[field.key] || (
                        <span className="text-slate-600 italic">Not filled in</span>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={artifactDraft[field.key] ?? ""}
                      onChange={(e) =>
                        setArtifactDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      rows={field.rows}
                      placeholder={field.placeholder}
                      className="input-field resize-none mt-1"
                      disabled={!isParticipant}
                    />
                  )}
                </div>
              ))}
            </div>
            {!isCompleted && isParticipant && (
              <div className="flex justify-end mt-5 pt-4 border-t border-slate-700/40">
                <button
                  onClick={handleSaveArtifact}
                  disabled={savingArtifact}
                  className={`btn-primary text-sm px-5 transition-all ${
                    artifactSaved ? "bg-emerald-600 hover:bg-emerald-600" : ""
                  }`}
                >
                  {savingArtifact ? "Saving…" : artifactSaved ? "Saved ✓" : "Save Artifact"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 5. Workspace Dock ──────────────────────────────────────────── */}
        {(isActive || isCompleted) && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="sprint-room-section-title">Workspace Dock</h2>
              {isActive && isParticipant && (
                <button
                  onClick={() => openAddResource()}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  + Add
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Keep the tools for this sprint in one place. Add the repo, doc, prototype, demo, or notes you&apos;re using to complete the sprint.
            </p>

            {/* Suggestions when dock is empty */}
            {resources.length === 0 && isActive && isParticipant && suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {suggestions.map((s) => (
                  <button
                    key={`${s.type}-${s.label}`}
                    onClick={() => openAddResource(s.type)}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-700/50 text-slate-400 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
                  >
                    + {s.label}
                  </button>
                ))}
              </div>
            )}

            {resources.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                {isActive ? "No resources added yet." : "No resources were added during this sprint."}
              </p>
            ) : (
              <div className="space-y-3">
                {resources.map((r) => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    currentUserId={currentUserId}
                    isCompleted={isCompleted}
                    copiedId={copiedId}
                    deletingId={deletingId}
                    onCopy={handleCopyLink}
                    onEdit={() => { setEditingResource(r); setShowAddResource(true); }}
                    onDelete={() => handleDeleteResource(r.id)}
                  />
                ))}
                {isActive && isParticipant && (
                  <button
                    onClick={() => openAddResource()}
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors mt-1"
                  >
                    + Add another resource
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 6. Sprint Updates ──────────────────────────────────────────── */}
        {(isActive || isCompleted) && (
          <div className="card p-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="sprint-room-section-title">Sprint Updates</h2>
              {updates.length > 0 && (
                <span className="text-xs text-slate-600">
                  {updates.length} update{updates.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">Quick notes, decisions, and progress from both sides.</p>

            {updates.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No updates yet.</p>
            ) : (
              <div className="space-y-4 mb-4">
                {updates.map((u) => (
                  <div key={u.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-indigo-400">
                        {getAuthorName(u.author_id).slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200">{getAuthorName(u.author_id)}</span>
                        {u.step_key && STEP_LABELS[u.step_key] && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-700/40">
                            {STEP_LABELS[u.step_key]}
                          </span>
                        )}
                        <span className="text-xs text-slate-600">{formatTimeAgo(u.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{u.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isActive && isParticipant && (
              <form onSubmit={handlePostUpdate} className="space-y-2 pt-4 border-t border-slate-700/40">
                <div className="flex gap-1.5 flex-wrap">
                  {([null, "align", "work", "decide"] as const).map((key) => (
                    <button
                      type="button"
                      key={key ?? "general"}
                      onClick={() => setSelectedStep(key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedStep === key
                          ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700/50 text-slate-500 hover:border-slate-600/70 hover:text-slate-400"
                      }`}
                    >
                      {key ? STEP_LABELS[key] : "General"}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    placeholder="Share a quick update, note, or decision…"
                    className="input-field flex-1 text-sm"
                    disabled={postingUpdate}
                  />
                  <button
                    type="submit"
                    disabled={postingUpdate || !newUpdate.trim()}
                    className="btn-primary text-sm px-4"
                  >
                    {postingUpdate ? "…" : "Post"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── 7. Finish Decision ─────────────────────────────────────────── */}

        {/* Outcome (completed) */}
        {isCompleted && sprint.outcome && (
          <div className="card p-6 border-emerald-500/20">
            <h2 className="sprint-room-section-title text-emerald-400">Sprint Completed</h2>
            <p className="text-slate-300 text-sm mt-2">{sprint.outcome}</p>
            <div className="mt-3 pt-3 border-t border-slate-700/40 flex flex-wrap gap-4 text-xs text-slate-500">
              {hasArtifactContent && (
                <span>{SPRINT_TYPE_LABELS[sprint.sprint_type] ?? "Sprint"} artifact saved</span>
              )}
              {resources.length > 0 && (
                <span>{resources.length} resource{resources.length !== 1 ? "s" : ""} used</span>
              )}
            </div>
            {resources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Resources used</p>
                <div className="space-y-1.5">
                  {resources.map((r) => (
                    <a
                      key={r.id}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <span className="truncate">{r.title}</span>
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Connect CTA */}
        {isCompleted && sprint.outcome !== null && sprint.outcome !== "Not a fit" && isParticipant && (
          <div className="card p-6">
            {isConnected ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-emerald-400">Connected with {otherName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">You can now message each other directly.</p>
                </div>
                <Link href="/network" className="btn-secondary text-sm py-1.5 px-3 flex-shrink-0">
                  Message
                </Link>
              </div>
            ) : connectionPending ? (
              <div>
                <p className="text-sm font-medium text-slate-200">Connection request sent</p>
                <p className="text-xs text-slate-400 mt-1">
                  If {otherName} accepts, messaging will unlock for both of you.
                </p>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">Want to keep building together?</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Send {otherName} a connection request. They&apos;ll decide whether to accept — no pressure.
                  </p>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="btn-primary flex-shrink-0"
                >
                  {connecting ? "Sending…" : "Request to connect"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="card p-6">
          <h2 className="sprint-room-section-title">Participants</h2>
          <div className="grid grid-cols-2 gap-4 mt-3">
            {[sprint.proposer, sprint.recipient].map((p, i) => {
              if (!p) return null;
              const name = p.username || p.name || "Builder";
              const isMe = p.id === currentUserId;
              return (
                <div key={i} className="sprint-participant-card">
                  <div className="sprint-participant-avatar">{name.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {name} {isMe && <span className="text-slate-500">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{i === 0 ? "Proposer" : "Recipient"}</p>
                    {p.one_liner && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.one_liner}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mark Complete actions */}
        {isParticipant && (
          <div className="flex flex-wrap gap-3">
            {isProposed && isRecipient && (
              <>
                <button onClick={handleAccept} className="btn-primary">Accept Sprint</button>
                <button onClick={handleDecline} className="btn-secondary">Decline</button>
              </>
            )}

            {isActive && !showOutcome && (
              <button onClick={() => setShowOutcome(true)} className="btn-primary">
                Mark Complete
              </button>
            )}

            {showOutcome && (
              <div className="card p-5 w-full space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">How did it go?</p>
                  {(template || resources.length > 0) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Make sure you&apos;ve saved the artifact and added resources before completing.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedOutcome(opt)}
                      className={`sprint-option-chip text-sm ${selectedOutcome === opt ? "sprint-option-chip-selected" : ""}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleMarkComplete} disabled={!selectedOutcome || saving} className="btn-primary">
                    {saving ? "Saving..." : "Confirm"}
                  </button>
                  <button onClick={() => setShowOutcome(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Add / Edit Resource modal */}
      {(showAddResource || editingResource) && currentUserId && (
        <AddResourceModal
          sprintId={sprint.id}
          currentUserId={currentUserId}
          resource={editingResource}
          defaultType={!editingResource ? addDefaultType : undefined}
          onClose={() => {
            setShowAddResource(false);
            setEditingResource(null);
            setAddDefaultType(undefined);
          }}
          onSaved={handleResourceSaved}
        />
      )}
    </PageShell>
  );
}
