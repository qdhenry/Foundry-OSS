import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "@storybook/test";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { VersionDiff } from "./VersionDiff";

// ─── Mock version content ─────────────────────────────────────────────────────

const V1_CONTENT = `# Product Data Transform Skill
# Transforms Magento product records into Salesforce B2B Commerce format

## Context
You are migrating product catalog data from Magento 2 to Salesforce B2B Commerce.

## Input Format
- SKU: Magento product identifier (string, max 64 chars)
- name: Product display name
- price: Base price in USD (decimal)
- categories: Array of Magento category paths

## Transformation Rules
1. Map Magento SKU to Salesforce ProductCode
2. Normalize category paths to Salesforce Product Family picklist values
3. Convert price to PricebookEntry with standard pricebook

## Output Schema
{
  "ProductCode": "<sku>",
  "Name": "<product name>",
  "Family": "<normalized category>"
}`;

const V2_CONTENT = `# Product Data Transform Skill
# Transforms Magento product records into Salesforce B2B Commerce format

## Context
You are migrating product catalog data from Magento 2 to Salesforce B2B Commerce.
Each product must be mapped to the Salesforce Product2 and PricebookEntry objects.

## Input Format
- SKU: Magento product identifier (string, max 64 chars)
- name: Product display name
- price: Base price in USD (decimal)
- categories: Array of Magento category paths
- attributes: Key-value map of custom attributes
- inventory: Stock quantity per warehouse

## Transformation Rules
1. Map Magento SKU → Salesforce ProductCode (truncate at 255 chars)
2. Normalize category paths to Salesforce Product Family picklist values
3. Convert price to PricebookEntry with standard pricebook
4. Map inventory to QuantityUnitOfMeasure field
5. Preserve all custom attributes as JSON in Description field

## Output Schema
{
  "ProductCode": "<sku>",
  "Name": "<product name>",
  "Family": "<normalized category>",
  "Description": "<JSON attributes>",
  "IsActive": true
}

## Validation
- Reject products with empty SKU or name
- Flag products with price > $10,000 for manual review`;

const V3_CONTENT = `# Product Data Transform Skill
# Transforms Magento product records into Salesforce B2B Commerce format

## Context
You are migrating product catalog data from Magento 2 to Salesforce B2B Commerce.
Each product must be mapped to the Salesforce Product2 and PricebookEntry objects.

## Input Format
- SKU: Magento product identifier (string, max 64 chars)
- name: Product display name
- price: Base price in USD (decimal)
- categories: Array of Magento category paths
- attributes: Key-value map of custom attributes
- inventory: Stock quantity per warehouse
- images: Array of image URLs for media gallery migration

## Transformation Rules
1. Map Magento SKU → Salesforce ProductCode (truncate at 255 chars)
2. Normalize category paths to Salesforce Product Family picklist values
3. Convert price to PricebookEntry with standard pricebook
4. Map inventory to QuantityUnitOfMeasure field
5. Preserve all custom attributes as JSON in Description field
6. Migrate product images to Salesforce ContentVersion records

## Output Schema
{
  "ProductCode": "<sku>",
  "Name": "<product name>",
  "Family": "<normalized category>",
  "Description": "<JSON attributes>",
  "IsActive": true
}

## Validation
- Reject products with empty SKU or name
- Flag products with price > $10,000 for manual review
- Warn on missing images (log but continue)

## Error Handling
On transformation failure: log error with SKU, skip record, continue batch.`;

const IDENTICAL_CONTENT = `# Unchanged Skill
# This content is identical in both versions

No differences between these two versions.`;

// ─── Decorator helper ─────────────────────────────────────────────────────────

function withComparison(
  versionA: { content: string; version: string },
  versionB: { content: string; version: string },
) {
  return (Story: React.ComponentType) => {
    setMockOverrides({
      "skillVersions:compare": { versionA, versionB },
    });
    return <Story />;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof VersionDiff> = {
  title: "Skills/VersionDiff",
  component: VersionDiff,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    versionAId: { control: "text" },
    versionBId: { control: "text" },
    onClose: { description: "Callback fired when the diff panel is closed" },
  },
  args: {
    versionAId: "ver-001",
    versionBId: "ver-002",
    onClose: fn().mockName("onClose"),
  },
};

export default meta;
type Story = StoryObj<typeof VersionDiff>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "v1 → v2 (Additions)",
  decorators: [
    withComparison({ content: V1_CONTENT, version: "v1" }, { content: V2_CONTENT, version: "v2" }),
  ],
};

export const V2ToV3: Story = {
  name: "v2 → v3 (Mixed Changes)",
  decorators: [
    withComparison({ content: V2_CONTENT, version: "v2" }, { content: V3_CONTENT, version: "v3" }),
  ],
};

export const V1ToV3: Story = {
  name: "v1 → v3 (Large Diff)",
  decorators: [
    withComparison({ content: V1_CONTENT, version: "v1" }, { content: V3_CONTENT, version: "v3" }),
  ],
};

export const Identical: Story = {
  name: "Identical Versions (No Diff)",
  decorators: [
    withComparison(
      { content: IDENTICAL_CONTENT, version: "v2" },
      { content: IDENTICAL_CONTENT, version: "v3" },
    ),
  ],
};

export const AdditionsOnly: Story = {
  name: "Additions Only",
  decorators: [
    withComparison(
      { content: "# Skill\n\nLine one.\nLine two.", version: "v1" },
      {
        content: "# Skill\n\nLine one.\nLine two.\nLine three added.\nLine four added.",
        version: "v2",
      },
    ),
  ],
};

export const RemovalsOnly: Story = {
  name: "Removals Only",
  decorators: [
    withComparison(
      {
        content: "# Skill\n\nLine one.\nLine two.\nLine three removed.\nLine four removed.",
        version: "v3",
      },
      { content: "# Skill\n\nLine one.\nLine two.", version: "v4" },
    ),
  ],
};

export const Loading: Story = {
  name: "Loading State",
  // No mock override — comparison query returns undefined (loading)
  args: {
    versionAId: "",
    versionBId: "",
  },
};

export const CloseButton: Story = {
  name: "Interactive — Close Button",
  decorators: [
    withComparison({ content: V1_CONTENT, version: "v1" }, { content: V2_CONTENT, version: "v2" }),
  ],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByText("Version Diff");
    await expect(header).toBeVisible();

    // Verify diff stats are shown
    const addedStat = await canvas.findByText(/^\+\d+$/);
    await expect(addedStat).toBeVisible();
  },
};

export const Mobile: Story = {
  name: "Mobile",
  decorators: [
    withComparison({ content: V1_CONTENT, version: "v1" }, { content: V2_CONTENT, version: "v2" }),
  ],
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  decorators: [
    withComparison({ content: V1_CONTENT, version: "v1" }, { content: V3_CONTENT, version: "v3" }),
  ],
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
