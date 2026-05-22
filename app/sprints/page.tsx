"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import PageShell from "@/components/PageShell";

type SprintUser = { id: string; name: string | null; username: string | null };

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

const SPRINT_TYPE_LABELS: Record<string, string> = {
  validation: "Feedback Sprint",
  mvp_scope: "MVP Scope Sprint",
  build: "Build / Validation Sprint",
  gtm: "GTM Sprint",
  cofounder_fit: "Chemistry Sprint",
};

function formatDuration(days: number) {
  if (days <= 3) return "3 days";
  if (days <= 7) return "1 week";
  if (days <= 14) return "2 weeks";
  return `${days} days`;
}

function SprintStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    proposed: "sprint-status-proposed",
    accepted: "sprint-status-active",
    active: "sprint-status-active",
    completed: "sprint-status-completed",
    declined: "sprint-status-declined",
    cancelled: "sprint-status-declined",
  };
  const labels: Record<string, string> = {
    proposed: "Proposed",
    accepted: "Active",
    active: "Active",
    completed: "Completed",
    declined: "Declined",
    cancelled: "Cancelled",
  };
  return (
    <span className={`sprint-status-badge ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function SprintCard({
  sprint,
  currentUserId,
  onAccept,
  onDecline,
}: {
  sprint: Sprint;
  currentUserId: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const isProposer = sprint.proposer_id === currentUserId;
  const other = isProposer ? sprint.recipient : sprint.proposer;
  const otherName = other?.username || other?.name || "Builder";
  const role = isProposer ? "You proposed" : "Proposed to you";

  return (
    <div className="sprint-card">
      <div className="sprint-card-header">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SprintStatusBadge status={sprint.status} />
            <span className="sprint-type-label">
              {SPRINT_TYPE_LABELS[sprint.sprint_type] ?? sprint.sprint_type}
            </span>
          </div>
          <h3 className="sprint-card-title">{sprint.title}</h3>
          <p className="sprint-card-meta">
            {role} · {formatDuration(sprint.duration_days)}
            {sprint.expected_commitment && ` · ${sprint.expected_commitment}`}
          </p>
        </div>
      </div>

      <p className="sprint-card-goal">{sprint.goal}</p>

      <div className="sprint-card-actions">
        <Link href={`/sprints/${sprint.id}`} className="btn-secondary text-sm py-1.5 px-3">
          Open
        </Link>

        {sprint.status === "proposed" && !isProposer && (
          <>
            <button
              onClick={() => onAccept(sprint.id)}
              className="btn-primary text-sm py-1.5 px-3"
            >
              Accept Sprint
            </button>
            <button
              onClick={() => onDecline(sprint.id)}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type Tab = "proposed" | "active" | "completed";

export default function SprintsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("proposed");
  const [error, setError] = useState("");

  const loadSprints = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user ?? null;
    setUser(currentUser);
    setAuthChecked(true);

    if (!currentUser) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("sprints")
      .select(`
        *,
        proposer:users!proposer_id(id, name, username),
        recipient:users!recipient_id(id, name, username)
      `)
      .or(`proposer_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Could not load sprints. Make sure the database migration has been run.");
    } else {
      setSprints((data as unknown as Sprint[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSprints();
  }, [loadSprints]);

  async function handleAccept(id: string) {
    await supabase
      .from("sprints")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", id);
    setSprints((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "accepted" } : s))
    );
  }

  async function handleDecline(id: string) {
    await supabase.from("sprints").update({ status: "declined" }).eq("id", id);
    setSprints((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "declined" } : s))
    );
  }


  if (!authChecked || loading) {
    return (
      <PageShell title="Sprints" subtitle="Test collaboration before committing.">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-36 rounded-xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell title="Sprints">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-slate-400 mb-4">Log in to view your sprints.</p>
          <Link href="/login" className="btn-primary inline-block">Log In</Link>
        </div>
      </PageShell>
    );
  }

  const proposed = sprints.filter((s) => s.status === "proposed");
  const active = sprints.filter((s) => s.status === "accepted" || s.status === "active");
  const completed = sprints.filter((s) => s.status === "completed" || s.status === "declined" || s.status === "cancelled");

  const tabSprints: Record<Tab, Sprint[]> = { proposed, active, completed };
  const currentSprints = tabSprints[activeTab];

  return (
    <PageShell
      title="Sprints"
      subtitle="Test collaboration before committing."
    >
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="discover-tabs mb-6">
        {(["proposed", "active", "completed"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`discover-tab ${activeTab === tab ? "discover-tab-active" : ""}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tabSprints[tab].length > 0 && (
              <span className="discover-tab-count">{tabSprints[tab].length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sprint list */}
      {currentSprints.length === 0 ? (
        <div className="discover-empty">
          <div className="discover-empty-icon">
            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="discover-empty-title">No sprints yet</h2>
          <p className="discover-empty-text">
            {activeTab === "proposed"
              ? "Find a builder or idea on Discover and propose a small sprint."
              : activeTab === "active"
              ? "No active sprints. Accept a proposed sprint or start one from Discover."
              : "Completed sprints will appear here once you finish one."}
          </p>
          {activeTab === "proposed" && (
            <>
              <p className="text-xs text-slate-600 mt-2">
                A sprint is a short, low-pressure way to test collaboration before connecting.
              </p>
              <Link href="/discover" className="btn-primary mt-4 inline-block">
                Go to Discover
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentSprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              currentUserId={user.id}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
