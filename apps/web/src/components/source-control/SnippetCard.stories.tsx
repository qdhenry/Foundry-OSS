import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { SnippetCard } from "./SnippetCard";

const BASE_SNIPPET = {
  _id: "snippet_001" as any,
  title: "B2B Cart Validation Helper",
  description:
    "Validates cart contents against real-time inventory before allowing checkout to proceed. Handles OOS items, quantity limits, and account-level pricing rules.",
  code: `export async function validateCart(
  cartId: string,
  ctx: CartContext
): Promise<ValidationResult> {
  const items = await ctx.cartService.getItems(cartId);
  const stockChecks = await Promise.all(
    items.map(item => ctx.inventory.checkStock(item.sku, item.qty))
  );
  return {
    valid: stockChecks.every(s => s.available),
    errors: stockChecks
      .filter(s => !s.available)
      .map(s => \`\${s.sku} out of stock\`)
  };
}`,
  annotations:
    "Tested against Salesforce B2B Commerce Winter '25. Works with Rootstock ERP connector.",
  requirementCategory: "Checkout",
  targetPlatform: "salesforce_b2b",
  language: "TypeScript",
  successRating: "high",
  upvotes: 14,
  flagCount: 0,
};

const meta: Meta<typeof SnippetCard> = {
  title: "SourceControl/SnippetCard",
  component: SnippetCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof SnippetCard>;

export const HighRating: Story = {
  args: {
    snippet: BASE_SNIPPET,
  },
};

export const MediumRating: Story = {
  args: {
    snippet: {
      ...BASE_SNIPPET,
      _id: "snippet_002" as any,
      title: "NetSuite Order Sync Adapter",
      description:
        "Syncs B2B Commerce orders to NetSuite via REST API. Handles retry logic and partial failures.",
      code: `export class NetSuiteOrderAdapter {
  async syncOrder(orderId: string): Promise<SyncResult> {
    const order = await this.b2b.getOrder(orderId);
    try {
      const nsOrder = this.mapToNSFormat(order);
      return await this.netsuite.createOrder(nsOrder);
    } catch (err) {
      await this.retryQueue.enqueue({ orderId, error: err });
      return { status: 'queued' };
    }
  }
}`,
      annotations: undefined,
      targetPlatform: "platform_agnostic",
      language: "TypeScript",
      successRating: "medium",
      upvotes: 6,
      flagCount: 1,
    },
  },
};

export const LowRating: Story = {
  args: {
    snippet: {
      ...BASE_SNIPPET,
      _id: "snippet_003" as any,
      title: "Legacy Magento Cart Migration Script",
      description:
        "One-time script to migrate Magento cart data to Salesforce B2B. Use with caution.",
      code: `// WARNING: Run once only
SELECT * FROM magento_quote
WHERE status = 'active'
AND updated_at > '2024-01-01';`,
      annotations: "Deprecated approach — see REQ-088 for updated migration path.",
      targetPlatform: "platform_agnostic",
      language: "SQL",
      successRating: "low",
      upvotes: 1,
      flagCount: 3,
    },
  },
};

export const BigCommerceSnippet: Story = {
  args: {
    snippet: {
      ...BASE_SNIPPET,
      _id: "snippet_004" as any,
      title: "BigCommerce B2B Edition Price List Fetcher",
      description:
        "Retrieves customer-specific price lists from BigCommerce B2B Edition API with caching.",
      code: `export async function getPriceList(
  customerId: string,
  sku: string
): Promise<Price> {
  const cacheKey = \`price:\${customerId}:\${sku}\`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  const price = await bc.b2b.prices.get(customerId, sku);
  await cache.set(cacheKey, price, 300);
  return price;
}`,
      annotations: "Compatible with BigCommerce B2B Edition 3.x+",
      targetPlatform: "bigcommerce_b2b",
      language: "TypeScript",
      successRating: "high",
      upvotes: 9,
      flagCount: 0,
    },
  },
};

export const NoAnnotations: Story = {
  args: {
    snippet: {
      ...BASE_SNIPPET,
      annotations: undefined,
    },
  },
};

export const HighUpvoteCount: Story = {
  args: {
    snippet: {
      ...BASE_SNIPPET,
      upvotes: 47,
    },
  },
};

export const UpvoteInteraction: Story = {
  args: {
    snippet: BASE_SNIPPET,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const upvoteBtn = canvas.getByRole("button", { name: /14/i });
    await userEvent.click(upvoteBtn);
  },
};

export const Mobile: Story = {
  args: {
    snippet: BASE_SNIPPET,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    snippet: BASE_SNIPPET,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
