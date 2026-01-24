"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

type OtherUser = {
  id: string;
  name: string;
  username: string | null;
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadConversation() {
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

      // Load messages and other user in parallel
      const [messagesResult, membersResult] = await Promise.all([
        supabase
          .from("messages")
          .select("id, body, sender_id, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("conversation_members")
          .select("user_id, users(id, name, username)")
          .eq("conversation_id", id)
          .neq("user_id", currentUser.id)
          .single(),
      ]);

      if (messagesResult.data) {
        setMessages(messagesResult.data);
      }

      if (membersResult.data) {
        const userData = membersResult.data.users as unknown as OtherUser;
        setOtherUser(userData);
      }

      setLoading(false);
    }

    loadConversation();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    setSending(true);

    const { error } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: user.id,
      body: newMessage.trim(),
    });

    setSending(false);

    if (!error) {
      setNewMessage("");
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDateHeader(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
  }

  // Group messages by date
  function getMessagesWithDateHeaders() {
    const result: (Message | { type: "date"; date: string })[] = [];
    let lastDate = "";

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        result.push({ type: "date", date: msg.created_at });
        lastDate = msgDate;
      }
      result.push(msg);
    });

    return result;
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
          Sign in to view messages
        </h2>
        <p className="text-gray-500 mb-6">
          You need to be logged in to view this conversation.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Log In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-full" />
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="card p-4 space-y-4">
          <div className="flex justify-start">
            <div className="skeleton h-10 w-48 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <div className="skeleton h-10 w-36 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <div className="skeleton h-10 w-52 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const messagesWithHeaders = getMessagesWithDateHeaders();

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/messages"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-white">
            {(
              otherUser?.username ??
              otherUser?.name ??
              "?"
            )[0].toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className="font-semibold text-gray-900">
            {otherUser?.username ?? otherUser?.name ?? "Unknown"}
          </h1>
        </div>
      </div>

      {/* Messages */}
      <div className="card flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messagesWithHeaders.map((item, index) => {
            if ("type" in item && item.type === "date") {
              return (
                <div
                  key={`date-${item.date}`}
                  className="flex justify-center py-2"
                >
                  <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                    {formatDateHeader(item.date)}
                  </span>
                </div>
              );
            }

            const msg = item as Message;
            const isMine = msg.sender_id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                    isMine
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md"
                  }`}
                >
                  <p className="text-sm break-words">{msg.body}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isMine ? "text-indigo-200" : "text-gray-400"
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="input-field flex-1"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="btn-primary px-4"
        >
          {sending ? (
            <svg
              className="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
