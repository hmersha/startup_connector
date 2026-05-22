export type ArtifactField = {
  key: string;
  label: string;
  placeholder: string;
  rows: number;
};

export type ArtifactTemplate = {
  sprintType: string;
  title: string;
  fields: ArtifactField[];
};

const ARTIFACT_TEMPLATES: Record<string, ArtifactTemplate> = {
  validation: {
    sprintType: "validation",
    title: "Feedback Artifact",
    fields: [
      {
        key: "review_target",
        label: "What we reviewed",
        placeholder: "Link, description, or summary of what was shared for feedback…",
        rows: 2,
      },
      {
        key: "what_is_promising",
        label: "What is promising",
        placeholder: "The strongest parts, what resonates, what to keep building on…",
        rows: 3,
      },
      {
        key: "what_is_unclear",
        label: "What is unclear",
        placeholder: "Confusing parts, missing context, assumptions that need validation…",
        rows: 3,
      },
      {
        key: "risks_or_concerns",
        label: "Risks or concerns",
        placeholder: "What could go wrong, what to watch out for…",
        rows: 2,
      },
      {
        key: "suggested_next_step",
        label: "Suggested next step",
        placeholder: "One concrete thing to do based on this feedback…",
        rows: 2,
      },
    ],
  },

  mvp_scope: {
    sprintType: "mvp_scope",
    title: "MVP Scope Artifact",
    fields: [
      {
        key: "target_user",
        label: "Target user",
        placeholder: "Who is this for? Be specific…",
        rows: 2,
      },
      {
        key: "problem",
        label: "Problem",
        placeholder: "What problem are they facing?",
        rows: 2,
      },
      {
        key: "current_workaround",
        label: "How they solve it today",
        placeholder: "What do they currently do instead?",
        rows: 2,
      },
      {
        key: "smallest_useful_version",
        label: "Smallest useful version",
        placeholder: "What does v1 do and nothing else?",
        rows: 2,
      },
      {
        key: "core_features",
        label: "Core features",
        placeholder: "List the features that must be in v1…",
        rows: 3,
      },
      {
        key: "not_included_yet",
        label: "Not included yet",
        placeholder: "Everything explicitly out of scope for v1…",
        rows: 2,
      },
      {
        key: "biggest_risk",
        label: "Biggest risk",
        placeholder: "What is the most likely reason this fails?",
        rows: 2,
      },
      {
        key: "next_build_step",
        label: "Next build step",
        placeholder: "What happens immediately after this sprint?",
        rows: 2,
      },
    ],
  },

  build: {
    sprintType: "build",
    title: "Build / Validation Artifact",
    fields: [
      {
        key: "hypothesis",
        label: "Hypothesis",
        placeholder: "What do you believe to be true that this sprint will test?",
        rows: 2,
      },
      {
        key: "smallest_test",
        label: "Smallest test",
        placeholder: "The minimum thing needed to test the hypothesis…",
        rows: 2,
      },
      {
        key: "build_or_test_plan",
        label: "Build / test plan",
        placeholder: "What will each person do? What is the scope?",
        rows: 3,
      },
      {
        key: "external_links",
        label: "Links",
        placeholder: "Repo, prototype, doc, Figma, landing page — anything relevant…",
        rows: 2,
      },
      {
        key: "evidence_collected",
        label: "Evidence collected",
        placeholder: "What did you build, test, or learn? Include numbers if possible…",
        rows: 3,
      },
      {
        key: "result",
        label: "Result",
        placeholder: "Did the hypothesis hold? What did you actually find?",
        rows: 2,
      },
      {
        key: "next_step",
        label: "Next step",
        placeholder: "Based on the result, what should happen next?",
        rows: 2,
      },
    ],
  },
};

export function getArtifactTemplate(sprintType: string): ArtifactTemplate | null {
  return ARTIFACT_TEMPLATES[sprintType] ?? null;
}
