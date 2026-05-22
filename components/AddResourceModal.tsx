"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  type SprintResource,
  RESOURCE_TYPES,
  STEP_LABELS,
  getResourceUrlPlaceholder,
} from "@/lib/resourceTypes";

type ResourceForm = {
  resource_type: string;
  title: string;
  url: string;
  description: string;
  step_key: string | null;
  is_primary: boolean;
};

export default function AddResourceModal({
  sprintId,
  currentUserId,
  resource,
  defaultType,
  onClose,
  onSaved,
}: {
  sprintId: string;
  currentUserId: string;
  resource?: SprintResource | null;
  defaultType?: string;
  onClose: () => void;
  onSaved: (resource: SprintResource) => void;
}) {
  const isEditing = !!resource;
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<ResourceForm>({
    resource_type: resource?.resource_type ?? defaultType ?? "other",
    title: resource?.title ?? "",
    url: resource?.url ?? "",
    description: resource?.description ?? "",
    step_key: resource?.step_key ?? null,
    is_primary: resource?.is_primary ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Update URL placeholder hint when type changes
  const urlPlaceholder = getResourceUrlPlaceholder(form.resource_type);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function validate(): string | null {
    if (!form.title.trim()) return "Title is required.";
    if (!form.url.trim()) return "URL is required.";
    if (!form.url.startsWith("http://") && !form.url.startsWith("https://")) {
      return "URL must start with http:// or https://";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError("");

    const payload = {
      resource_type: form.resource_type,
      title: form.title.trim(),
      url: form.url.trim(),
      description: form.description.trim() || null,
      step_key: form.step_key,
      is_primary: form.is_primary,
    };

    if (isEditing && resource) {
      const { data, error: updateError } = await supabase
        .from("sprint_resources")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", resource.id)
        .select("*")
        .single();
      if (updateError) { setError(updateError.message); setSubmitting(false); return; }
      if (data) onSaved(data as SprintResource);
    } else {
      const { data, error: insertError } = await supabase
        .from("sprint_resources")
        .insert({ sprint_id: sprintId, added_by: currentUserId, ...payload })
        .select("*")
        .single();
      if (insertError) { setError(insertError.message); setSubmitting(false); return; }
      if (data) onSaved(data as SprintResource);
    }

    setSubmitting(false);
    onClose();
  }

  return (
    <div className="sprint-modal-overlay" onClick={onClose}>
      <div className="sprint-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sprint-modal-header">
          <div>
            <h2 className="sprint-modal-title">
              {isEditing ? "Edit Resource" : "Add Resource"}
            </h2>
            <p className="sprint-modal-subtitle">
              {isEditing ? "Update this resource." : "Add a link the team needs for this sprint."}
            </p>
          </div>
          <button onClick={onClose} className="sprint-modal-close" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sprint-modal-body">

          {/* Resource type grid */}
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-44 overflow-y-auto pr-0.5 scrollbar-hide">
              {RESOURCE_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, resource_type: t.key }))}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                    form.resource_type === t.key
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                      : "border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600/70 hover:text-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="e.g. Frontend repo, Landing page v2, Interview notes"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="label">URL</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="input-field font-mono text-sm"
              placeholder={urlPlaceholder}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description{" "}
              <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field resize-none"
              rows={2}
              placeholder="A short note about what this is for…"
            />
          </div>

          {/* Step tag */}
          <div>
            <label className="label">
              Attach to step{" "}
              <span className="text-slate-600 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {([null, "align", "work", "decide"] as const).map((key) => (
                <button
                  type="button"
                  key={key ?? "none"}
                  onClick={() => setForm((f) => ({ ...f, step_key: key }))}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                    form.step_key === key
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                      : "border-slate-700/50 text-slate-500 hover:border-slate-600/70"
                  }`}
                >
                  {key ? STEP_LABELS[key] : "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Primary toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.is_primary}
              onClick={() => setForm((f) => ({ ...f, is_primary: !f.is_primary }))}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                form.is_primary ? "bg-indigo-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  form.is_primary ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            <div>
              <span className="text-sm text-slate-300">Mark as primary resource</span>
              <p className="text-xs text-slate-600">Primary resources appear at the top of the dock.</p>
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
              {submitting ? "Saving…" : isEditing ? "Save Changes" : "Add Resource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
