"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type SlimBuilder = {
  id: string;
  username: string | null;
  name: string | null;
};

const SPRINT_TYPES = [
  { value: "validation", label: "Validation Sprint" },
  { value: "mvp_scope", label: "MVP Scope Sprint" },
  { value: "build", label: "Build Sprint" },
  { value: "gtm", label: "GTM Sprint" },
  { value: "cofounder_fit", label: "Cofounder Fit Sprint" },
];

const DURATION_OPTIONS = [
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
];

const COMMITMENT_OPTIONS = ["1–2 hrs/week", "3–5 hrs/week", "5–10 hrs/week", "Flexible"];

type SprintForm = {
  sprint_type: string;
  title: string;
  goal: string;
  duration_days: number;
  expected_commitment: string;
  deliverables: string;
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
    title: `Validation Sprint with ${builderName}`,
    goal: "",
    duration_days: 7,
    expected_commitment: "3–5 hrs/week",
    deliverables: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function handleTypeChange(type: string) {
    const label = SPRINT_TYPES.find((t) => t.value === type)?.label ?? type;
    setForm((f) => ({ ...f, sprint_type: type, title: `${label} with ${builderName}` }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: insertError } = await supabase.from("sprints").insert({
      proposer_id: currentUserId,
      recipient_id: builder.id,
      title: form.title.trim(),
      sprint_type: form.sprint_type,
      goal: form.goal.trim(),
      duration_days: form.duration_days,
      expected_commitment: form.expected_commitment || null,
      deliverables: form.deliverables
        ? form.deliverables.split("\n").map((s) => s.trim()).filter(Boolean)
        : null,
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
              <div>
                <label className="label">Sprint Type</label>
                <div className="sprint-option-grid">
                  {SPRINT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTypeChange(t.value)}
                      className={`sprint-option-chip ${form.sprint_type === t.value ? "sprint-option-chip-selected" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Sprint Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label className="label">Goal</label>
                <textarea
                  value={form.goal}
                  onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="What should you both accomplish by the end of this sprint?"
                  required
                />
              </div>

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

              <div>
                <label className="label">Expected Commitment</label>
                <div className="sprint-option-grid">
                  {COMMITMENT_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, expected_commitment: c }))}
                      className={`sprint-option-chip ${form.expected_commitment === c ? "sprint-option-chip-selected" : ""}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">
                  Deliverables{" "}
                  <span className="text-slate-500 font-normal">(optional — one per line)</span>
                </label>
                <textarea
                  value={form.deliverables}
                  onChange={(e) => setForm((f) => ({ ...f, deliverables: e.target.value }))}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="e.g. MVP feature list&#10;5 customer interviews&#10;Landing page draft"
                />
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
                  {submitting ? "Sending..." : "Send Sprint Proposal"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
