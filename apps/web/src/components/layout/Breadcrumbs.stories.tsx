import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Breadcrumbs } from "./Breadcrumbs";

const meta = {
  title: "Layout/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    // next/navigation is auto-mocked by @storybook/nextjs-vite via the
    // nextjs.navigation parameter. Override per-story to simulate different
    // route depths.
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Root — no path segments, shows home icon + "Dashboard"
export const Root: Story = {
  name: "Root (Home)",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/" },
    },
  },
};

// Single segment
export const Programs: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/programs" },
    },
  },
};

// Two segments — program context
export const ProgramDiscovery: Story = {
  name: "Program / Discovery",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
      },
    },
  },
};

// Three segments — program / section / sub-section
export const ProgramRequirements: Story = {
  name: "Program / Requirements",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/requirements",
      },
    },
  },
};

export const MissionControl: Story = {
  name: "Mission Control",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/mission-control",
      },
    },
  },
};

export const DeepRoute: Story = {
  name: "Deep Route (Skills > Detail)",
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/skills/skill-abc123",
      },
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/discovery",
      },
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/risks",
      },
    },
  },
};
