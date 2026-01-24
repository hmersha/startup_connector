"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
};

export default function MembersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  useEffect(() => {
    async function loadMembers() {
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

      const { data: membersData } = await supabase
        .from("users")
        .select("id, name, username, school, major, reputation")
        .order("name", { ascending: true });

      if (membersData) {
        setMembers(membersData);
      }

      setLoading(false);
    }

    loadMembers();
  }, []);

  async function startConversation(otherUserId: string) {
    if (!user) return;

    setStartingChat(otherUserId);

    // Check if conversation already exists between these two users
    const { data: existingConvos } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (existingConvos && existingConvos.length > 0) {
      const convoIds = existingConvos.map((c) => c.conversation_id);

      const { data: sharedConvo } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId)
        .in("conversation_id", convoIds)
        .limit(1)
        .single();

      if (sharedConvo) {
        router.push(`/messages/${sharedConvo.conversation_id}`);
        return;
      }
    }

    // Create new conversation
    const { data: newConvo, error: convoError } = await supabase
      .from("conversations")
      .insert({})
      .select("id")
      .single();

    if (convoError || !newConvo) {
      setStartingChat(null);
      return;
    }

    // Add both members
    await supabase.from("conversation_members").insert([
      { conversation_id: newConvo.id, user_id: user.id },
      { conversation_id: newConvo.id, user_id: otherUserId },
    ]);

    router.push(`/messages/${newConvo.id}`);
  }

  if (authChecked && !user) {
    return (
      <div className="card p-8 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-indigo-600"
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
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Sign in to view members
        </h2>
        <p className="text-gray-500 mb-6">
          Connect with other CollabSpace members.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Log In
        </Link>
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
      <div>
        <h1 className="section-header">Members</h1>
        <p className="section-subtitle">
          {members.length} member{members.length !== 1 ? "s" : ""} in
          CollabSpace
        </p>
      </div>

      {members.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500">No members yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="card card-hover p-4 flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-white">
                  {(member.username ?? member.name ?? "?")[0].toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {member.username ?? member.name}
                  </span>
                  <span className="flex items-center justify-center w-6 h-6 bg-indigo-50 rounded-full text-xs font-semibold text-indigo-600 border border-indigo-100 flex-shrink-0">
                    {member.reputation}
                  </span>
                </div>
                {(member.school || member.major) && (
                  <p className="text-sm text-gray-500 truncate">
                    {[member.major, member.school].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              {/* Message button (don't show for self) */}
              {user && member.id !== user.id && (
                <button
                  onClick={() => startConversation(member.id)}
                  disabled={startingChat === member.id}
                  className="btn-secondary text-sm px-3 py-1.5 flex-shrink-0"
                >
                  {startingChat === member.id ? "..." : "Message"}
                </button>
              )}

              {/* Self indicator */}
              {user && member.id === user.id && (
                <span className="text-xs text-gray-400 flex-shrink-0">You</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
