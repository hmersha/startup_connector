"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AppShell from "@/components/AppShell";

type Conversation = {
  id: string;
  otherUser: {
    id: string;
    name: string;
    username: string | null;
  };
  lastMessage: {
    body: string;
    created_at: string;
    sender_id: string;
  } | null;
};

export default function MessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    async function loadConversations() {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);
      setAuthChecked(true);

      const { data: myMemberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUser.id);

      if (!myMemberships || myMemberships.length === 0) {
        setLoading(false);
        return;
      }

      const convoIds = myMemberships.map((m) => m.conversation_id);

      const { data: allMembers } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id, users(id, name, username)")
        .in("conversation_id", convoIds)
        .neq("user_id", currentUser.id);

      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id, body, created_at, sender_id")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });

      const convoMap = new Map<string, Conversation>();

      allMembers?.forEach((member) => {
        const userData = member.users as unknown as {
          id: string;
          name: string;
          username: string | null;
        };
        if (!userData) return;

        const lastMsg = lastMessages?.find(
          (m) => m.conversation_id === member.conversation_id
        );

        convoMap.set(member.conversation_id, {
          id: member.conversation_id,
          otherUser: {
            id: userData.id,
            name: userData.name,
            username: userData.username,
          },
          lastMessage: lastMsg
            ? {
                body: lastMsg.body,
                created_at: lastMsg.created_at,
                sender_id: lastMsg.sender_id,
              }
            : null,
        });
      });

      const sorted = Array.from(convoMap.values()).sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return (
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
        );
      });

      setConversations(sorted);
      setLoading(false);
    }

    loadConversations();
  }, []);

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }

  if (authChecked && !user) {
    return (
      <AppShell title="Messages">
        <div className="card p-8 text-center max-w-md mx-auto">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Sign in to view messages
          </h2>
          <p className="text-slate-400 mb-6">
            Send and receive direct messages with other members.
          </p>
          <Link href="/login" className="btn-primary inline-block">
            Log In
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title="Messages">
        <div className="card divide-y divide-slate-700/50">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
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

  return (
    <AppShell title="Messages">
      <div className="flex items-center justify-end -mt-4 mb-6">
        <Link
          href="/members"
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Find members →
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-slate-700/50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            No messages yet
          </h2>
          <p className="text-slate-400 mb-6">
            Start a conversation with someone from the members page.
          </p>
          <Link href="/members" className="btn-primary inline-block">
            Browse Members
          </Link>
        </div>
      ) : (
        <div className="card divide-y divide-slate-700/50">
          {conversations.map((convo) => (
            <Link
              key={convo.id}
              href={`/messages/${convo.id}`}
              className="p-4 flex items-center gap-4 hover:bg-slate-700/30 transition-colors"
            >
              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-white">
                  {(
                    convo.otherUser.username ??
                    convo.otherUser.name ??
                    "?"
                  )[0].toUpperCase()}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-100 truncate">
                    {convo.otherUser.username ?? convo.otherUser.name}
                  </span>
                  {convo.lastMessage && (
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatTime(convo.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                {convo.lastMessage ? (
                  <p className="text-sm text-slate-400 truncate">
                    {convo.lastMessage.sender_id === user?.id ? "You: " : ""}
                    {convo.lastMessage.body}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No messages yet
                  </p>
                )}
              </div>

              {/* Arrow */}
              <svg
                className="w-5 h-5 text-slate-600 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
