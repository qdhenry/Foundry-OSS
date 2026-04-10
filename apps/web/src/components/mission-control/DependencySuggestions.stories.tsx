import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { clearMockOverrides, setMockOverrides } from "../../../.storybook/mocks/convex";
import { DependencySuggestions } from "./DependencySuggestions";

// ─── Shared mock suggestion data ─────────────────────────────────────────────

const suggestionHighConfidence = {
  _id: "dep-001" as any,
  _creationTime: Date.now(),
  dependencyType: "blocks",
  aiConfidence: 92,
  description:
    "Product Data Migration must complete before Storefront Theme can render catalog pages correctly.",
  sourceWorkstream: { name: "Product Data Migration" },
  targetWorkstream: { name: "Storefront Theme & UX" },
};

const suggestionMediumConfidence = {
  _id: "dep-002" as any,
  _creationTime: Date.now(),
  dependencyType: "enables",
  aiConfidence: 71,
  description:
    "Customer Accounts setup enables Order History Transfer to associate historical orders with migrated profiles.",
  sourceWorkstream: { name: "Customer Accounts" },
  targetWorkstream: { name: "Order History Transfer" },
};

const suggestionLowConfidence = {
  _id: "dep-003" as any,
  _creationTime: Date.now(),
  dependencyType: "conflicts",
  aiConfidence: 44,
  description:
    "Potential schema conflict between BigCommerce B2B Configuration and Custom Pricing Engine field definitions.",
  sourceWorkstream: { name: "BigCommerce B2B Configuration" },
  targetWorkstream: { name: "Custom Pricing Engine" },
};

const suggestionNoDescription = {
  _id: "dep-004" as any,
  _creationTime: Date.now(),
  dependencyType: "enables",
  aiConfidence: 85,
  description: undefined,
  sourceWorkstream: { name: "API Integration Layer" },
  targetWorkstream: { name: "Reporting Dashboard" },
};

const suggestionUnknownWorkstream = {
  _id: "dep-005" as any,
  _creationTime: Date.now(),
  dependencyType: "blocks",
  aiConfidence: 60,
  description: "A blocking dependency was detected between two workstreams.",
  sourceWorkstream: null,
  targetWorkstream: null,
};

// ─── Decorator helpers ────────────────────────────────────────────────────────

function withSuggestions(suggestions: unknown[] | undefined) {
  return (Story: React.ComponentType) => {
    if (suggestions === undefined) {
      clearMockOverrides();
    } else {
      setMockOverrides({ "dependencyDetection:getPendingSuggestions": suggestions });
    }
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof DependencySuggestions> = {
  title: "MissionControl/DependencySuggestions",
  component: DependencySuggestions,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    programId: { control: "text" },
  },
  args: {
    programId: "prog-acme-demo" as any,
  },
};

export default meta;
type Story = StoryObj<typeof DependencySuggestions>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Multiple Suggestions",
  decorators: [
    withSuggestions([
      suggestionHighConfidence,
      suggestionMediumConfidence,
      suggestionLowConfidence,
    ]),
  ],
};

export const SingleSuggestion: Story = {
  name: "Single Suggestion",
  decorators: [withSuggestions([suggestionHighConfidence])],
};

export const HighConfidence: Story = {
  name: "High Confidence Only",
  decorators: [withSuggestions([suggestionHighConfidence, suggestionNoDescription])],
};

export const LowConfidence: Story = {
  name: "Low Confidence",
  decorators: [withSuggestions([suggestionLowConfidence])],
};

export const WithoutDescriptions: Story = {
  name: "Without Descriptions",
  decorators: [withSuggestions([suggestionNoDescription])],
};

export const UnknownWorkstreams: Story = {
  name: "Unknown Workstream Names",
  decorators: [withSuggestions([suggestionUnknownWorkstream])],
};

export const ManySuggestions: Story = {
  name: "Many Suggestions (5)",
  decorators: [
    withSuggestions([
      suggestionHighConfidence,
      suggestionMediumConfidence,
      suggestionLowConfidence,
      suggestionNoDescription,
      {
        ...suggestionHighConfidence,
        _id: "dep-extra" as any,
        aiConfidence: 78,
        dependencyType: "enables",
      },
    ]),
  ],
};

export const Empty: Story = {
  name: "Empty (returns null)",
  decorators: [withSuggestions([])],
};

export const Loading: Story = {
  name: "Loading State",
  // undefined from useQuery renders loading skeleton
  decorators: [withSuggestions(undefined)],
};

export const ApproveDismissFlow: Story = {
  name: "Approve/Dismiss Interaction",
  decorators: [withSuggestions([suggestionHighConfidence, suggestionMediumConfidence])],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify both action buttons are present for the first suggestion
    const approveButtons = await canvas.findAllByRole("button", { name: /approve/i });
    const dismissButtons = await canvas.findAllByRole("button", { name: /dismiss/i });

    await expect(approveButtons.length).toBeGreaterThan(0);
    await expect(dismissButtons.length).toBeGreaterThan(0);

    // Click approve on the first card (will call the mocked mutation)
    await userEvent.click(approveButtons[0]);
  },
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [withSuggestions([suggestionHighConfidence, suggestionMediumConfidence])],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [
    withSuggestions([
      suggestionHighConfidence,
      suggestionMediumConfidence,
      suggestionLowConfidence,
    ]),
  ],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
