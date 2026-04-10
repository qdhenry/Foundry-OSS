import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, waitFor, within } from "@storybook/test";
import { ExecuteSkillModal } from "./ExecuteSkillModal";

/**
 * ExecuteSkillModal uses useQuery/useAction from convex/react and useOrganization from @clerk/nextjs.
 * These are mocked globally via Storybook's MSW/mock setup.
 *
 * The mock data below is passed to simulate the open/idle state of the modal.
 */

const meta: Meta<typeof ExecuteSkillModal> = {
  title: "AI/ExecuteSkillModal",
  component: ExecuteSkillModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-screen modal for executing an AI skill against a program. Requires Convex and Clerk context — mocked in Storybook.",
      },
    },
  },
  argTypes: {
    isOpen: { control: "boolean" },
    onClose: { action: "closed" },
  },
};

export default meta;
type Story = StoryObj<typeof ExecuteSkillModal>;

export const OpenIdle: Story = {
  name: "Open — Idle",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: true,
    onClose: fn(),
  },
};

export const OpenWithPreselectedSkill: Story = {
  name: "Open — Preselected Skill",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: true,
    onClose: fn(),
    preselectedSkillId: "skills_mock_id" as any,
  },
};

export const Closed: Story = {
  name: "Closed",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: false,
    onClose: fn(),
  },
};

export const FilledAndReady: Story = {
  name: "Open — Form Filled (Ready to Execute)",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: true,
    onClose: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => canvas.getByRole("combobox", { name: /skill/i }), {
      timeout: 3000,
    }).catch(() => null);

    const taskTypeInput = canvas.queryByPlaceholderText(/e\.g\. code_review/i);
    if (taskTypeInput) {
      await userEvent.type(taskTypeInput, "gap_analysis");
    }

    const promptTextarea = canvas.queryByPlaceholderText(/describe the specific task/i);
    if (promptTextarea) {
      await userEvent.type(
        promptTextarea,
        "Analyze the requirements for the Magento to Salesforce B2B migration and identify any coverage gaps in the data model.",
      );
    }
  },
};

export const Mobile: Story = {
  name: "Mobile — Open",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: true,
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — Open",
  args: {
    programId: "programs_mock_id" as any,
    isOpen: true,
    onClose: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
