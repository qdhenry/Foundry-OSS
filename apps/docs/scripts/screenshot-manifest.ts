export interface ScreenshotEntry {
  slug: string;
  url: string;
  section: string;
  viewport: { width: number; height: number };
  auth: boolean;
  waitFor?: string;
  description: string;
}

const defaultViewport = { width: 1440, height: 900 };

export const screenshots: ScreenshotEntry[] = [
  // --- getting-started ---
  {
    slug: "sign-in",
    url: "/sign-in",
    section: "getting-started",
    viewport: defaultViewport,
    auth: false,
    description: "Clerk sign-in page",
  },
  {
    slug: "programs-list",
    url: "/programs",
    section: "getting-started",
    viewport: defaultViewport,
    auth: true,
    description: "Programs listing page",
  },
  {
    slug: "program-detail",
    url: "/[programId]",
    section: "getting-started",
    viewport: defaultViewport,
    auth: true,
    description: "Single program detail view",
  },

  // --- features ---
  {
    slug: "dashboard",
    url: "/[programId]",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Program dashboard overview",
  },
  {
    slug: "workstreams",
    url: "/[programId]/workstreams",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Workstreams management page",
  },
  {
    slug: "tasks",
    url: "/[programId]/tasks",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Task board view",
  },
  {
    slug: "discovery",
    url: "/[programId]/discovery",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Discovery findings page",
  },
  {
    slug: "skills",
    url: "/[programId]/skills",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Skills library page",
  },
  {
    slug: "risks",
    url: "/[programId]/risks",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Risk register page",
  },
  {
    slug: "sandbox-hud",
    url: "/[programId]/tasks",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    waitFor: '[data-testid="sandbox-hud"]',
    description: "Sandbox HUD overlay on task board",
  },
  {
    slug: "pipeline-lab",
    url: "/[programId]/pipeline-lab",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Pipeline lab experimentation page",
  },
  {
    slug: "mission-control",
    url: "/[programId]/mission-control",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Mission control dashboard",
  },
  {
    slug: "sprints",
    url: "/[programId]/sprints",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Sprint planning page",
  },
  {
    slug: "gates",
    url: "/[programId]/gates",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Quality gates page",
  },
  {
    slug: "audit",
    url: "/[programId]/audit",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Audit trail page",
  },
  {
    slug: "settings",
    url: "/[programId]/settings",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Program settings page",
  },
  {
    slug: "agents",
    url: "/[programId]/agents",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Agent management page",
  },
  {
    slug: "documents",
    url: "/[programId]/documents",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Document management page",
  },
  {
    slug: "videos",
    url: "/[programId]/videos",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Video analysis page",
  },
  {
    slug: "integrations",
    url: "/[programId]/integrations",
    section: "features",
    viewport: defaultViewport,
    auth: true,
    description: "Integrations configuration page",
  },

  // --- billing ---
  {
    slug: "billing",
    url: "/billing",
    section: "billing",
    viewport: defaultViewport,
    auth: true,
    description: "Billing management page",
  },
  {
    slug: "pricing",
    url: "/pricing",
    section: "billing",
    viewport: defaultViewport,
    auth: true,
    description: "Pricing plans page",
  },
];
