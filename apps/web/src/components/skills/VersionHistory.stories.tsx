import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { clearMockOverrides, setMockOverrides } from "../../../.storybook/mocks/convex";
import { VersionHistory } from "./VersionHistory";

// ─── Mock version records ─────────────────────────────────────────────────────

const NOW = Date.now();
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;

const mockVersions = [
  {
    _id: "ver-005" as any,
    _creationTime: hoursAgo(2),
    version: "v5",
    lineCount: 178,
    message: "Add image migration support and error handling section",
  },
  {
    _id: "ver-004" as any,
    _creationTime: daysAgo(1),
    version: "v4",
    lineCount: 156,
    message: "Add validation rules for price thresholds",
  },
  {
    _id: "ver-003" as any,
    _creationTime: daysAgo(2),
    version: "v3",
    lineCount: 134,
    message: "Expand input format with attributes and inventory fields",
  },
  {
    _id: "ver-002" as any,
    _creationTime: daysAgo(5),
    version: "v2",
    lineCount: 112,
    message: "Add output schema and transformation rules",
  },
  {
    _id: "ver-001" as any,
    _creationTime: daysAgo(14),
    version: "v1",
    lineCount: 67,
    message: "Initial skill draft",
  },
];

const mockVersionsNoMessages = mockVersions.map(({ message: _msg, ...v }) => v);

const mockVersionsSingle = [mockVersions[0]];

const mockVersionsTwo = mockVersions.slice(0, 2);

// ─── Decorator helpers ────────────────────────────────────────────────────────

function withVersions(versions: unknown[] | undefined) {
  return (Story: React.ComponentType) => {
    if (versions === undefined) {
      clearMockOverrides();
    } else {
      setMockOverrides({ "skillVersions:listBySkill": versions });
    }
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof VersionHistory> = {
  title: "Skills/VersionHistory",
  component: VersionHistory,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    skillId: { control: "text" },
    onViewVersion: { description: "Callback when a version View button is clicked" },
    onCompare: { description: "Callback when two versions are selected and Compare is clicked" },
  },
  args: {
    skillId: "skill-1",
    onViewVersion: fn().mockName("onViewVersion"),
    onCompare: fn().mockName("onCompare"),
  },
};

export default meta;
type Story = StoryObj<typeof VersionHistory>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Five Versions",
  decorators: [withVersions(mockVersions)],
};

export const SingleVersion: Story = {
  name: "Single Version",
  decorators: [withVersions(mockVersionsSingle)],
};

export const TwoVersions: Story = {
  name: "Two Versions",
  decorators: [withVersions(mockVersionsTwo)],
};

export const WithoutMessages: Story = {
  name: "Without Commit Messages",
  decorators: [withVersions(mockVersionsNoMessages)],
};

export const ManyVersions: Story = {
  name: "Many Versions (10)",
  decorators: [
    withVersions([
      ...mockVersions,
      {
        _id: "ver-006" as any,
        _creationTime: daysAgo(16),
        version: "v6-old",
        lineCount: 45,
        message: "Prototype",
      },
      {
        _id: "ver-007" as any,
        _creationTime: daysAgo(18),
        version: "v7-old",
        lineCount: 30,
        message: "Scaffold",
      },
      {
        _id: "ver-008" as any,
        _creationTime: daysAgo(20),
        version: "v8-old",
        lineCount: 20,
        message: undefined,
      },
      {
        _id: "ver-009" as any,
        _creationTime: daysAgo(22),
        version: "v9-old",
        lineCount: 12,
        message: undefined,
      },
      {
        _id: "ver-010" as any,
        _creationTime: daysAgo(30),
        version: "v10-old",
        lineCount: 5,
        message: "Hello world",
      },
    ]),
  ],
};

export const Empty: Story = {
  name: "Empty (No Versions)",
  decorators: [withVersions([])],
};

export const Loading: Story = {
  name: "Loading State",
  // undefined from useQuery shows loading text
  decorators: [withVersions(undefined)],
};

export const SelectOneForCompare: Story = {
  name: "Interactive — Select One Version",
  decorators: [withVersions(mockVersions)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = await canvas.findAllByRole("checkbox");

    // Select first version
    await userEvent.click(checkboxes[0]);
    await expect(checkboxes[0]).toBeChecked();

    // Compare bar should NOT appear yet (need 2 selections)
    const compareBar = canvas.queryByText(/2 versions selected/i);
    await expect(compareBar).toBeNull();
  },
};

export const SelectTwoForCompare: Story = {
  name: "Interactive — Select Two Versions (Compare Bar Appears)",
  decorators: [withVersions(mockVersions)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = await canvas.findAllByRole("checkbox");

    // Select two versions
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);

    await expect(checkboxes[0]).toBeChecked();
    await expect(checkboxes[1]).toBeChecked();

    // Compare bar should now be visible
    const compareBar = await canvas.findByText(/2 versions selected/i);
    await expect(compareBar).toBeVisible();
  },
};

export const TriggerCompare: Story = {
  name: "Interactive — Trigger Compare",
  decorators: [withVersions(mockVersions)],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const checkboxes = await canvas.findAllByRole("checkbox");

    // Select two versions
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[2]);

    // Click the Compare button
    const compareButton = await canvas.findByRole("button", { name: /^compare$/i });
    await userEvent.click(compareButton);

    await expect(args.onCompare).toHaveBeenCalledOnce();
  },
};

export const ViewVersion: Story = {
  name: "Interactive — View Version",
  decorators: [withVersions(mockVersionsSingle)],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewButton = await canvas.findByRole("button", { name: /^view$/i });
    await userEvent.click(viewButton);
    await expect(args.onViewVersion).toHaveBeenCalledWith("ver-005");
  },
};

export const ThirdSelectionRotates: Story = {
  name: "Interactive — Third Selection Rotates Out Oldest",
  decorators: [withVersions(mockVersions)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = await canvas.findAllByRole("checkbox");

    // Select first two
    await userEvent.click(checkboxes[0]);
    await userEvent.click(checkboxes[1]);

    // Select a third — should deselect the first (rotation behaviour)
    await userEvent.click(checkboxes[2]);

    await expect(checkboxes[0]).not.toBeChecked();
    await expect(checkboxes[1]).toBeChecked();
    await expect(checkboxes[2]).toBeChecked();
  },
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [withVersions(mockVersions)],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [withVersions(mockVersions)],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
