import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PresenceBar } from "./PresenceBar";

const meta: Meta<typeof PresenceBar> = {
  title: "Shared/PresenceBar",
  component: PresenceBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: {
      navigation: {
        pathname: "/program-123/overview",
        params: { programId: "program-123" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PresenceBar>;

export const Default: Story = {};

export const OnRequirementsPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/program-123/requirements",
        params: { programId: "program-123" },
      },
    },
  },
};

export const OnSkillsPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/program-123/skills",
        params: { programId: "program-123" },
      },
    },
  },
};

export const NoProgramId: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/dashboard",
        params: {},
      },
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    nextjs: {
      navigation: {
        pathname: "/program-123/overview",
        params: { programId: "program-123" },
      },
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
    nextjs: {
      navigation: {
        pathname: "/program-123/overview",
        params: { programId: "program-123" },
      },
    },
  },
};
