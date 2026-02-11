"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AppShell from "@/components/AppShell";

type ConnectionUser = {
  id: string;
  name: string;
  username: string | null;
  school: string | null;
  major: string | null;
  reputation: number;
};

type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  requester?: ConnectionUser;
  addressee?: ConnectionUser;
};

type Tab = "incoming" | "outgoing" | "connected";

export default function ConnectionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("incoming");

  const [incomingRequests, setIncomingRequests] = useState<Connection[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Connection[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<Connection[]>([]);

  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConnections() {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);
      setAuthChecked(true);

      // Fetch all connections involving the current user
      const { data: connectionsData, error: connectionsError } = await supabase
        .from("connections")
        .select("*")
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

      if (connectionsError) {
        console.error("Error fetching connections:", connectionsError);
        setLoading(false);
        return;
      }

      // Get all user IDs we need to fetch
      const userIds = new Set<string>();
      connectionsData?.forEach((conn) => {
        userIds.add(conn.requester_id);
        userIds.add(conn.addressee_id);
      });

      // Fetch user details
      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, username, school, major, reputation")
        .in("id", [...userIds]);

      const usersMap = new Map<string, ConnectionUser>();
      usersData?.forEach((u) => usersMap.set(u.id, u));

      // Categorize connections
      const incoming: Connection[] = [];
      const outgoing: Connection[] = [];
      const connected: Connection[] = [];

      connectionsData?.forEach((conn) => {
        const enrichedConn: Connection = {
          ...conn,
          requester: usersMap.get(conn.requester_id),
          addressee: usersMap.get(conn.addressee_id),
        };

        if (conn.status === "accepted") {
          connected.push(enrichedConn);
        } else if (conn.status === "pending") {
          if (conn.addressee_id === currentUser.id) {
            incoming.push(enrichedConn);
          } else {
            outgoing.push(enrichedConn);
          }
        }
      });

      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setConnectedUsers(connected);
      setLoading(false);
    }

    loadConnections();
  }, []);

  async function handleAccept(connectionId: string) {
    setProcessing(connectionId);
    setError(null);

    const { error: updateError } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", connectionId);

    if (updateError) {
      console.error("Error accepting connection:", updateError);
      setError(updateError.message || "Failed to accept connection");
      setProcessing(null);
      return;
    }

    // Move from incoming to connected
    const accepted = incomingRequests.find((r) => r.id === connectionId);
    if (accepted) {
      setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId));
      setConnectedUsers((prev) => [...prev, { ...accepted, status: "accepted" }]);
    }
    setProcessing(null);
  }

  async function handleDecline(connectionId: string) {
    setProcessing(connectionId);
    setError(null);

    const { error: updateError } = await supabase
      .from("connections")
      .update({ status: "declined" })
      .eq("id", connectionId);

    if (updateError) {
      console.error("Error declining connection:", updateError);
      setError(updateError.message || "Failed to decline connection");
      setProcessing(null);
      return;
    }

    // Remove from incoming
    setIncomingRequests((prev) => prev.filter((r) => r.id !== connectionId));
    setProcessing(null);
  }

  async function handleCancelRequest(connectionId: string) {
    setProcessing(connectionId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("connections")
      .delete()
      .eq("id", connectionId);

    if (deleteError) {
      console.error("Error canceling request:", deleteError);
      setError(deleteError.message || "Failed to cancel request");
      setProcessing(null);
      return;
    }

    // Remove from outgoing
    setOutgoingRequests((prev) => prev.filter((r) => r.id !== connectionId));
    setProcessing(null);
  }

  async function handleRemoveConnection(connectionId: string) {
    setProcessing(connectionId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("connections")
      .delete()
      .eq("id", connectionId);

    if (deleteError) {
      console.error("Error removing connection:", deleteError);
      setError(deleteError.message || "Failed to remove connection");
      setProcessing(null);
      return;
    }

    // Remove from connected
    setConnectedUsers((prev) => prev.filter((r) => r.id !== connectionId));
    setProcessing(null);
  }

  function startConversation(otherUserId: string) {
    router.push(`/members?message=${otherUserId}`);
  }

  // Get the "other" user from a connection
  function getOtherUser(conn: Connection): ConnectionUser | undefined {
    if (!user) return undefined;
    return conn.requester_id === user.id ? conn.addressee : conn.requester;
  }

  if (authChecked && !user) {
    return (
      <AppShell title="Connections">
        <div className="card p-8 text-center max-w-md mx-auto">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Sign in to view connections</h2>
          <p className="text-slate-400 mb-6">Manage your network and connection requests.</p>
          <Link href="/login" className="btn-primary inline-block">Log In</Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Connections" subtitle="Manage your network and connection requests">
        <div className="flex gap-2 mb-6">
          <div className="skeleton h-10 w-28 rounded-lg" />
          <div className="skeleton h-10 w-28 rounded-lg" />
          <div className="skeleton h-10 w-28 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "incoming", label: "Incoming", count: incomingRequests.length },
    { id: "outgoing", label: "Outgoing", count: outgoingRequests.length },
    { id: "connected", label: "Connected", count: connectedUsers.length },
  ];

  return (
    <AppShell title="Connections" subtitle="Manage your network and connection requests">
      {/* Error Toast */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700/50 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`connection-tab ${activeTab === tab.id ? "connection-tab-active" : ""}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === tab.id
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "bg-slate-700/50 text-slate-400"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "incoming" && (
        <div className="space-y-3">
          {incomingRequests.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-400">No incoming requests</p>
            </div>
          ) : (
            incomingRequests.map((conn) => {
              const otherUser = conn.requester;
              if (!otherUser) return null;

              return (
                <div key={conn.id} className="card p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-medium text-white">
                      {(otherUser.username ?? otherUser.name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{otherUser.username ?? otherUser.name}</span>
                      <span className="rep-badge text-xs">{otherUser.reputation}</span>
                    </div>
                    {(otherUser.school || otherUser.major) && (
                      <p className="text-sm text-slate-500 truncate">
                        {[otherUser.major, otherUser.school].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(conn.id)}
                      disabled={processing === conn.id}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      {processing === conn.id ? "..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleDecline(conn.id)}
                      disabled={processing === conn.id}
                      className="btn-secondary text-sm px-4 py-2"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "outgoing" && (
        <div className="space-y-3">
          {outgoingRequests.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <p className="text-slate-400">No pending requests</p>
              <Link href="/members" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
                Browse members to connect
              </Link>
            </div>
          ) : (
            outgoingRequests.map((conn) => {
              const otherUser = conn.addressee;
              if (!otherUser) return null;

              return (
                <div key={conn.id} className="card p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-medium text-white">
                      {(otherUser.username ?? otherUser.name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{otherUser.username ?? otherUser.name}</span>
                      <span className="rep-badge text-xs">{otherUser.reputation}</span>
                      <span className="connection-pill-pending">Pending</span>
                    </div>
                    {(otherUser.school || otherUser.major) && (
                      <p className="text-sm text-slate-500 truncate">
                        {[otherUser.major, otherUser.school].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelRequest(conn.id)}
                    disabled={processing === conn.id}
                    className="btn-secondary text-sm px-4 py-2 flex-shrink-0"
                  >
                    {processing === conn.id ? "..." : "Cancel"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "connected" && (
        <div className="space-y-3">
          {connectedUsers.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-slate-400">No connections yet</p>
              <Link href="/members" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
                Browse members to connect
              </Link>
            </div>
          ) : (
            connectedUsers.map((conn) => {
              const otherUser = getOtherUser(conn);
              if (!otherUser) return null;

              return (
                <div key={conn.id} className="card card-hover p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-medium text-white">
                      {(otherUser.username ?? otherUser.name ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{otherUser.username ?? otherUser.name}</span>
                      <span className="rep-badge text-xs">{otherUser.reputation}</span>
                      <span className="connection-pill-connected">Connected</span>
                    </div>
                    {(otherUser.school || otherUser.major) && (
                      <p className="text-sm text-slate-500 truncate">
                        {[otherUser.major, otherUser.school].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startConversation(otherUser.id)}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => handleRemoveConnection(conn.id)}
                      disabled={processing === conn.id}
                      className="btn-secondary text-sm px-4 py-2 text-red-400 hover:text-red-300"
                    >
                      {processing === conn.id ? "..." : "Remove"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </AppShell>
  );
}
