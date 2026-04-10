import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { ChangedFilesSection } from "./ChangedFilesSection";

const meta: Meta<typeof ChangedFilesSection> = {
  title: "SourceControl/ChangedFilesSection",
  component: ChangedFilesSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    prId: "pr_abc123" as any,
    filesChanged: 6,
    additions: 248,
    deletions: 52,
  },
};

export default meta;
type Story = StoryObj<typeof ChangedFilesSection>;

// The component lazy-fetches files on expand via useAction.
// useAction is globally mocked — the action mock returns the files array.

const MOCK_FILES = [
  {
    filename: "src/commerce/checkout/CheckoutController.ts",
    status: "modified",
    additions: 87,
    deletions: 34,
    patch:
      "@@ -45,6 +45,8 @@ export class CheckoutController {\n-  async processCart(cartId: string) {\n+  async processCart(cartId: string, options?: CartOptions) {\n+    const opts = { skipValidation: false, ...options };\n     const cart = await this.cartService.get(cartId);\n     if (!cart) throw new Error('Cart not found');\n+    if (!opts.skipValidation) await this.validateCart(cart);\n     return this.checkoutService.process(cart);\n   }",
  },
  {
    filename: "src/commerce/checkout/CartService.ts",
    status: "modified",
    additions: 42,
    deletions: 11,
    patch:
      "@@ -12,4 +12,9 @@ export class CartService {\n   async get(cartId: string) {\n     return this.db.carts.findById(cartId);\n   }\n+\n+  async validateStock(cartId: string): Promise<boolean> {\n+    const items = await this.getItems(cartId);\n+    return items.every(item => item.stock >= item.quantity);\n+  }",
  },
  {
    filename: "src/commerce/checkout/types.ts",
    status: "added",
    additions: 28,
    deletions: 0,
    patch:
      "@@ -0,0 +1,28 @@\n+export interface CartOptions {\n+  skipValidation?: boolean;\n+  notifyCustomer?: boolean;\n+}\n+\n+export interface CheckoutResult {\n+  orderId: string;\n+  status: 'success' | 'pending' | 'failed';\n+  amount: number;\n+}",
  },
  {
    filename: "src/commerce/checkout/legacy/OldCheckout.ts",
    status: "removed",
    additions: 0,
    deletions: 156,
    patch: null,
  },
  {
    filename: "src/commerce/checkout/CartController.ts",
    status: "renamed",
    additions: 5,
    deletions: 5,
    patch:
      "@@ -1,5 +1,5 @@\n-// CartController (legacy name)\n+// CartController\n export class CartController {\n   // renamed from LegacyCartController\n }",
  },
  {
    filename: "tests/checkout/CheckoutController.test.ts",
    status: "modified",
    additions: 86,
    deletions: 2,
    patch:
      "@@ -88,0 +89,6 @@\n+  it('skips validation when skipValidation=true', async () => {\n+    const spy = jest.spyOn(controller, 'validateCart');\n+    await controller.processCart('cart-1', { skipValidation: true });\n+    expect(spy).not.toHaveBeenCalled();\n+  });\n",
  },
];

export const Collapsed: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": MOCK_FILES,
    },
  },
};

export const ExpandedWithFiles: Story = {
  parameters: {
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": MOCK_FILES,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /changed files/i });
    await userEvent.click(header);
  },
};

export const SingleFile: Story = {
  args: {
    filesChanged: 1,
    additions: 12,
    deletions: 3,
  },
  parameters: {
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": [MOCK_FILES[0]],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /changed files/i });
    await userEvent.click(header);
  },
};

export const LargeDiff: Story = {
  args: {
    filesChanged: 3,
    additions: 1240,
    deletions: 890,
  },
  parameters: {
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": MOCK_FILES.slice(0, 3),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /changed files/i });
    await userEvent.click(header);
  },
};

export const EmptyFiles: Story = {
  args: {
    filesChanged: 0,
    additions: 0,
    deletions: 0,
  },
  parameters: {
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole("button", { name: /changed files/i });
    await userEvent.click(header);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": MOCK_FILES,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.tasks.prActionsInternal.listPRFiles": MOCK_FILES,
    },
  },
};
