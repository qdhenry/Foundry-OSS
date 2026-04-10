import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import type { ParsedLogMessage } from "./parseLogMessage";
import { StructuredLogMessage } from "./StructuredLogMessage";

const meta: Meta<typeof StructuredLogMessage> = {
  title: "Audit/StructuredLogMessage",
  component: StructuredLogMessage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    parsed: {
      description: "A ParsedLogMessage object with a summary string and an array of typed fields",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StructuredLogMessage>;

// ── Shared mock data ──────────────────────────────────────────────────────────

const sessionInitParsed: ParsedLogMessage = {
  summary: "Session init (v1.2.3)",
  fields: [
    { key: "Type", value: "Session Init", type: "badge" },
    { key: "Session", value: "sess_acme_001", type: "text" },
    { key: "Version", value: "1.2.3", type: "text" },
    { key: "Tools", value: "Read, Write, Bash, Edit, Glob, Grep", type: "text" },
  ],
};

const toolUseParsed: ParsedLogMessage = {
  summary: "Tool: Write",
  fields: [
    { key: "Type", value: "assistant", type: "badge" },
    { key: "Tool", value: "Write", type: "badge" },
    { key: "file_path", value: "/workspace/src/products/sku-mapper.ts", type: "file" },
    {
      key: "content",
      value: `export function mapSku(magento: string): string {\n  return \`SF-\${magento.toUpperCase()}\`;\n}\n\nexport function batchMapSkus(skus: string[]): string[] {\n  return skus.map(mapSku);\n}`,
      type: "code",
    },
  ],
};

const toolResultParsed: ParsedLogMessage = {
  summary: "Tool ID: tool_use_abc123456",
  fields: [
    { key: "Type", value: "tool_result", type: "badge" },
    { key: "Tool ID", value: "tool_use_abc123456", type: "text" },
    {
      key: "Result",
      value: "File written successfully: /workspace/src/products/sku-mapper.ts (42 lines)",
      type: "code",
    },
  ],
};

const readToolParsed: ParsedLogMessage = {
  summary: "Read: /workspace/src/products/sku-mapper.ts",
  fields: [
    { key: "Type", value: "assistant", type: "badge" },
    { key: "Tool", value: "Read", type: "badge" },
    { key: "file_path", value: "/workspace/src/products/sku-mapper.ts", type: "file" },
    { key: "Lines", value: "247", type: "text" },
    {
      key: "Content",
      value: `// SKU Mapper — AcmeCorp Migration\nexport const SKU_PREFIX = "SF";\n\nexport function mapSku(magento: string): string {\n  return \`\${SKU_PREFIX}-\${magento.toUpperCase()}\`;\n}`,
      type: "code",
    },
  ],
};

const executionResultParsed: ParsedLogMessage = {
  summary: "Execution result",
  fields: [
    { key: "Type", value: "Result", type: "badge" },
    {
      key: "Result",
      value:
        "Task completed successfully. Created SKU mapping module with 247 product entries validated against Salesforce B2B Commerce schema.",
      type: "code",
    },
    { key: "Duration", value: "48.2s", type: "text" },
    { key: "Cost", value: "$0.0312", type: "text" },
  ],
};

const bashToolParsed: ParsedLogMessage = {
  summary: "Tool: Bash",
  fields: [
    { key: "Type", value: "assistant", type: "badge" },
    { key: "Tool", value: "Bash", type: "badge" },
    { key: "command", value: "npm run test -- --testPathPattern=sku-mapper", type: "code" },
    { key: "description", value: "Run SKU mapper unit tests", type: "text" },
  ],
};

const textOnlyParsed: ParsedLogMessage = {
  summary:
    "All 118 AcmeCorp requirements have been successfully mapped to Salesforce B2B categories.",
  fields: [
    {
      key: "Text",
      value:
        "All 118 AcmeCorp requirements have been successfully mapped to Salesforce B2B categories. The migration script processed 7 workstreams and generated 42 transformation rules.",
      type: "text",
    },
  ],
};

const longCodeParsed: ParsedLogMessage = {
  summary: "Tool: Write",
  fields: [
    { key: "Type", value: "assistant", type: "badge" },
    { key: "Tool", value: "Write", type: "badge" },
    { key: "file_path", value: "/workspace/src/migration/product-transform.ts", type: "file" },
    {
      key: "content",
      value: `import { mapSku } from './sku-mapper';\nimport type { MagentoProduct, SalesforceProduct } from './types';\n\n/**\n * Transform a Magento product record to Salesforce B2B Commerce format.\n * Handles custom attributes, category mappings, and pricing tiers.\n */\nexport function transformProduct(magento: MagentoProduct): SalesforceProduct {\n  return {\n    ProductCode: mapSku(magento.sku),\n    Name: magento.name,\n    Description: magento.description ?? '',\n    IsActive: magento.status === 1,\n    Family: mapCategory(magento.category_ids[0]),\n    // B2B specific fields\n    SBQQ__AssetConvertible__c: true,\n    SBQQ__BillingFrequency__c: 'Monthly',\n    // Custom pricing\n    UnitPrice: magento.price,\n    CurrencyIsoCode: 'USD',\n  };\n}\n\nfunction mapCategory(magentoId: number): string {\n  const CATEGORY_MAP: Record<number, string> = {\n    3: 'Industrial Supplies',\n    4: 'Diagnostic Equipment',\n    5: 'Laboratory',\n    6: 'Field Services',\n  };\n  return CATEGORY_MAP[magentoId] ?? 'Uncategorized';\n}`,
      type: "code",
    },
  ],
};

const multipleFieldsParsed: ParsedLogMessage = {
  summary: "Message (assistant/tool_use)",
  fields: [
    { key: "Type", value: "assistant", type: "badge" },
    { key: "Subtype", value: "tool_use", type: "badge" },
    { key: "Tool", value: "Glob", type: "badge" },
    { key: "pattern", value: "**/*.ts", type: "text" },
    { key: "path", value: "/workspace/src", type: "file" },
  ],
};

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    parsed: sessionInitParsed,
  },
};

export const SessionInit: Story = {
  name: "Session Init Message",
  args: {
    parsed: sessionInitParsed,
  },
};

export const ToolUseWrite: Story = {
  name: "Tool Use: Write",
  args: {
    parsed: toolUseParsed,
  },
};

export const ToolUseRead: Story = {
  name: "Tool Use: Read (with file content)",
  args: {
    parsed: readToolParsed,
  },
};

export const ToolUseBash: Story = {
  name: "Tool Use: Bash",
  args: {
    parsed: bashToolParsed,
  },
};

export const ToolResult: Story = {
  name: "Tool Result",
  args: {
    parsed: toolResultParsed,
  },
};

export const ExecutionResult: Story = {
  name: "Execution Result",
  args: {
    parsed: executionResultParsed,
  },
};

export const TextOnly: Story = {
  name: "Text Content Only",
  args: {
    parsed: textOnlyParsed,
  },
};

export const LongCodeContent: Story = {
  name: "Long Code Content (show more/less)",
  args: {
    parsed: longCodeParsed,
  },
};

export const MultipleFields: Story = {
  name: "Multiple Fields (Glob tool)",
  args: {
    parsed: multipleFieldsParsed,
  },
};

export const InteractiveExpand: Story = {
  name: "Interactive: Expand Fields",
  args: {
    parsed: sessionInitParsed,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button");
    await expect(toggle).toBeVisible();
    await userEvent.click(toggle);
    // Fields should now be visible
    await expect(canvas.getByText("Session Init")).toBeVisible();
  },
};

export const InteractiveExpandCollapse: Story = {
  name: "Interactive: Expand then Collapse",
  args: {
    parsed: toolUseParsed,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: /tool: write/i });
    // Expand
    await userEvent.click(toggle);
    // Verify expanded content visible
    await expect(canvas.getByText("Write")).toBeVisible();
    // Collapse
    await userEvent.click(toggle);
  },
};

export const InteractiveShowMoreCode: Story = {
  name: "Interactive: Show More on Long Code",
  args: {
    parsed: longCodeParsed,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // First expand the structured message
    const expandToggle = canvas.getByRole("button", { name: /tool: write/i });
    await userEvent.click(expandToggle);
    // Then click "Show more" on the long code block
    const showMoreBtn = await canvas.findByRole("button", { name: /show more/i });
    await userEvent.click(showMoreBtn);
    // Should now show "Show less"
    await expect(canvas.getByRole("button", { name: /show less/i })).toBeVisible();
  },
};

export const Mobile: Story = {
  args: {
    parsed: toolUseParsed,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    parsed: executionResultParsed,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
