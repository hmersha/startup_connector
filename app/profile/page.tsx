"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import AppShell from "@/components/AppShell";

// === CONSTANTS ===

const CATEGORY_OPTIONS = [
  "fintech",
  "healthtech",
  "edtech",
  "ai/ml",
  "saas",
  "marketplace",
  "consumer",
  "b2b",
  "climate",
  "social",
  "gaming",
  "hardware",
  "crypto",
  "other",
];

const STAGE_OPTIONS = [
  { value: "idea", label: "Idea", desc: "Exploring concepts" },
  { value: "prototype", label: "Prototype", desc: "Building MVP" },
  { value: "users", label: "Users", desc: "Have early users" },
  { value: "revenue", label: "Revenue", desc: "Generating revenue" },
];

const LOOKING_FOR_OPTIONS = [
  "cofounder",
  "developer",
  "designer",
  "marketer",
  "advisor",
  "investor",
  "feedback",
  "users",
];

const SKILL_OPTIONS = [
  "frontend",
  "backend",
  "fullstack",
  "mobile",
  "design",
  "ui/ux",
  "product",
  "marketing",
  "sales",
  "growth",
  "data",
  "devops",
  "leadership",
  "fundraising",
  "strategy",
];

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", desc: "Visible to all members" },
  { value: "match_only", label: "Match Only", desc: "Only shown in Discover, hidden from Members" },
  { value: "private", label: "Private", desc: "Only connected users see details" },
];

// === BUILDER CARD COMPLETION METER ===

function BuilderCardCompletionMeter({
  oneLiner,
  categories,
  stage,
  lookingFor,
  skills,
}: {
  oneLiner: string;
  categories: string[];
  stage: string;
  lookingFor: string[];
  skills: string[];
}) {
  const fields = [
    { name: "One-liner", filled: oneLiner.trim().length > 0 },
    { name: "Categories", filled: categories.length > 0 },
    { name: "Stage", filled: stage.length > 0 },
    { name: "Looking for", filled: lookingFor.length > 0 },
    { name: "Skills", filled: skills.length > 0 },
  ];

  const filledCount = fields.filter((f) => f.filled).length;
  const percentage = Math.round((filledCount / fields.length) * 100);
  const isComplete = filledCount === fields.length;

  return (
    <div className="completion-meter">
      <div className="completion-meter-header">
        <span className="completion-meter-label">
          {isComplete ? "Builder Card Complete" : "Builder Card Progress"}
        </span>
        <span className={`completion-meter-percent ${isComplete ? "text-emerald-400" : ""}`}>
          {percentage}%
        </span>
      </div>
      <div className="completion-meter-bar">
        <div
          className={`completion-meter-fill ${isComplete ? "completion-meter-fill-complete" : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {!isComplete && (
        <div className="completion-meter-fields">
          {fields.map((field) => (
            <span
              key={field.name}
              className={`completion-field ${field.filled ? "completion-field-filled" : ""}`}
            >
              {field.filled && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {field.name}
            </span>
          ))}
        </div>
      )}
      {isComplete && (
        <p className="completion-meter-success">
          You're all set to be discovered by other builders.
        </p>
      )}
    </div>
  );
}

// === MULTI-SELECT CHIP COMPONENT ===

function ChipSelect({
  label,
  options,
  selected,
  onChange,
  maxSelected = 5,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelected?: number;
}) {
  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else if (selected.length < maxSelected) {
      onChange([...selected, option]);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="chip-grid">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`chip-option ${isSelected ? "chip-option-selected" : ""}`}
            >
              {option}
              {isSelected && (
                <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <p className="helper-text">
        Select up to {maxSelected} ({selected.length}/{maxSelected})
      </p>
    </div>
  );
}

// === MAIN COMPONENT ===

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "builder" ? "builder" : "profile";

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "builder">(initialTab);

  // Profile fields
  const [username, setUsername] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [reputation, setReputation] = useState(0);

  // Builder Card fields
  const [oneLiner, setOneLiner] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [stage, setStage] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [builderCardUpdatedAt, setBuilderCardUpdatedAt] = useState<string | null>(null);

  // AI one-liner improvement state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOptions, setAiOptions] = useState<Array<{ style: string; text: string }>>([]);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: authData, error: authError } = await supabase.auth.getUser();

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
        .select(
          "username, school, major, bio, reputation, one_liner, categories, stage, looking_for, skills, availability, visibility, builder_card_updated_at"
        )
        .eq("id", currentUser.id)
        .single();

      if (profile) {
        // Profile fields
        setUsername(profile.username ?? "");
        setSchool(profile.school ?? "");
        setMajor(profile.major ?? "");
        setBio(profile.bio ?? "");
        setReputation(profile.reputation ?? 0);

        // Builder Card fields
        setOneLiner(profile.one_liner ?? "");
        setCategories(profile.categories ?? []);
        setStage(profile.stage ?? "");
        setLookingFor(profile.looking_for ?? []);
        setSkills(profile.skills ?? []);
        setAvailability(profile.availability ?? "");
        setVisibility(profile.visibility ?? "public");
        setBuilderCardUpdatedAt(profile.builder_card_updated_at ?? null);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  // Clear messages when switching tabs
  useEffect(() => {
    setMessage("");
    setError("");
  }, [activeTab]);

  async function handleSaveProfile(e: React.FormEvent) {
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

  async function handleSaveBuilderCard(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage("");
    setError("");

    const { error: updateError } = await supabase
      .from("users")
      .update({
        one_liner: oneLiner.trim() || null,
        categories: categories,
        stage: stage || null,
        looking_for: lookingFor,
        skills: skills,
        availability: availability.trim() || null,
        visibility: visibility,
        builder_card_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Builder Card saved successfully!");
      setBuilderCardUpdatedAt(new Date().toISOString());
    }
  }

  async function handleImproveOneLiner() {
    if (!user) return;

    setAiLoading(true);
    setAiError("");
    setAiOptions([]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setAiError("Not authenticated. Please log in again.");
        setAiLoading(false);
        return;
      }

      const response = await fetch("/api/ai/improve-one-liner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          builderCard: {
            one_liner: oneLiner,
            categories,
            stage,
            looking_for: lookingFor,
            skills,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAiError(data.error || "Failed to generate suggestions.");
      } else {
        setAiOptions(data.options || []);
      }
    } catch {
      setAiError("Network error. Please try again.");
    }

    setAiLoading(false);
  }

  // === NOT LOGGED IN ===
  if (authChecked && !user) {
    return (
      <AppShell title="Profile">
        <div className="max-w-md mx-auto">
          <div className="card p-8 text-center">
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
              Sign in to edit your profile
            </h2>
            <p className="text-slate-400 mb-6">
              Customize your profile and connect with other members.
            </p>
            <Link href="/login" className="btn-primary inline-block">
              Log In
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // === LOADING ===
  if (loading) {
    return (
      <AppShell title="Your Profile">
        <div className="max-w-2xl space-y-6">
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="card p-6 space-y-4">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  // === MAIN RENDER ===
  return (
    <AppShell title="Your Profile">
      <div className="max-w-2xl space-y-6">

      {/* Reputation display */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">Reputation</div>
          <div className="text-2xl font-bold text-indigo-400">{reputation}</div>
        </div>
        <Link
          href="/reputation"
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          View history →
        </Link>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          onClick={() => setActiveTab("profile")}
          className={`profile-tab ${activeTab === "profile" ? "profile-tab-active" : ""}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          Profile
        </button>
        <button
          onClick={() => setActiveTab("builder")}
          className={`profile-tab ${activeTab === "builder" ? "profile-tab-active" : ""}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Builder Card
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="card p-6 space-y-5">
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
            <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-500/20 text-emerald-300 text-sm px-4 py-3 rounded-lg border border-emerald-500/30">
              {message}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      )}

      {/* Builder Card Tab */}
      {activeTab === "builder" && (
        <form onSubmit={handleSaveBuilderCard} className="card p-6 space-y-6">
          {/* Completion Meter */}
          <BuilderCardCompletionMeter
            oneLiner={oneLiner}
            categories={categories}
            stage={stage}
            lookingFor={lookingFor}
            skills={skills}
          />

          {/* Info banner */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm text-indigo-200">
                  Your Builder Card helps others discover you on the{" "}
                  <Link href="/discover" className="underline hover:text-indigo-100">
                    Discover
                  </Link>{" "}
                  page. Complete it to get better matches.
                </p>
                {builderCardUpdatedAt && (
                  <p className="text-xs text-indigo-400/60 mt-1">
                    Last updated:{" "}
                    {new Date(builderCardUpdatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* One-liner */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="oneLiner" className="label mb-0">
                One-liner
              </label>
              <button
                type="button"
                onClick={handleImproveOneLiner}
                disabled={aiLoading}
                className="ai-improve-btn"
              >
                {aiLoading ? (
                  <span className="ai-spinner" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {aiLoading ? "Generating..." : "Improve with AI"}
              </button>
            </div>
            <input
              type="text"
              id="oneLiner"
              value={oneLiner}
              onChange={(e) => {
                setOneLiner(e.target.value.slice(0, 140));
                setAiOptions([]); // Clear suggestions when user types
                setAiError("");
              }}
              className="input-field"
              placeholder="e.g., Building AI tools for students"
              maxLength={140}
            />
            <p className="helper-text">
              A short pitch about what you're working on ({oneLiner.length}/140)
            </p>

            {/* AI Error */}
            {aiError && (
              <div className="ai-error mt-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {aiError}
              </div>
            )}

            {/* AI Suggestions */}
            {aiOptions.length > 0 && (
              <div className="ai-suggestions mt-3">
                <div className="ai-suggestions-header">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>AI suggestions</span>
                  <button
                    type="button"
                    onClick={() => setAiOptions([])}
                    className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="ai-suggestion-list">
                  {aiOptions.map((option, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setOneLiner(option.text);
                        setAiOptions([]);
                      }}
                      className="ai-suggestion-option"
                    >
                      <span className="ai-suggestion-style">{option.style}</span>
                      <span className="ai-suggestion-text">{option.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Categories */}
          <ChipSelect
            label="Categories"
            options={CATEGORY_OPTIONS}
            selected={categories}
            onChange={setCategories}
            maxSelected={5}
          />

          {/* Stage */}
          <div>
            <label className="label">Stage</label>
            <div className="grid grid-cols-2 gap-3">
              {STAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStage(option.value)}
                  className={`stage-option ${stage === option.value ? "stage-option-selected" : ""}`}
                >
                  <span className="stage-option-label">{option.label}</span>
                  <span className="stage-option-desc">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Looking for */}
          <ChipSelect
            label="Looking for"
            options={LOOKING_FOR_OPTIONS}
            selected={lookingFor}
            onChange={setLookingFor}
            maxSelected={4}
          />

          {/* Skills */}
          <ChipSelect
            label="Your skills"
            options={SKILL_OPTIONS}
            selected={skills}
            onChange={setSkills}
            maxSelected={6}
          />

          {/* Availability */}
          <div>
            <label htmlFor="availability" className="label">
              Availability
            </label>
            <input
              type="text"
              id="availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="input-field"
              placeholder="e.g., Weekends, 10 hrs/week"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="label">Profile Visibility</label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`visibility-option ${visibility === option.value ? "visibility-option-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={visibility === option.value}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="sr-only"
                  />
                  <div className="visibility-radio">
                    {visibility === option.value && (
                      <div className="visibility-radio-dot" />
                    )}
                  </div>
                  <div>
                    <span className="visibility-label">{option.label}</span>
                    <span className="visibility-desc">{option.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-500/20 text-emerald-300 text-sm px-4 py-3 rounded-lg border border-emerald-500/30">
              {message}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : "Save Builder Card"}
          </button>
        </form>
      )}
      </div>
    </AppShell>
  );
}

// Wrap in Suspense boundary for useSearchParams
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <AppShell title="Your Profile">
        <div className="max-w-2xl space-y-6">
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="card p-6 space-y-4">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        </div>
      </AppShell>
    }>
      <ProfileContent />
    </Suspense>
  );
}
