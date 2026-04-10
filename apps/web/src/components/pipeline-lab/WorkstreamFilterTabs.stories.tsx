import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { MOCK_WORKSTREAMS } from "./pipeline-mock-data";
import { WorkstreamFilterTabs } from "./WorkstreamFilterTabs";

const meta: Meta<typeof WorkstreamFilterTabs> = {
  title: "PipelineLab/WorkstreamFilterTabs",
  component: WorkstreamFilterTabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof WorkstreamFilterTabs>;

export const Default: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: null,
    onFilterChange: () => {},
  },
};

export const FirstWorkstreamActive: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: "ws-catalog",
    onFilterChange: () => {},
  },
};

export const SecondWorkstreamActive: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: "ws-checkout",
    onFilterChange: () => {},
  },
};

export const ThirdWorkstreamActive: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: "ws-orders",
    onFilterChange: () => {},
  },
};

export const SingleWorkstream: Story = {
  args: {
    workstreams: [MOCK_WORKSTREAMS[0]],
    activeFilter: null,
    onFilterChange: () => {},
  },
};

export const ManyWorkstreams: Story = {
  args: {
    workstreams: [
      ...MOCK_WORKSTREAMS,
      {
        id: "ws-auth",
        name: "Authentication & Access",
        shortCode: "AUTH",
        color: "#8b5cf6",
        requirements: [],
      },
      {
        id: "ws-reporting",
        name: "Reporting & Analytics",
        shortCode: "RPT",
        color: "#ec4899",
        requirements: [],
      },
      {
        id: "ws-integrations",
        name: "Third-Party Integrations",
        shortCode: "INT",
        color: "#14b8a6",
        requirements: [],
      },
    ],
    activeFilter: null,
    onFilterChange: () => {},
  },
};

export const ClickAllTab: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: "ws-catalog",
    onFilterChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const allButton = canvas.getByRole("button", { name: /all/i });
    await userEvent.click(allButton);
  },
};

export const ClickWorkstreamTab: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: null,
    onFilterChange: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkoutTab = canvas.getByRole("button", { name: /checkout/i });
    await userEvent.click(checkoutTab);
  },
};

export const Mobile: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: null,
    onFilterChange: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    workstreams: MOCK_WORKSTREAMS,
    activeFilter: "ws-checkout",
    onFilterChange: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
