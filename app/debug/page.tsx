"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type UserProfile = {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  school: string | null;
  major: string | null;
  bio: string | null;
  reputation: number;
  one_liner: string | null;
  categories: string[];
  stage: string | null;
  looking_for: string[];
  skills: string[];
  availability: string | null;
  visibility: string;
  builder_card_updated_at: string | null;
  last_active_at: string | null;
  created_at: string;
};

type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester_name?: string;
  addressee_name?: string;
};

type MatchFeedback = {
  id: string;
  user_id: string;
  target_user_id: string;
  action: string;
  created_at: string;
  target_name?: string;
};

export default function DebugPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [feedbacks, setFeedbacks] = useState<MatchFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only show in development
  const isDev = process.env.NODE_ENV === "development";

  async function loadDebugData() {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) {
        setError(`Auth error: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!authData?.user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      // Fetch all data in parallel
      const [profileResult, connectionsResult, feedbackResult] = await Promise.all([
        supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id)
          .single(),
        supabase
          .from("connections")
          .select("*")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
          .order("created_at", { ascending: false }),
        supabase
          .from("match_feedback")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false }),
      ]);

      if (profileResult.error) {
        setError(`Profile error: ${profileResult.error.message}`);
      } else if (profileResult.data) {
        setProfile(profileResult.data as UserProfile);
      }

      if (connectionsResult.error) {
        console.error("Connections error:", connectionsResult.error);
      } else if (connectionsResult.data) {
        // Fetch user names for connections
        const userIds = new Set<string>();
        connectionsResult.data.forEach((c) => {
          userIds.add(c.requester_id);
          userIds.add(c.addressee_id);
        });

        const { data: users } = await supabase
          .from("users")
          .select("id, username, name")
          .in("id", Array.from(userIds));

        const userMap = new Map<string, string>();
        users?.forEach((u) => {
          userMap.set(u.id, u.username || u.name || u.id.slice(0, 8));
        });

        setConnections(
          connectionsResult.data.map((c) => ({
            ...c,
            requester_name: userMap.get(c.requester_id),
            addressee_name: userMap.get(c.addressee_id),
          }))
        );
      }

      if (feedbackResult.error) {
        console.error("Feedback error:", feedbackResult.error);
      } else if (feedbackResult.data) {
        // Fetch user names for feedback targets
        const targetIds = feedbackResult.data.map((f) => f.target_user_id);

        const { data: targets } = await supabase
          .from("users")
          .select("id, username, name")
          .in("id", targetIds);

        const targetMap = new Map<string, string>();
        targets?.forEach((u) => {
          targetMap.set(u.id, u.username || u.name || u.id.slice(0, 8));
        });

        setFeedbacks(
          feedbackResult.data.map((f) => ({
            ...f,
            target_name: targetMap.get(f.target_user_id),
          }))
        );
      }
    } catch (err: any) {
      setError(err?.message || "Unknown error");
    }

    setLoading(false);
  }

  useEffect(() => {
    if (isDev) {
      loadDebugData();
    }
  }, [isDev]);

  if (!isDev) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Debug page unavailable</h2>
        <p className="text-slate-400">This page is only available in development mode.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card p-6 space-y-4">
          <div className="skeleton h-6 w-full" />
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-6 w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="section-header">Debug</h1>
        <div className="card p-6 bg-red-500/10 border-red-500/30">
          <p className="text-red-300">{error}</p>
          <button onClick={loadDebugData} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-header">Debug</h1>
        <button onClick={loadDebugData} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Auth User */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Auth User
        </h2>
        {user && (
          <div className="debug-grid">
            <DebugRow label="ID" value={user.id} />
            <DebugRow label="Email" value={user.email || "—"} />
            <DebugRow label="Created" value={user.created_at ? new Date(user.created_at).toLocaleString() : "—"} />
            <DebugRow label="Last Sign In" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"} />
          </div>
        )}
      </div>

      {/* Profile / Builder Card Fields */}
      {profile && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Profile & Builder Card
          </h2>
          <div className="debug-grid">
            <DebugRow label="Username" value={profile.username || "—"} />
            <DebugRow label="Name" value={profile.name || "—"} />
            <DebugRow label="School" value={profile.school || "—"} />
            <DebugRow label="Major" value={profile.major || "—"} />
            <DebugRow label="Reputation" value={profile.reputation} />
            <DebugRow label="Visibility" value={profile.visibility} highlight />
            <div className="col-span-2 border-t border-slate-700/50 my-2" />
            <DebugRow label="One-liner" value={profile.one_liner || "—"} />
            <DebugRow label="Categories" value={profile.categories?.length ? profile.categories.join(", ") : "—"} />
            <DebugRow label="Stage" value={profile.stage || "—"} />
            <DebugRow label="Looking for" value={profile.looking_for?.length ? profile.looking_for.join(", ") : "—"} />
            <DebugRow label="Skills" value={profile.skills?.length ? profile.skills.join(", ") : "—"} />
            <DebugRow label="Availability" value={profile.availability || "—"} />
            <DebugRow label="Builder Card Updated" value={profile.builder_card_updated_at ? new Date(profile.builder_card_updated_at).toLocaleString() : "Never"} />
          </div>
        </div>
      )}

      {/* Connections */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Connections ({connections.length})
        </h2>
        {connections.length === 0 ? (
          <p className="text-slate-500 text-sm">No connections yet</p>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => {
              const isRequester = c.requester_id === user?.id;
              const otherName = isRequester ? c.addressee_name : c.requester_name;
              const direction = isRequester ? "→" : "←";

              return (
                <div key={c.id} className="flex items-center gap-3 text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                  <span className="text-slate-400">{direction}</span>
                  <span className="text-slate-100 font-medium">{otherName}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    c.status === "accepted" ? "bg-emerald-500/20 text-emerald-400" :
                    c.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-500/20 text-slate-400"
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-slate-500 text-xs ml-auto">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Match Feedback */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          Match Feedback ({feedbacks.length})
        </h2>
        {feedbacks.length === 0 ? (
          <p className="text-slate-500 text-sm">No match feedback recorded</p>
        ) : (
          <div className="space-y-2">
            {feedbacks.map((f) => (
              <div key={f.id} className="flex items-center gap-3 text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="text-slate-100 font-medium">{f.target_name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  f.action === "dismiss" ? "bg-red-500/20 text-red-400" :
                  f.action === "less_like_this" ? "bg-amber-500/20 text-amber-400" :
                  "bg-slate-500/20 text-slate-400"
                }`}>
                  {f.action}
                </span>
                <span className="text-slate-500 text-xs ml-auto">
                  {new Date(f.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DebugRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <>
      <span className="text-slate-500 text-sm">{label}</span>
      <span className={`text-sm ${highlight ? "text-indigo-400 font-medium" : "text-slate-200"}`}>
        {value}
      </span>
    </>
  );
}
