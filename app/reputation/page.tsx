"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type ReputationEvent = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  post_created: "Created a post",
  comment_created: "Left a comment",
  admin_adjustment: "Admin adjustment",
};

const PROJECT_THRESHOLD = 70;

export default function ReputationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reputation, setReputation] = useState<number>(0);
  const [events, setEvents] = useState<ReputationEvent[]>([]);

  useEffect(() => {
    async function loadData() {
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

      const [userResult, eventsResult] = await Promise.all([
        supabase
          .from("users")
          .select("reputation")
          .eq("id", currentUser.id)
          .single(),
        supabase
          .from("reputation_events")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false }),
      ]);

      if (userResult.data) {
        setReputation(userResult.data.reputation);
      }

      if (eventsResult.data) {
        setEvents(eventsResult.data);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // Compute totals from events
  const totalGained = events
    .filter((e) => e.delta > 0)
    .reduce((sum, e) => sum + e.delta, 0);
  const totalLost = events
    .filter((e) => e.delta < 0)
    .reduce((sum, e) => sum + Math.abs(e.delta), 0);
  const netChange = totalGained - totalLost;

  const pointsNeeded = Math.max(0, PROJECT_THRESHOLD - reputation);
  const progressPercent = Math.min(100, (reputation / PROJECT_THRESHOLD) * 100);

  // Format date helper
  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Not logged in state
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
          Sign in to view your reputation
        </h2>
        <p className="text-gray-500 mb-6">
          Track your community standing and unlock new features.
        </p>
        <Link href="/login" className="btn-primary inline-block">
          Log In
        </Link>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="card p-8">
          <div className="skeleton h-16 w-24 mx-auto mb-4" />
          <div className="skeleton h-4 w-64 mx-auto" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="skeleton h-6 w-12 mx-auto mb-2" />
            <div className="skeleton h-4 w-20 mx-auto" />
          </div>
          <div className="card p-4">
            <div className="skeleton h-6 w-12 mx-auto mb-2" />
            <div className="skeleton h-4 w-20 mx-auto" />
          </div>
          <div className="card p-4">
            <div className="skeleton h-6 w-12 mx-auto mb-2" />
            <div className="skeleton h-4 w-20 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="section-header">Your Reputation</h1>

      {/* Big reputation number */}
      <div className="card p-8 text-center">
        <div className="text-6xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent mb-2">
          {reputation}
        </div>
        <p className="text-gray-500">
          {reputation >= PROJECT_THRESHOLD ? (
            <span className="text-emerald-600 font-medium">
              You can create projects!
            </span>
          ) : (
            <>
              Reach {PROJECT_THRESHOLD} reputation to create projects{" "}
              <span className="font-medium text-indigo-600">
                ({pointsNeeded} more needed)
              </span>
            </>
          )}
        </p>

        {/* Progress bar */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>0</span>
            <span>{PROJECT_THRESHOLD}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-600">
            +{totalGained}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total gained</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-semibold text-red-500">
            -{totalLost}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total lost</div>
        </div>
        <div className="card p-4 text-center">
          <div
            className={`text-2xl font-semibold ${
              netChange >= 0 ? "text-indigo-600" : "text-red-500"
            }`}
          >
            {netChange >= 0 ? "+" : ""}
            {netChange}
          </div>
          <div className="text-xs text-gray-500 mt-1">Net change</div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Reputation History</h2>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center">
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-gray-500">No reputation changes yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {events.map((event) => (
              <li
                key={event.id}
                className="px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {REASON_LABELS[event.reason] || event.reason}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(event.created_at)}
                  </div>
                </div>
                <div
                  className={`text-sm font-semibold ${
                    event.delta >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {event.delta >= 0 ? "+" : ""}
                  {event.delta}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
