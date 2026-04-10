import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SandboxEditor } from "./SandboxEditor";

// ---------------------------------------------------------------------------
// Note: SandboxEditor dynamically imports Monaco Editor and CodeMirror via
// next/dynamic (ssr: false). In Storybook these load client-side. The file
// browser sidebar and toolbar are always rendered. The editorType prop
// controls which editor mounts in the right pane.
//
// The useAction mock returns a no-op fn() so listFiles / readFile / writeFile
// calls will resolve silently without populating real content.
// ---------------------------------------------------------------------------

const SAMPLE_TYPESCRIPT = `import { query } from "./_generated/server";
import { v } from "convex/values";

export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, { programId }) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", programId))
      .collect();
  },
});

export const get = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return ctx.db.get(taskId);
  },
});
`;

const SAMPLE_TSX = `"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface Props {
  programId: string;
}

export function TaskList({ programId }: Props) {
  const tasks = useQuery(api.tasks.listByProgram, { programId: programId as any });

  if (!tasks) return <div>Loading...</div>;

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task._id} className="rounded border border-border-default p-3">
          <p className="text-sm font-medium text-text-heading">{task.title}</p>
          <p className="text-xs text-text-secondary">{task.status}</p>
        </li>
      ))}
    </ul>
  );
}
`;

const SAMPLE_JSON = `{
  "name": "foundry-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0",
    "convex": "^1.12.0",
    "@clerk/nextjs": "^5.0.0"
  }
}
`;

const meta: Meta<typeof SandboxEditor> = {
  title: "Sandbox/SandboxEditor",
  component: SandboxEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "File browser + Monaco/CodeMirror editor for reading and writing files inside a live " +
          "sandbox container. Requires an active session; file operations call Convex actions " +
          "that proxy to the sandbox worker. In Storybook the editor mounts but file I/O is " +
          "mocked to no-ops.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ height: "600px", display: "flex", flexDirection: "column" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SandboxEditor>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Monaco: Story = {
  name: "Monaco editor",
  args: {
    sessionId: "sess-editor-1",
    editorType: "monaco",
    defaultValue: SAMPLE_TYPESCRIPT,
  } as any,
};

export const CodeMirror: Story = {
  name: "CodeMirror editor",
  args: {
    sessionId: "sess-editor-2",
    editorType: "codemirror",
    defaultValue: SAMPLE_TSX,
  } as any,
};

export const MonacoWithTSX: Story = {
  name: "Monaco — TSX file",
  args: {
    sessionId: "sess-editor-3",
    editorType: "monaco",
    defaultValue: SAMPLE_TSX,
  } as any,
};

export const MonacoWithJSON: Story = {
  name: "Monaco — JSON file",
  args: {
    sessionId: "sess-editor-4",
    editorType: "monaco",
    defaultValue: SAMPLE_JSON,
  } as any,
};

export const EditorDisabled: Story = {
  name: "Editor disabled — editorType none",
  args: {
    sessionId: "sess-editor-5",
    editorType: "none",
  },
};

export const EditorNull: Story = {
  name: "Editor disabled — editorType null",
  args: {
    sessionId: "sess-editor-6",
    editorType: null,
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  args: {
    sessionId: "sess-editor-mobile",
    editorType: "monaco",
    defaultValue: SAMPLE_TYPESCRIPT,
  } as any,
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  name: "Tablet viewport",
  args: {
    sessionId: "sess-editor-tablet",
    editorType: "monaco",
    defaultValue: SAMPLE_TYPESCRIPT,
  } as any,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
