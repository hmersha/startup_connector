"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type SlimBuilder = {
  id: string;
  username: string | null;
  name: string | null;
};

const SPRINT_TYPES = [
  {
    value: "validation",
    label: "Idea Sprint",
    description: "Validate whether the problem is worth solving",
  },
  {
    value: "build",
    label: "Build Sprint",
    description: "Ship something specific together",
  },
  {
    value: "cofounder_fit",
    label: "Chemistry Sprint",
    description: "Test working styles before committing",
  },
];

const DURATION_OPTIONS = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
];

const EFFORT_OPTIONS = [
  { value: "Light touch (~2 hrs/wk)", label: "Light touch", sub: "~2 hrs/wk" },
  { value: "Part-time (~5 hrs/wk)", label: "Part-time", sub: "~5 hrs/wk" },
  { value: "Dedicated (10+ hrs/wk)", label: "Dedicated", sub: "10+ hrs/wk" },
];

type SprintForm = {
  sprint_type: string;
  goal: string;
  first_move: string;
  duration_days: number;
  effort: string;
};

export default function ProposeSprintModal({
  builder,
  currentUserId,
  onClose,
}: {
  builder: SlimBuilder;
  currentUserId: string;
  onClose: () => void;
}) {
  const builderName = builder.username || builder.name || "Builder";

  const [form, setForm] = useState<SprintForm>({
    sprint_type: "validation",
    goal: "",
    first_move: "",
    duration_days: 7,
    effort: "Part-time (~5 hrs/wk)",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const sprintTypeLabel =
    SPRINT_TYPES.find((t) => t.value === form.sprint_type)?.label ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const deliverables = form.first_move.trim()
      ? [`First move: ${form.first_move.trim()}`]
      : null;

    const { error: insertError } = await supabase.from("sprints").insert({
      proposer_id: currentUserId,
      recipient_id: builder.id,
      title: `${sprintTypeLabel} with ${builderName}`,
      sprint_type: form.sprint_type,
      goal: form.goal.trim(),
      duration_days: form.duration_days,
      expected_commitment: form.effort,
      deliverables,
      status: "proposed",
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => onClose(), 2000);
    setSubmitting(false);
  }

  return (
    <div className="sprint-modal-overlay" onClick={onClose}>
      <div className="sprint-modal" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="sprint-modal-success">
            <div className="sprint-success-icon">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mt-3">Sprint Proposed!</h3>
            <p className="text-slate-400 text-sm mt-1">
              {builderName} will see your proposal under Sprints.
            </p>
          </div>
        ) : (
          <>
            <div className="sprint-modal-header">
              <div>
                <h2 className="sprint-modal-title">Propose a Sprint</h2>
                <p className="sprint-modal-subtitle">with {builderName}</p>
              </div>
              <button onClick={onClose} className="sprint-modal-close" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="sprint-modal-body">
              {/* Sprint type */}
              <div>
                <label className="label">Sprint Type</label>
                <div className="space-y-2 mt-1">
                  {SPRINT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, sprint_type: t.value }))}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                        form.sprint_type === t.value
                          ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700/50 bg-slate-800/30 text-slate-300 hover:border-slate-600/60"
                      }`}
                    >
                      <span className="font-medium">{t.label}</span>
                      <span className={`ml-2 text-xs ${form.sprint_type === t.value ? "text-indigo-400" : "text-slate-500"}`}>
                        — {t.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal */}
              <div>
                <label className="label">What&apos;s the goal?</label>
                <textarea
                  value={form.goal}
                  onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="What should you both accomplish by the end?"
                  required
                />
              </div>

              {/* First move */}
              <div>
                <label className="label">First concrete step</label>
                <input
                  type="text"
                  value={form.first_move}
                  onChange={(e) => setForm((f) => ({ ...f, first_move: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. 30-min call to map out assumptions"
                  required
                />
              </div>

              {/* Duration */}
              <div>
                <label className="label">Duration</label>
                <div className="sprint-option-grid">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, duration_days: d.days }))}
                      className={`sprint-option-chip ${form.duration_days === d.days ? "sprint-option-chip-selected" : ""}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Effort */}
              <div>
                <label className="label">Effort level</label>
                <div className="sprint-option-grid">
                  {EFFORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, effort: opt.value }))}
                      className={`sprint-option-chip flex-col gap-0 leading-tight ${
                        form.effort === opt.value ? "sprint-option-chip-selected" : ""
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-xs opacity-60">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/20 text-red-300 text-sm px-4 py-3 rounded-lg border border-red-500/30">
                  {error}
                </div>
              )}

              <div className="sprint-modal-actions">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Sending..." : "Send Proposal"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
