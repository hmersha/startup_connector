"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

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
};

const SPRINT_TYPE_LABELS: Record<string, string> = {
  validation: "Idea Sprint",
  mvp_scope: "MVP Scope Sprint",
  build: "Build Sprint",
  gtm: "GTM Sprint",
  cofounder_fit: "Chemistry Sprint",
};

const OUTCOME_OPTIONS = [
  "Continue exploring",
  "Start cofounder conversation",
  "Stay connected",
  "Not a fit",
];

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

export default function SprintRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sprintId = params.id as string;

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  // Connect after sprint
  const [isConnected, setIsConnected] = useState(false);
  const [connectionPending, setConnectionPending] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Update log
  const [updates, setUpdates] = useState<SprintUpdate[]>([]);
  const [newUpdate, setNewUpdate] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);
  const updatesEndRef = useRef<HTMLDivElement>(null);

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
      const { data: connData } = await supabase
        .from("connections")
        .select("status")
        .or(`and(requester_id.eq.${uid},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${uid})`)
        .maybeSingle();
      if (connData?.status === "accepted") setIsConnected(true);
      if (connData?.status === "pending") setConnectionPending(true);

      // Load update log
      const { data: updatesData } = await supabase
        .from("sprint_updates")
        .select("id, author_id, body, created_at")
        .eq("sprint_id", sprintId)
        .order("created_at", { ascending: true });
      if (updatesData) setUpdates(updatesData as SprintUpdate[]);

      setLoading(false);
    }
    load();
  }, [sprintId]);

  // Realtime: new updates from the other participant
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

  // Scroll to bottom when updates arrive
  useEffect(() => {
    updatesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [updates]);

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
    setCompleting(false);
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
    if (!currentUserId || !sprint || !newUpdate.trim()) return;
    setPostingUpdate(true);
    const body = newUpdate.trim();
    setNewUpdate("");
    const { data: inserted, error } = await supabase
      .from("sprint_updates")
      .insert({ sprint_id: sprint.id, author_id: currentUserId, body })
      .select("id, author_id, body, created_at")
      .single();
    if (!error && inserted) {
      setUpdates((prev) => {
        if (prev.some((u) => u.id === (inserted as SprintUpdate).id)) return prev;
        return [...prev, inserted as SprintUpdate];
      });
    } else if (error) {
      setNewUpdate(body); // restore on failure
    }
    setPostingUpdate(false);
  }

  if (loading) {
    return (
      <AppShell title="Sprint Room">
        <div className="space-y-4 max-w-2xl">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (notFound || !sprint) {
    return (
      <AppShell title="Sprint Room">
        <div className="card p-8 text-center max-w-md">
          <p className="text-slate-400 mb-4">Sprint not found or you don&apos;t have access.</p>
          <Link href="/sprints" className="btn-secondary inline-block">Back to Sprints</Link>
        </div>
      </AppShell>
    );
  }

  const isProposer = sprint.proposer_id === currentUserId;
  const isRecipient = sprint.recipient_id === currentUserId;
  const isParticipant = isProposer || isRecipient;
  const isActive = sprint.status === "accepted" || sprint.status === "active";
  const isProposed = sprint.status === "proposed";
  const isCompleted = sprint.status === "completed";

  const otherParticipant = isProposer ? sprint.recipient : sprint.proposer;
  const otherName = otherParticipant?.username || otherParticipant?.name || "Builder";

  function getAuthorName(authorId: string): string {
    if (authorId === sprint?.proposer_id) {
      return sprint?.proposer?.username || sprint?.proposer?.name || "Builder";
    }
    return sprint?.recipient?.username || sprint?.recipient?.name || "Builder";
  }

  const statusLabel: Record<string, string> = {
    proposed: "Proposed", accepted: "Active", active: "Active",
    completed: "Completed", declined: "Declined", cancelled: "Cancelled",
  };

  return (
    <AppShell title={sprint.title}>
      <div className="max-w-2xl space-y-6">

        {/* Header */}
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

        {/* Goal */}
        <div className="card p-6">
          <h2 className="sprint-room-section-title">Sprint Goal</h2>
          <p className="text-slate-300 text-sm leading-relaxed mt-2">{sprint.goal}</p>
        </div>

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

        {/* Deliverables */}
        {sprint.deliverables && sprint.deliverables.length > 0 && (
          <div className="card p-6">
            <h2 className="sprint-room-section-title">Deliverables</h2>
            <ul className="mt-3 space-y-2">
              {sprint.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="w-4 h-4 rounded border border-slate-600 flex-shrink-0 mt-0.5" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Update Log */}
        {(isActive || isCompleted) && (
          <div className="card p-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="sprint-room-section-title">Sprint Updates</h2>
              {updates.length > 0 && (
                <span className="text-xs text-slate-600">{updates.length} update{updates.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              A shared log. Track what you shared, learned, or decided.
            </p>

            {updates.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No updates yet. Start with the first move.</p>
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
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-200">{getAuthorName(u.author_id)}</span>
                        <span className="text-xs text-slate-500">{formatTimeAgo(u.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{u.body}</p>
                    </div>
                  </div>
                ))}
                <div ref={updatesEndRef} />
              </div>
            )}

            {isActive && isParticipant && (
              <form onSubmit={handlePostUpdate} className="flex gap-2 pt-3 border-t border-slate-700/40">
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
                  Post
                </button>
              </form>
            )}
          </div>
        )}

        {/* Outcome (if completed) */}
        {isCompleted && sprint.outcome && (
          <div className="card p-6 border-emerald-500/20">
            <h2 className="sprint-room-section-title text-emerald-400">Sprint Completed</h2>
            <p className="text-slate-300 text-sm mt-2">{sprint.outcome}</p>
          </div>
        )}

        {/* Connect CTA after completion */}
        {isCompleted && sprint.outcome !== "Not a fit" && isParticipant && (
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
                  {otherName} will see it under Connections. If they accept, messaging unlocks for both of you.
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

        {/* Actions */}
        {isParticipant && (
          <div className="flex flex-wrap gap-3">
            {isProposed && isRecipient && (
              <>
                <button onClick={handleAccept} className="btn-primary">Accept Sprint</button>
                <button onClick={handleDecline} className="btn-secondary">Decline</button>
              </>
            )}

            {isActive && !showOutcome && (
              <button onClick={() => { setCompleting(true); setShowOutcome(true); }} className="btn-primary">
                Mark Complete
              </button>
            )}

            {isActive && showOutcome && (
              <div className="card p-5 w-full space-y-4">
                <p className="text-sm font-medium text-slate-200">How did it go?</p>
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
                  <button onClick={() => { setShowOutcome(false); setCompleting(false); }} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
