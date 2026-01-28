"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Member = {
  id: string;
  name: string;
  username: string | null;
  school: string | null;
  major: string | null;
  reputation: number;
  last_active_at: string | null;
  created_at: string;
  visibility: string;
};

type Connection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined";
};

type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

function getActivityStatus(
  lastActiveAt: string | null,
  createdAt: string
): { label: string; class: string } | null {
  const now = new Date();
  const created = new Date(createdAt);
  const hoursSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (hoursSinceCreated <= 48) {
    return { label: "New", class: "pill-new" };
  }

  if (!lastActiveAt) {
    return null;
  }

  const lastActive = new Date(lastActiveAt);
  const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);

  if (hoursSinceActive <= 24) {
    return { label: "Active today", class: "pill-active-today" };
  } else if (hoursSinceActive <= 24 * 7) {
    return { label: "Active this week", class: "pill-active-week" };
  } else if (hoursSinceActive <= 24 * 30) {
    return { label: "Active recently", class: "pill-active-recently" };
  }

  return null;
}

function MembersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get connection status for a member
  function getConnectionStatus(memberId: string): { status: ConnectionStatus; connection?: Connection } {
    if (!user) return { status: "none" };

    const conn = connections.find(
      (c) =>
        (c.requester_id === user.id && c.addressee_id === memberId) ||
        (c.addressee_id === user.id && c.requester_id === memberId)
    );

    if (!conn) return { status: "none" };

    if (conn.status === "accepted") {
      return { status: "connected", connection: conn };
    }

    if (conn.status === "pending") {
      if (conn.requester_id === user.id) {
        return { status: "pending_sent", connection: conn };
      } else {
        return { status: "pending_received", connection: conn };
      }
    }

    return { status: "none" };
  }

  useEffect(() => {
    async function loadMembersAndConnections() {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);
      setAuthChecked(true);

      // Fetch members and connections in parallel
      // Filter out match_only users - they only appear in Discover page
      const [membersResult, connectionsResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, username, school, major, reputation, last_active_at, created_at, visibility")
          .in("visibility", ["public", "private"])
          .order("name", { ascending: true }),
        supabase
          .from("connections")
          .select("*")
          .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
          .in("status", ["pending", "accepted"]),
      ]);

      if (membersResult.data) {
        setMembers(membersResult.data);
      }

      if (connectionsResult.data) {
        setConnections(connectionsResult.data);
      }

      setLoading(false);

      // Check if we should auto-start a conversation (from connections page)
      const messageUserId = searchParams.get("message");
      if (messageUserId) {
        // Remove the query param
        router.replace("/members");
        // Start conversation with that user
        startConversation(messageUserId);
      }
    }

    loadMembersAndConnections();
  }, [searchParams]);

  async function sendConnectionRequest(otherUserId: string) {
    if (!user) return;

    setConnectingTo(otherUserId);
    setError(null);

    try {
      const { data: newConn, error: insertError } = await supabase
        .from("connections")
        .insert({
          requester_id: user.id,
          addressee_id: otherUserId,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error sending connection request:", insertError);
        throw insertError;
      }

      if (newConn) {
        setConnections((prev) => [...prev, newConn]);
      }
    } catch (err: any) {
      console.error("Error sending connection request:", err?.message ?? err, err);
      setError(err?.message ?? "Failed to send connection request");
    } finally {
      setConnectingTo(null);
    }
  }

  async function acceptConnectionRequest(connectionId: string) {
    setConnectingTo(connectionId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", connectionId);

      if (updateError) {
        console.error("Error accepting connection:", updateError);
        throw updateError;
      }

      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, status: "accepted" as const } : c))
      );
    } catch (err: any) {
      console.error("Error accepting connection:", err?.message ?? err, err);
      setError(err?.message ?? "Failed to accept connection");
    } finally {
      setConnectingTo(null);
    }
  }

  async function declineConnectionRequest(connectionId: string) {
    setConnectingTo(connectionId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("connections")
        .update({ status: "declined" })
        .eq("id", connectionId);

      if (updateError) {
        console.error("Error declining connection:", updateError);
        throw updateError;
      }

      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (err: any) {
      console.error("Error declining connection:", err?.message ?? err, err);
      setError(err?.message ?? "Failed to decline connection");
    } finally {
      setConnectingTo(null);
    }
  }

  async function startConversation(otherUserId: string) {
    if (!user) return;

    // Check connection status first
    const { status } = getConnectionStatus(otherUserId);
    if (status !== "connected") {
      setError("You must connect before messaging.");
      return;
    }

    setStartingChat(otherUserId);
    setError(null);

    const currentUserId = user.id;
    console.log("DM click auth user:", user);

    try {
      // Check for existing conversation between these two users
      const { data: existingConvos, error: existingError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existingError) {
        console.log("Error fetching existing conversations:", existingError);
        throw new Error(existingError.message || "Failed to check existing conversations");
      }

      if (existingConvos && existingConvos.length > 0) {
        const convoIds = existingConvos.map((c) => c.conversation_id);

        const { data: sharedConvo, error: sharedError } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", convoIds)
          .limit(1)
          .single();

        if (sharedError && sharedError.code !== "PGRST116") {
          console.log("Error checking shared conversation:", sharedError);
          throw new Error(sharedError.message || "Failed to check for existing conversation");
        }

        if (sharedConvo) {
          router.push(`/messages/${sharedConvo.conversation_id}`);
          return;
        }
      }

      // Create conversation with created_by set to current user
      console.log("Creating new conversation...");
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({ created_by: currentUserId })
        .select("id")
        .single();

      if (convoError) {
        console.error(convoError.message, convoError);
        throw convoError;
      }

      if (!newConvo?.id) {
        console.log("No conversation ID returned");
        throw new Error("Failed to create conversation - no ID returned");
      }

      const conversationId = newConvo.id;
      console.log("Created conversation:", conversationId);

      // Insert conversation_members - first current user
      const { error: selfMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: conversationId, user_id: currentUserId });

      if (selfMemberError) {
        console.log("Error adding self to conversation:", selfMemberError);
        await supabase.from("conversations").delete().eq("id", conversationId);
        throw selfMemberError;
      }

      // Insert conversation_members - then target user
      const { error: otherMemberError } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: conversationId, user_id: otherUserId });

      if (otherMemberError) {
        console.log("Error adding other user to conversation:", otherMemberError);
        await supabase.from("conversation_members").delete().eq("conversation_id", conversationId);
        await supabase.from("conversations").delete().eq("id", conversationId);
        throw otherMemberError;
      }

      // Only redirect after both succeed
      console.log("Both members added successfully, navigating to:", conversationId);
      router.push(`/messages/${conversationId}`);
    } catch (err: any) {
      console.error("Error creating conversation:", err?.message ?? err, err);
      setError(err?.message ?? "Failed to start conversation");
      setStartingChat(null);
    }
  }

  if (authChecked && !user) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Sign in to view members</h2>
        <p className="text-slate-400 mb-6">Connect with other CollabSpace members.</p>
        <Link href="/login" className="btn-primary inline-block">Log In</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-32" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Toast */}
      {error && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
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

      <div>
        <h1 className="section-header">Members</h1>
        <p className="section-subtitle">
          {members.length} member{members.length !== 1 ? "s" : ""} in CollabSpace
        </p>
      </div>

      {members.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-400">No members yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => {
            const activityStatus = getActivityStatus(member.last_active_at, member.created_at);
            const { status: connStatus, connection } = getConnectionStatus(member.id);
            const isProcessing = connectingTo === member.id || connectingTo === connection?.id;
            const isSelf = user && member.id === user.id;

            // Privacy: private users show limited info unless connected or self
            const isPrivate = member.visibility === "private";
            const showFullProfile = !isPrivate || connStatus === "connected" || isSelf;

            return (
              <div key={member.id} className="card card-hover p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-medium text-white">
                    {(member.username ?? member.name ?? "?")[0].toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-100 truncate">
                      {member.username ?? member.name}
                    </span>
                    <span className="rep-badge text-xs">{member.reputation}</span>
                    {activityStatus && (
                      <span className={`pill ${activityStatus.class} flex-shrink-0`}>
                        {activityStatus.label}
                      </span>
                    )}
                    {isPrivate && !showFullProfile && (
                      <span className="text-xs text-slate-500 flex-shrink-0">Private profile</span>
                    )}
                    {connStatus === "connected" && (
                      <span className="connection-pill-connected flex-shrink-0">Connected</span>
                    )}
                    {connStatus === "pending_sent" && (
                      <span className="connection-pill-pending flex-shrink-0">Pending</span>
                    )}
                  </div>
                  {showFullProfile && (member.school || member.major) && (
                    <p className="text-sm text-slate-500 truncate">
                      {[member.major, member.school].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {!showFullProfile && (
                    <p className="text-sm text-slate-600 italic truncate">
                      Connect to see full profile
                    </p>
                  )}
                </div>

                {/* Actions */}
                {user && !isSelf && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Not connected - show Connect button */}
                    {connStatus === "none" && (
                      <button
                        onClick={() => sendConnectionRequest(member.id)}
                        disabled={isProcessing}
                        className="btn-secondary text-sm px-3 py-1.5"
                      >
                        {isProcessing ? "..." : "Connect"}
                      </button>
                    )}

                    {/* Pending sent - show Pending pill (already shown above) */}
                    {connStatus === "pending_sent" && (
                      <span className="text-xs text-slate-500">Request sent</span>
                    )}

                    {/* Pending received - show Accept/Decline */}
                    {connStatus === "pending_received" && connection && (
                      <>
                        <button
                          onClick={() => acceptConnectionRequest(connection.id)}
                          disabled={isProcessing}
                          className="btn-primary text-sm px-3 py-1.5"
                        >
                          {isProcessing ? "..." : "Accept"}
                        </button>
                        <button
                          onClick={() => declineConnectionRequest(connection.id)}
                          disabled={isProcessing}
                          className="btn-secondary text-sm px-3 py-1.5"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {/* Connected - show Message button */}
                    {connStatus === "connected" && (
                      <button
                        onClick={() => startConversation(member.id)}
                        disabled={startingChat === member.id}
                        className="btn-primary text-sm px-3 py-1.5"
                      >
                        {startingChat === member.id ? "..." : "Message"}
                      </button>
                    )}
                  </div>
                )}

                {/* Self indicator */}
                {isSelf && (
                  <span className="text-xs text-slate-500 flex-shrink-0">You</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense boundary for useSearchParams
export default function MembersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="skeleton h-8 w-32" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    }>
      <MembersContent />
    </Suspense>
  );
}
