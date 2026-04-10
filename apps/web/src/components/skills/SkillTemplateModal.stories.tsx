import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { clearMockOverrides, setMockOverrides } from "../../../.storybook/mocks/convex";
import { SkillTemplateModal } from "./SkillTemplateModal";

// ─── Mock template data ───────────────────────────────────────────────────────

const mockTemplates = [
  {
    id: "tpl-arch-001",
    name: "System Architecture Review",
    description:
      "Analyzes the existing system architecture and produces a detailed assessment with migration recommendations and risk flags.",
    domain: "architecture",
    lineCount: 124,
  },
  {
    id: "tpl-be-001",
    name: "REST API Scaffold",
    description:
      "Generates a fully typed REST API layer with Convex actions, input validation via Zod, and error handling patterns.",
    domain: "backend",
    lineCount: 89,
  },
  {
    id: "tpl-fe-001",
    name: "React Component Generator",
    description:
      "Creates accessible React components following the Untitled UI design system conventions with TypeScript props.",
    domain: "frontend",
    lineCount: 67,
  },
  {
    id: "tpl-int-001",
    name: "Third-Party API Integration",
    description:
      "Scaffolds a robust integration with external APIs including retry logic, rate limiting, and webhook verification.",
    domain: "integration",
    lineCount: 112,
  },
  {
    id: "tpl-dep-001",
    name: "CI/CD Pipeline Setup",
    description:
      "Configures GitHub Actions workflows for automated testing, staging deployment, and production release gating.",
    domain: "deployment",
    lineCount: 78,
  },
  {
    id: "tpl-test-001",
    name: "End-to-End Test Suite",
    description:
      "Writes comprehensive E2E tests using Playwright covering critical user flows, accessibility, and edge cases.",
    domain: "testing",
    lineCount: 145,
  },
  {
    id: "tpl-rev-001",
    name: "Code Review Checklist",
    description:
      "Performs a structured code review against security, performance, maintainability, and style standards.",
    domain: "review",
    lineCount: 55,
  },
  {
    id: "tpl-proj-001",
    name: "Project Kickoff Brief",
    description:
      "Generates a project kickoff document summarizing scope, stakeholders, timeline, and open decisions.",
    domain: "project",
    lineCount: 43,
  },
];

const mockTemplatesFew = mockTemplates.slice(0, 3);

// ─── Decorator helpers ────────────────────────────────────────────────────────

function withTemplates(templates: unknown[] | undefined) {
  return (Story: React.ComponentType) => {
    if (templates === undefined) {
      clearMockOverrides();
    } else {
      setMockOverrides({ "skills:listTemplates": templates });
    }
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SkillTemplateModal> = {
  title: "Skills/SkillTemplateModal",
  component: SkillTemplateModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    programId: { control: "text" },
    isOpen: { control: "boolean" },
    onClose: { description: "Callback fired when the modal is dismissed" },
  },
  args: {
    programId: "prog-acme-demo",
    isOpen: true,
    onClose: fn().mockName("onClose"),
  },
};

export default meta;
type Story = StoryObj<typeof SkillTemplateModal>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "All Templates",
  decorators: [withTemplates(mockTemplates)],
};

export const FewTemplates: Story = {
  name: "Few Templates (3)",
  decorators: [withTemplates(mockTemplatesFew)],
};

export const Loading: Story = {
  name: "Loading State",
  // undefined from useQuery triggers skeleton grid
  decorators: [withTemplates(undefined)],
};

export const Closed: Story = {
  name: "Closed (renders null)",
  decorators: [withTemplates(mockTemplates)],
  args: {
    isOpen: false,
  },
};

export const ArchitectureTemplatesOnly: Story = {
  name: "Architecture Templates Only",
  decorators: [withTemplates(mockTemplates.filter((t) => t.domain === "architecture"))],
};

export const BackendAndFrontend: Story = {
  name: "Backend and Frontend Templates",
  decorators: [
    withTemplates(mockTemplates.filter((t) => ["backend", "frontend"].includes(t.domain))),
  ],
};

export const CloseModal: Story = {
  name: "Interactive — Close via X Button",
  decorators: [withTemplates(mockTemplatesFew)],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The X close button is an svg button in the modal header
    const closeButton = await canvas.findByRole("button", { name: "" });
    await userEvent.click(closeButton);
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const ForkTemplate: Story = {
  name: "Interactive — Fork Template",
  decorators: [withTemplates(mockTemplatesFew)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const forkButtons = await canvas.findAllByRole("button", {
      name: /fork to program/i,
    });
    await expect(forkButtons.length).toBeGreaterThan(0);
    // Click the first fork button — triggers mocked forkTemplate mutation
    await userEvent.click(forkButtons[0]);
  },
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [withTemplates(mockTemplatesFew)],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [withTemplates(mockTemplates)],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
