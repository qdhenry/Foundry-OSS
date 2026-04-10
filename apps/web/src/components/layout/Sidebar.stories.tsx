import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sidebar } from "./Sidebar";

// Sidebar uses:
//  - usePathname / useSearchParams (next/navigation — auto-mocked by nextjs-vite)
//  - useQuery(api.discoveryFindings.countPending) — globally mocked via convex mock

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    // Use fullscreen so the sidebar fills a natural column without extra padding
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// No active program — shows disabled nav items for program-scoped sections
export const NoProgram: Story = {
  name: "No Active Program",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/programs",
      },
    },
  },
};

// Active program — Discovery highlighted
export const ActiveDiscovery: Story = {
  name: "Active: Discovery",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Active program — Mission Control highlighted
export const ActiveMissionControl: Story = {
  name: "Active: Mission Control",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/mission-control",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Active program — Skills highlighted
export const ActiveSkills: Story = {
  name: "Active: Skills",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/skills",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Active program — Risks highlighted
export const ActiveRisks: Story = {
  name: "Active: Risks",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/risks",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Active program — Activity / Agent Log highlighted
export const ActiveAgentLog: Story = {
  name: "Active: Agent Log",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/activity",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Programs list route — no program context
export const ProgramsList: Story = {
  name: "Programs List Route",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/programs",
      },
    },
  },
};

// Documents sub-section (query param matching)
export const ActiveDocuments: Story = {
  name: "Active: Documents (query param)",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        search: "?section=documents",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Responsive — Mobile viewport (sidebar is fixed width, may scroll out of view)
export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};

// Responsive — Tablet viewport
export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/workstreams",
        params: { programId: "prog-acme-demo" },
      },
    },
  },
};
