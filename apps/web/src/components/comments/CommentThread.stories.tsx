import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { CommentThread } from "./CommentThread";

const mockComments = [
  {
    _id: "comment_001",
    _creationTime: Date.now() - 2 * 3600000,
    authorId: "user_alice",
    authorName: "Alice Chen",
    authorAvatarUrl: undefined,
    content:
      "This requirement needs clarification — does the account hierarchy support unlimited depth or is it capped at 3 levels?",
    parentId: undefined,
  },
  {
    _id: "comment_002",
    _creationTime: Date.now() - 1 * 3600000,
    authorId: "user_bob",
    authorName: "Bob Martinez",
    authorAvatarUrl: undefined,
    content:
      "Good question. Based on the Salesforce B2B Commerce docs, the platform supports up to 5 levels of account hierarchy natively.",
    parentId: "comment_001",
  },
  {
    _id: "comment_003",
    _creationTime: Date.now() - 30 * 60000,
    authorId: "user_alice",
    authorName: "Alice Chen",
    authorAvatarUrl: undefined,
    content: "Thanks! I'll update the requirement to specify the 5-level cap.",
    parentId: "comment_001",
  },
  {
    _id: "comment_004",
    _creationTime: Date.now() - 15 * 60000,
    authorId: "user_carol",
    authorName: "Carol Thompson",
    authorAvatarUrl: undefined,
    content:
      "Flagging for architect review — we need to validate this against the client's org structure before finalizing.",
    parentId: undefined,
  },
];

const meta: Meta<typeof CommentThread> = {
  title: "Comments/CommentThread",
  component: CommentThread,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    convex: {
      "comments.listByEntity": mockComments,
    },
  },
  args: {
    entityType: "requirement",
    entityId: "req_001",
    programId: "program_demo_001",
    orgId: "org_demo_001",
  },
};

export default meta;
type Story = StoryObj<typeof CommentThread>;

export const WithComments: Story = {
  name: "With Comments and Replies",
};

export const Empty: Story = {
  name: "Empty — No Comments Yet",
  parameters: {
    convex: {
      "comments.listByEntity": [],
    },
  },
};

export const SingleComment: Story = {
  name: "Single Top-Level Comment",
  parameters: {
    convex: {
      "comments.listByEntity": [mockComments[0]],
    },
  },
};

export const ManyComments: Story = {
  name: "Many Comments",
  parameters: {
    convex: {
      "comments.listByEntity": [
        ...mockComments,
        {
          _id: "comment_005",
          _creationTime: Date.now() - 5 * 60000,
          authorId: "user_dave",
          authorName: "Dave Kim",
          authorAvatarUrl: undefined,
          content: "Added a ticket in Jira to track this — ARCH-1042.",
          parentId: undefined,
        },
        {
          _id: "comment_006",
          _creationTime: Date.now() - 2 * 60000,
          authorId: "user_alice",
          authorName: "Alice Chen",
          authorAvatarUrl: undefined,
          content: "Linked. Will update once we have stakeholder sign-off.",
          parentId: "comment_005",
        },
      ],
    },
  },
};

export const RiskEntity: Story = {
  name: "Risk Entity Type",
  args: {
    entityType: "risk",
    entityId: "risk_001",
  },
  parameters: {
    convex: {
      "comments.listByEntity": [
        {
          _id: "comment_r01",
          _creationTime: Date.now() - 45 * 60000,
          authorId: "user_bob",
          authorName: "Bob Martinez",
          authorAvatarUrl: undefined,
          content:
            "This risk has been partially mitigated by the data validation layer we added in sprint 3.",
          parentId: undefined,
        },
      ],
    },
  },
};

export const TaskEntity: Story = {
  name: "Task Entity Type",
  args: {
    entityType: "task",
    entityId: "task_001",
  },
  parameters: {
    convex: {
      "comments.listByEntity": [
        {
          _id: "comment_t01",
          _creationTime: Date.now() - 20 * 60000,
          authorId: "user_carol",
          authorName: "Carol Thompson",
          authorAvatarUrl: undefined,
          content: "PR ready for review: github.com/acme/sf-b2b/pull/42",
          parentId: undefined,
        },
      ],
    },
  },
};

export const TypeComment: Story = {
  name: "Interactive — Type a Comment",
  parameters: {
    convex: {
      "comments.listByEntity": [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText(/add a comment/i);
    await userEvent.click(textarea);
    await userEvent.type(textarea, "This is a test comment from the Storybook play function.");
  },
};

export const ReplyFlow: Story = {
  name: "Interactive — Click Reply",
  parameters: {
    convex: {
      "comments.listByEntity": [mockComments[0]],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const replyButton = canvas.getByRole("button", { name: /reply/i });
    await userEvent.click(replyButton);
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "comments.listByEntity": mockComments,
    },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "comments.listByEntity": mockComments,
    },
  },
};
