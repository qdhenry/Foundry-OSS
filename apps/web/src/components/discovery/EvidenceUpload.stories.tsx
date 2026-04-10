import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EvidenceUpload } from "./EvidenceUpload";

// EvidenceUpload uses useMutation from convex/react — mocked globally.
// It renders a file upload button with a hidden file input.

const meta: Meta<typeof EvidenceUpload> = {
  title: "Discovery/EvidenceUpload",
  component: EvidenceUpload,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    requirementId: "req-1",
    orgId: "org_acme",
  },
};

export default meta;
type Story = StoryObj<typeof EvidenceUpload>;

export const Default: Story = {
  name: "Default (Ready to Upload)",
};

export const DifferentRequirement: Story = {
  name: "Different Requirement",
  args: {
    requirementId: "req-42",
    orgId: "org_acme",
  },
};

export const InContext: Story = {
  name: "In Evidence Section Context",
  decorators: [
    (Story) => (
      <div className="w-[480px] rounded-xl border border-border-default p-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-text-secondary">Evidence</label>
          <Story />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div>
                <span className="block text-sm font-medium text-text-primary">Acme_RFP.pdf</span>
                <span className="text-xs text-text-muted">2.4 MB</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div>
                <span className="block text-sm font-medium text-text-primary">
                  Current_Catalog_Export.xlsx
                </span>
                <span className="text-xs text-text-muted">845 KB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  ],
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
