import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { ChatPanel } from "./ChatPanel";

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const SESSION_ACTIVE = {
  _id: "sess-chat-1",
  status: "ready",
  claudeSessionId: "cls-abc-123",
};

const SESSION_COMPLETED = {
  _id: "sess-chat-2",
  status: "completed",
  claudeSessionId: null,
};

const MESSAGES_EMPTY: never[] = [];

const MESSAGES_CONVERSATION = [
  {
    _id: "msg-1",
    role: "user" as const,
    content: "Can you add input validation to the form?",
    status: "complete" as const,
    createdAt: Date.now() - 120000,
  },
  {
    _id: "msg-2",
    role: "assistant" as const,
    content: "I'll add Zod-based validation to the form. Let me look at the current schema first.",
    status: "complete" as const,
    createdAt: Date.now() - 60000,
  },
  {
    _id: "msg-3",
    role: "user" as const,
    content: "Also make sure the error messages are user-friendly.",
    status: "complete" as const,
    createdAt: Date.now() - 30000,
  },
];

const MESSAGES_WITH_STREAMING = [
  {
    _id: "msg-1",
    role: "user" as const,
    content: "Implement the checkout flow",
    status: "complete" as const,
    createdAt: Date.now() - 5000,
  },
  {
    _id: "msg-2",
    role: "assistant" as const,
    content:
      "I'm working on the checkout flow now. I've started by analyzing the existing cart component...",
    status: "streaming" as const,
    createdAt: Date.now() - 1000,
  },
];

const MESSAGES_WITH_ERROR = [
  {
    _id: "msg-1",
    role: "user" as const,
    content: "Fix the build error",
    status: "complete" as const,
    createdAt: Date.now() - 10000,
  },
  {
    _id: "msg-2",
    role: "assistant" as const,
    content: "I encountered an issue while trying to fix the build error.",
    status: "error" as const,
    error: "Context window exceeded. Please start a new session.",
    createdAt: Date.now() - 5000,
  },
];

const MESSAGES_WITH_SYSTEM = [
  {
    _id: "msg-sys",
    role: "system" as const,
    content: "Session started — Claude is ready.",
    status: "complete" as const,
    createdAt: Date.now() - 60000,
  },
  {
    _id: "msg-1",
    role: "user" as const,
    content: "Hello Claude!",
    status: "complete" as const,
    createdAt: Date.now() - 30000,
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof ChatPanel> = {
  title: "Sandbox/ChatPanel",
  component: ChatPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "560px", display: "flex", flexDirection: "column" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ChatPanel>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Empty: Story = {
  name: "Empty — no messages",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_EMPTY,
      });
      return <Story />;
    },
  ],
};

export const WithConversation: Story = {
  name: "Active conversation",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_CONVERSATION,
      });
      return <Story />;
    },
  ],
};

export const StreamingResponse: Story = {
  name: "Assistant streaming",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_WITH_STREAMING,
      });
      return <Story />;
    },
  ],
};

export const WithError: Story = {
  name: "Message with error",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_WITH_ERROR,
      });
      return <Story />;
    },
  ],
};

export const WithSystemMessages: Story = {
  name: "Includes system messages",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_WITH_SYSTEM,
      });
      return <Story />;
    },
  ],
};

export const SessionEnded: Story = {
  name: "Session ended — input disabled",
  args: { sessionId: "sess-chat-2" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_COMPLETED,
        "sessions:getChatMessages": MESSAGES_CONVERSATION,
      });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  name: "Loading messages",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        // undefined simulates loading state
        "sessions:getChatMessages": undefined,
      });
      return <Story />;
    },
  ],
};

export const TypeMessage: Story = {
  name: "Interactive — type and send",
  args: { sessionId: "sess-chat-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_CONVERSATION,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText("Message Claude...");
    await userEvent.click(textarea);
    await userEvent.type(textarea, "Can you add TypeScript types to the API responses?");
    await expect(textarea).toHaveValue("Can you add TypeScript types to the API responses?");
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  args: { sessionId: "sess-chat-1" },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_CONVERSATION,
      });
      return <Story />;
    },
  ],
};

export const Tablet: Story = {
  name: "Tablet viewport",
  args: { sessionId: "sess-chat-1" },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_ACTIVE,
        "sessions:getChatMessages": MESSAGES_CONVERSATION,
      });
      return <Story />;
    },
  ],
};
