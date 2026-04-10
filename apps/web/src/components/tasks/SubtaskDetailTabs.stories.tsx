import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { SubtaskDetailTabs } from "./SubtaskDetailTabs";

const meta: Meta<typeof SubtaskDetailTabs> = {
  title: "Tasks/SubtaskDetailTabs",
  component: SubtaskDetailTabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof SubtaskDetailTabs>;

const baseSubtask = {
  _id: "subtask_001" as any,
  title: "Implement Stripe payment intent creation",
  description:
    "Create the server-side action that initializes a Stripe PaymentIntent with the correct currency, amount, and metadata from the cart session.",
  prompt: `You are implementing Stripe payment intent creation for a B2B commerce platform.

Task: Create a Convex action at convex/payments/createPaymentIntent.ts that:
1. Accepts { cartId, orgId } as arguments
2. Fetches cart total from the database
3. Creates a Stripe PaymentIntent via the Stripe SDK
4. Stores the paymentIntentId on the order record
5. Returns { clientSecret } to the caller

Use the STRIPE_SECRET_KEY environment variable. Handle idempotency keys using the cartId.`,
  estimatedFiles: 3,
  complexityScore: 3,
  estimatedDurationMs: 480000,
  allowedFiles: ["convex/payments/createPaymentIntent.ts", "convex/schema.ts", "convex/orders.ts"],
  order: 0,
  isPausePoint: false,
  status: "pending",
  retryCount: 0,
};

export const Default: Story = {
  args: {
    subtask: baseSubtask,
  },
};

export const WithFilesTab: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "completed",
      filesChanged: [
        "convex/payments/createPaymentIntent.ts",
        "convex/schema.ts",
        "convex/orders.ts",
      ],
      commitSha: "a3f9d21bc4e5f678901234567890abcdef123456",
      executionDurationMs: 38200,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filesTab = canvas.getByRole("button", { name: /files/i });
    await userEvent.click(filesTab);
  },
};

export const WithScopeViolations: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "completed",
      filesChanged: [
        "convex/payments/createPaymentIntent.ts",
        "convex/schema.ts",
        "src/components/checkout/PaymentForm.tsx",
      ],
      scopeViolations: ["src/components/checkout/PaymentForm.tsx"],
      commitSha: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0",
      executionDurationMs: 52100,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filesTab = canvas.getByRole("button", { name: /files/i });
    await userEvent.click(filesTab);
  },
};

export const WithDiffTab: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "completed",
      commitSha: "c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0",
      filesChanged: ["convex/payments/createPaymentIntent.ts"],
      executionDurationMs: 29500,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const diffTab = canvas.getByRole("button", { name: /diff/i });
    await userEvent.click(diffTab);
  },
};

export const ExecutingStatus: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "executing",
    },
  },
};

export const FailedStatus: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "failed",
      errorMessage: "Stripe SDK not found in dependencies. Run: bun add stripe before retrying.",
    },
  },
};

export const HighComplexity: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      _id: "subtask_002" as any,
      title: "Migrate product catalog data from Magento to Salesforce B2B Commerce",
      description:
        "ETL pipeline that reads all 14,000 SKUs from Magento MySQL, transforms attributes to SFCC format, handles image CDN migration, and bulk-upserts via the B2B Commerce API.",
      complexityScore: 5,
      estimatedFiles: 12,
      estimatedDurationMs: 1800000,
      allowedFiles: [
        "scripts/migrate/catalog.ts",
        "scripts/migrate/transforms/product.ts",
        "scripts/migrate/transforms/category.ts",
        "scripts/migrate/transforms/pricing.ts",
        "scripts/migrate/api/sfcc.ts",
        "scripts/migrate/api/magento.ts",
        "scripts/migrate/utils/cdn.ts",
        "scripts/migrate/utils/logger.ts",
      ],
    },
  },
};

export const WithPausePoint: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      isPausePoint: true,
    },
  },
};

export const NoAllowedFiles: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      allowedFiles: undefined,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filesTab = canvas.getByRole("button", { name: /files/i });
    await userEvent.click(filesTab);
  },
};

export const LogsTabPending: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "pending",
    },
  },
};

export const LogsTabAvailable: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "completed",
      executionDurationMs: 41300,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const logsTab = canvas.getByRole("button", { name: /logs/i });
    await userEvent.click(logsTab);
  },
};

export const Mobile: Story = {
  args: {
    subtask: baseSubtask,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    subtask: {
      ...baseSubtask,
      status: "completed",
      filesChanged: ["convex/payments/createPaymentIntent.ts", "convex/schema.ts"],
      commitSha: "d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9",
      executionDurationMs: 33600,
    },
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
