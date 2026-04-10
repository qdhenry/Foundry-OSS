import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MissionControlPage from "./page";

const meta = {
  title: "Pages/Program/Dashboard",
  component: MissionControlPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MissionControlPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "workstreams:listByProgram": [],
      "requirements:countByStatus": { open: 0, in_progress: 0, complete: 0, blocked: 0, total: 0 },
      "requirements:countByPriority": {
        must_have: 0,
        should_have: 0,
        nice_to_have: 0,
        deferred: 0,
      },
      "skills:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile" } },
};
