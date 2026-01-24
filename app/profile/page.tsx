"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Profile = {
  username: string | null;
  school: string | null;
  major: string | null;
  bio: string | null;
  reputation: number;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [reputation, setReputation] = useState(0);

  useEffect(() => {
    async function loadProfile() {
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

      const { data: profile } = await supabase
        .from("users")
        .select("username, school, major, bio, reputation")
        .eq("id", currentUser.id)
        .single();

      if (profile) {
        setUsername(profile.username ?? "");
        setSchool(profile.school ?? "");
        setMajor(profile.major ?? "");
        setBio(profile.bio ?? "");
        setReputation(profile.reputation ?? 0);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");
    setError("");

    const { error: updateError } = await supabase
      .from("users")
      .update({
        username: username.trim() || null,
        school: school.trim() || null,
        major: major.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      if (updateError.message.includes("unique")) {
        setError("Username is already taken. Please choose another.");
      } else {
        setError(updateError.message);
      }
    } else {
      setMessage("Profile saved successfully!");
    }
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
          Sign in to edit your profile
        </h2>
        <p className="text-gray-500 mb-6">
          Customize your profile and connect with other members.
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
        <div className="card p-6 space-y-4">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="section-header">Your Profile</h1>

      {/* Reputation display */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Reputation</div>
          <div className="text-2xl font-bold text-indigo-600">{reputation}</div>
        </div>
        <Link
          href="/reputation"
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          View history →
        </Link>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
            placeholder="your_username"
          />
          <p className="helper-text">
            Unique handle for your profile. Letters, numbers, underscores only.
          </p>
        </div>

        <div>
          <label htmlFor="school" className="label">
            School
          </label>
          <input
            type="text"
            id="school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="input-field"
            placeholder="e.g., Stanford University"
          />
        </div>

        <div>
          <label htmlFor="major" className="label">
            Major
          </label>
          <input
            type="text"
            id="major"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="input-field"
            placeholder="e.g., Computer Science"
          />
        </div>

        <div>
          <label htmlFor="bio" className="label">
            Bio
          </label>
          <textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="input-field resize-none"
            placeholder="Tell others about yourself..."
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg border border-emerald-100">
            {message}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
