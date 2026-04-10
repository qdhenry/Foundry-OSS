import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { type FileChangeSummary, SandboxFileChanges } from "./SandboxFileChanges";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const ADDED_ONLY: FileChangeSummary = {
  files: [
    { status: "A", path: "src/app/(dashboard)/checkout/page.tsx" },
    { status: "A", path: "src/components/checkout/CheckoutForm.tsx" },
    { status: "A", path: "src/lib/checkout/validation.ts" },
  ],
  diffs: {},
  totalFiles: 3,
};

const MIXED_CHANGES: FileChangeSummary = {
  files: [
    { status: "M", path: "src/app/(dashboard)/tasks/[taskId]/page.tsx" },
    { status: "A", path: "src/components/tasks/TaskDetailPanel.tsx" },
    { status: "D", path: "src/components/tasks/OldTaskPanel.tsx" },
    { status: "M", path: "convex/tasks.ts" },
    { status: "A", path: "convex/schema.ts" },
  ],
  diffs: {
    "src/app/(dashboard)/tasks/[taskId]/page.tsx": `--- a/src/app/(dashboard)/tasks/[taskId]/page.tsx
+++ b/src/app/(dashboard)/tasks/[taskId]/page.tsx
@@ -1,8 +1,12 @@
 import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
+import { TaskBreadcrumb } from "@/components/tasks/TaskBreadcrumb";

 export default function TaskPage({ params }: { params: { taskId: string } }) {
   return (
-    <div className="p-6">
+    <div className="flex flex-col gap-4 p-6">
+      <TaskBreadcrumb taskId={params.taskId} />
       <TaskDetailPanel taskId={params.taskId} />
     </div>
   );
 }`,
    "convex/tasks.ts": `--- a/convex/tasks.ts
+++ b/convex/tasks.ts
@@ -45,6 +45,14 @@
 export const get = query({
   args: { taskId: v.id("tasks") },
   handler: async (ctx, { taskId }) => {
+    await assertOrgAccess(ctx, taskId);
     return ctx.db.get(taskId);
   },
 });
+
+export const listByProgram = query({
+  args: { programId: v.id("programs") },
+  handler: async (ctx, { programId }) => {
+    return ctx.db.query("tasks").withIndex("by_program", q => q.eq("programId", programId)).collect();
+  },
+});`,
  },
  totalFiles: 5,
};

const SINGLE_FILE: FileChangeSummary = {
  files: [{ status: "M", path: "src/components/ui/Button.tsx" }],
  diffs: {
    "src/components/ui/Button.tsx": `--- a/src/components/ui/Button.tsx
+++ b/src/components/ui/Button.tsx
@@ -12,7 +12,7 @@
 export function Button({ variant = "primary", size = "md", children, ...props }: ButtonProps) {
   return (
-    <button className={cn(buttonVariants({ variant, size }))} {...props}>
+    <button className={cn(buttonVariants({ variant, size }), "transition-colors")} {...props}>
       {children}
     </button>
   );
 }`,
  },
  totalFiles: 1,
};

const LIVE_CHANGES: FileChangeSummary = {
  files: [
    { status: "A", path: "src/components/checkout/CheckoutForm.tsx" },
    { status: "M", path: "src/app/(dashboard)/checkout/page.tsx" },
    { status: "A", path: "src/lib/validation.ts" },
  ],
  diffs: {},
  totalFiles: 3,
};

const LARGE_CHANGESET: FileChangeSummary = {
  files: [
    { status: "M", path: "convex/schema.ts" },
    { status: "A", path: "convex/sandbox/sessions.ts" },
    { status: "A", path: "convex/sandbox/logs.ts" },
    { status: "A", path: "convex/sandbox/orchestrator.ts" },
    { status: "M", path: "src/lib/sandboxHUDContext.tsx" },
    { status: "A", path: "src/components/sandbox/SandboxHUD.tsx" },
    { status: "A", path: "src/components/sandbox/SandboxLogStream.tsx" },
    { status: "D", path: "src/components/sandbox/LegacySandboxPanel.tsx" },
    { status: "M", path: "src/app/(dashboard)/[programId]/tasks/[taskId]/page.tsx" },
    { status: "A", path: "sandbox-worker/src/index.ts" },
    { status: "A", path: "sandbox-worker/src/sessionStore.ts" },
    { status: "M", path: "package.json" },
  ],
  diffs: {},
  totalFiles: 12,
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxFileChanges> = {
  title: "Sandbox/SandboxFileChanges",
  component: SandboxFileChanges,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof SandboxFileChanges>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Mixed changes — complete mode",
  args: {
    fileChangeSummary: MIXED_CHANGES,
    mode: "complete",
  },
};

export const LiveMode: Story = {
  name: "Live mode — session in progress",
  args: {
    fileChangeSummary: LIVE_CHANGES,
    mode: "live",
  },
};

export const AddedOnly: Story = {
  name: "Added files only",
  args: {
    fileChangeSummary: ADDED_ONLY,
    mode: "complete",
  },
};

export const SingleFile: Story = {
  name: "Single file modified — with diff",
  args: {
    fileChangeSummary: SINGLE_FILE,
    mode: "complete",
  },
};

export const LargeChangeset: Story = {
  name: "Large changeset — 12 files",
  args: {
    fileChangeSummary: LARGE_CHANGESET,
    mode: "complete",
  },
};

export const ExpandDiff: Story = {
  name: "Interactive — expand diff",
  args: {
    fileChangeSummary: MIXED_CHANGES,
    mode: "complete",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click on a file that has a diff to expand it
    const fileButton = canvas.getByText("src/app/(dashboard)/tasks/[taskId]/page.tsx");
    await userEvent.click(fileButton);
    // The diff should now be visible
    await expect(canvas.getByText(/TaskBreadcrumb/)).toBeInTheDocument();
  },
};

export const CollapseToggle: Story = {
  name: "Interactive — collapse the panel",
  args: {
    fileChangeSummary: MIXED_CHANGES,
    mode: "complete",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The collapse toggle button shows "−" when expanded
    const toggleButton = canvas.getByText("−");
    await userEvent.click(toggleButton);
    // After collapsing the file list should no longer be visible
    await expect(
      canvas.queryByText("src/app/(dashboard)/tasks/[taskId]/page.tsx"),
    ).not.toBeInTheDocument();
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  args: {
    fileChangeSummary: MIXED_CHANGES,
    mode: "complete",
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet viewport",
  args: {
    fileChangeSummary: MIXED_CHANGES,
    mode: "complete",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
