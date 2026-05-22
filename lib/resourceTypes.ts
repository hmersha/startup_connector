export type SprintResource = {
  id: string;
  sprint_id: string;
  added_by: string;
  resource_type: string;
  title: string;
  url: string;
  description: string | null;
  step_key: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceTypeConfig = {
  key: string;
  label: string;
  urlPlaceholder: string;
};

export const RESOURCE_TYPES: ResourceTypeConfig[] = [
  { key: "github_repo",     label: "GitHub Repo",    urlPlaceholder: "https://github.com/user/repo" },
  { key: "github_pr",       label: "GitHub PR",      urlPlaceholder: "https://github.com/user/repo/pull/1" },
  { key: "vercel_preview",  label: "Vercel Preview", urlPlaceholder: "https://your-app.vercel.app" },
  { key: "replit",          label: "Replit",         urlPlaceholder: "https://replit.com/@user/project" },
  { key: "figma",           label: "Figma",          urlPlaceholder: "https://figma.com/file/..." },
  { key: "google_doc",      label: "Google Doc",     urlPlaceholder: "https://docs.google.com/document/d/..." },
  { key: "google_sheet",    label: "Google Sheet",   urlPlaceholder: "https://docs.google.com/spreadsheets/d/..." },
  { key: "notion",          label: "Notion",         urlPlaceholder: "https://notion.so/..." },
  { key: "loom",            label: "Loom",           urlPlaceholder: "https://loom.com/share/..." },
  { key: "landing_page",    label: "Landing Page",   urlPlaceholder: "https://..." },
  { key: "prototype",       label: "Prototype",      urlPlaceholder: "https://..." },
  { key: "survey",          label: "Survey",         urlPlaceholder: "https://..." },
  { key: "customer_notes",  label: "Customer Notes", urlPlaceholder: "https://..." },
  { key: "other",           label: "Other",          urlPlaceholder: "https://..." },
];

export const STEP_LABELS: Record<string, string> = {
  align: "Align",
  work: "Work",
  decide: "Decide",
};

export type SuggestionConfig = {
  type: string;
  label: string;
};

export const SUGGESTIONS_BY_SPRINT_TYPE: Record<string, SuggestionConfig[]> = {
  validation: [
    { type: "other",        label: "Thing to review" },
    { type: "landing_page", label: "Landing page" },
    { type: "prototype",    label: "Prototype" },
    { type: "loom",         label: "Loom demo" },
    { type: "google_doc",   label: "Google Doc" },
  ],
  mvp_scope: [
    { type: "customer_notes", label: "Customer notes" },
    { type: "google_doc",     label: "Google Doc" },
    { type: "figma",          label: "Figma sketch" },
    { type: "notion",         label: "Notion page" },
    { type: "google_sheet",   label: "Research sheet" },
  ],
  build: [
    { type: "github_repo",    label: "GitHub repo" },
    { type: "vercel_preview", label: "Vercel preview" },
    { type: "replit",         label: "Replit project" },
    { type: "survey",         label: "Survey" },
    { type: "customer_notes", label: "Validation notes" },
  ],
};

export function getResourceTypeLabel(key: string): string {
  return RESOURCE_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function getResourceUrlPlaceholder(key: string): string {
  return RESOURCE_TYPES.find((t) => t.key === key)?.urlPlaceholder ?? "https://...";
}

export function getResourceIconPath(type: string): string {
  switch (type) {
    case "github_repo":
    case "github_pr":
    case "replit":
      // code brackets
      return "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4";
    case "vercel_preview":
      // cloud upload
      return "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12";
    case "figma":
      // layers / stack
      return "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10";
    case "google_doc":
    case "notion":
      // document text
      return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
    case "google_sheet":
      // view-grid (2x2)
      return "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z";
    case "loom":
      // video camera
      return "M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z";
    case "landing_page":
    case "prototype":
      // globe
      return "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9";
    case "survey":
      // clipboard-check
      return "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4";
    case "customer_notes":
      // user
      return "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z";
    default:
      // link
      return "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1";
  }
}

export function getResourceIconColor(type: string): { text: string; bg: string } {
  switch (type) {
    case "github_repo":
    case "github_pr":
    case "replit":
    case "vercel_preview":
      return { text: "text-indigo-400", bg: "bg-indigo-500/10" };
    case "figma":
      return { text: "text-purple-400", bg: "bg-purple-500/10" };
    case "google_doc":
    case "notion":
      return { text: "text-blue-400", bg: "bg-blue-500/10" };
    case "google_sheet":
      return { text: "text-emerald-400", bg: "bg-emerald-500/10" };
    case "loom":
      return { text: "text-red-400", bg: "bg-red-500/10" };
    case "landing_page":
    case "prototype":
      return { text: "text-cyan-400", bg: "bg-cyan-500/10" };
    case "survey":
      return { text: "text-amber-400", bg: "bg-amber-500/10" };
    case "customer_notes":
      return { text: "text-teal-400", bg: "bg-teal-500/10" };
    default:
      return { text: "text-slate-400", bg: "bg-slate-700/50" };
  }
}
