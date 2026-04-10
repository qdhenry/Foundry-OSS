import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { SkillEditor } from "./SkillEditor";

// ─── Sample skill content ─────────────────────────────────────────────────────

const SAMPLE_PRODUCT_TRANSFORM = `# Product Data Transform Skill
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
- Flag products with price > $10,000 for manual review
- Warn on missing category mappings (log but continue)

## Error Handling
On transformation failure: log error with SKU, skip record, continue batch.
Generate summary report at end of batch with success/failure counts.`;

const SAMPLE_ORDER_ETL = `# Order History ETL Skill
# Extracts and loads historical order data from Magento to Salesforce B2B

## Overview
This skill handles the extraction, transformation, and loading of historical
order records. Orders are batched in groups of 500 for API efficiency.

## Steps
1. Query Magento order export API with date range filter
2. Validate order structure and required fields
3. Map Magento order status to Salesforce order status values
4. Create Salesforce Order records via bulk API
5. Link order items to migrated Product2 records

## Status Mapping
| Magento Status | Salesforce Status |
|----------------|-------------------|
| pending        | Draft             |
| processing     | Activated         |
| complete       | Activated         |
| cancelled      | Cancelled         |
| closed         | Cancelled         |`;

const SAMPLE_SHORT = `# Quick Validation Skill
# Validates data integrity after migration

Run checksums on:
- Product counts
- Order totals
- Customer record counts`;

const SAMPLE_EMPTY = "";

const SAMPLE_SINGLE_LINE = "# Minimal skill — no content yet";

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SkillEditor> = {
  title: "Skills/SkillEditor",
  component: SkillEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    content: {
      control: "text",
      description: "The markdown/text content displayed in the editor",
    },
    readOnly: {
      control: "boolean",
      description: "When true, the textarea is read-only and a badge is shown",
    },
    onChange: {
      description: "Callback fired when the editor content changes",
    },
  },
  args: {
    onChange: fn().mockName("onChange"),
  },
};

export default meta;
type Story = StoryObj<typeof SkillEditor>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const Default: Story = {
  name: "Product Transform Skill",
  args: {
    content: SAMPLE_PRODUCT_TRANSFORM,
    readOnly: false,
  },
};

export const OrderETL: Story = {
  name: "Order History ETL Skill",
  args: {
    content: SAMPLE_ORDER_ETL,
    readOnly: false,
  },
};

export const ReadOnly: Story = {
  name: "Read Only",
  args: {
    content: SAMPLE_PRODUCT_TRANSFORM,
    readOnly: true,
  },
};

export const ReadOnlyShort: Story = {
  name: "Read Only — Short Content",
  args: {
    content: SAMPLE_SHORT,
    readOnly: true,
  },
};

export const Empty: Story = {
  name: "Empty Content",
  args: {
    content: SAMPLE_EMPTY,
    readOnly: false,
  },
};

export const SingleLine: Story = {
  name: "Single Line",
  args: {
    content: SAMPLE_SINGLE_LINE,
    readOnly: false,
  },
};

export const LongContent: Story = {
  name: "Long Content (many lines)",
  args: {
    content: Array.from(
      { length: 80 },
      (_, i) =>
        `# Line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, migration step ${i + 1}`,
    ).join("\n"),
    readOnly: false,
  },
};

export const TypeInEditor: Story = {
  name: "Interactive — Type in Editor",
  args: {
    content: "# Start typing below\n",
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByRole("textbox");

    await userEvent.click(textarea);
    await userEvent.type(textarea, "\nNew line added via play function");

    await expect(textarea).toHaveFocus();
  },
};

export const ReadOnlyInteraction: Story = {
  name: "Interactive — Read Only Shows Badge",
  args: {
    content: SAMPLE_ORDER_ETL,
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = await canvas.findByText("Read Only");
    await expect(badge).toBeVisible();
  },
};

export const LineCountFooter: Story = {
  name: "Line Count Footer",
  args: {
    content: SAMPLE_PRODUCT_TRANSFORM,
    readOnly: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Footer shows line count — the sample has multiple lines
    const footer = await canvas.findByText(/\d+ lines/);
    await expect(footer).toBeVisible();
  },
};

export const Mobile: Story = {
  name: "Mobile",
  args: {
    content: SAMPLE_SHORT,
    readOnly: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet",
  args: {
    content: SAMPLE_PRODUCT_TRANSFORM,
    readOnly: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
