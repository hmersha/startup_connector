export type StepKey = "align" | "work" | "decide";

export type PlaybookStep = {
  key: StepKey;
  label: string;
  prompts: string[];
};

export type Playbook = {
  key: string;
  title: string;
  shortDescription: string;
  mission: string;
  estimatedEffort: string;
  defaultDuration: number;
  firstMove: string;
  steps: [PlaybookStep, PlaybookStep, PlaybookStep];
};

export const PLAYBOOKS: Record<string, Playbook> = {
  validation: {
    key: "validation",
    title: "Feedback Sprint",
    shortDescription: "Get useful feedback before you build more.",
    mission: "Give useful feedback on an idea, prototype, landing page, or pitch.",
    estimatedEffort: "Light touch (~2 hrs/wk)",
    defaultDuration: 3,
    firstMove:
      "Share the thing you want feedback on and what kind of feedback would be most useful.",
    steps: [
      {
        key: "align",
        label: "Align",
        prompts: [
          "What are you sharing for feedback?",
          "What stage is it in?",
          "What kind of feedback would help most?",
        ],
      },
      {
        key: "work",
        label: "Work",
        prompts: [
          "What is promising?",
          "What is unclear?",
          "What would you test next?",
          "What risk or concern do you see?",
        ],
      },
      {
        key: "decide",
        label: "Decide",
        prompts: [
          "Was this useful?",
          "What changed after the feedback?",
          "Do you want to connect, do another sprint, stay in network, or stop here?",
        ],
      },
    ],
  },

  mvp_scope: {
    key: "mvp_scope",
    title: "MVP Scope Sprint",
    shortDescription: "Turn a rough idea into a clear first version.",
    mission: "Turn a rough idea into a clear first version.",
    estimatedEffort: "Part-time (~5 hrs/wk)",
    defaultDuration: 7,
    firstMove:
      "Share the clearest version of the problem and what you already know.",
    steps: [
      {
        key: "align",
        label: "Align",
        prompts: [
          "Who is the user?",
          "What problem are they facing?",
          "How are they solving it now?",
          "Why does this matter now?",
        ],
      },
      {
        key: "work",
        label: "Work",
        prompts: [
          "What is the smallest useful version?",
          "What should not be included yet?",
          "What is the main user action?",
          "What would prove this is worth building?",
        ],
      },
      {
        key: "decide",
        label: "Decide",
        prompts: [
          "What should the v0 include?",
          "What is the biggest risk?",
          "What is the next build or validation step?",
          "Should you connect or run another sprint?",
        ],
      },
    ],
  },

  build: {
    key: "build",
    title: "Build / Validation Sprint",
    shortDescription:
      "Build or test one small thing to learn whether the idea is worth continuing.",
    mission:
      "Build or test one small thing to learn whether the idea is worth continuing.",
    estimatedEffort: "Dedicated (10+ hrs/wk)",
    defaultDuration: 7,
    firstMove:
      "Pick the smallest thing that can be built or tested in the sprint window.",
    steps: [
      {
        key: "align",
        label: "Align",
        prompts: [
          "What are we trying to learn?",
          "What is the smallest useful test?",
          "What can realistically be done in 48 hours to 1 week?",
        ],
      },
      {
        key: "work",
        label: "Work",
        prompts: [
          "What got built, tested, or shared?",
          "What did each person contribute?",
          "What surprised you?",
          "What evidence did you collect?",
        ],
      },
      {
        key: "decide",
        label: "Decide",
        prompts: [
          "What did you learn?",
          "Is the idea stronger, weaker, or unclear?",
          "What should happen next?",
          "Should you connect, sprint again, or stop?",
        ],
      },
    ],
  },
};

export function getPlaybook(sprintType: string): Playbook | null {
  return PLAYBOOKS[sprintType] ?? null;
}
