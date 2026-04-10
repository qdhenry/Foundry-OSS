import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";

let mockSession: any;
let mockMessages: any;
const mockSendMessage = vi.fn();

vi.mock("@foundry/ui/backend", () => ({
  useSandboxBackend: () => ({
    sendChatMessage: mockSendMessage,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (fnRef: any, args: any) => {
    if (args === "skip") return undefined;
    const fnStr = String(fnRef);
    if (fnStr.includes("getChatMessages")) return mockMessages;
    return mockSession;
  },
}));

// Mock scrollIntoView for jsdom
Element.prototype.scrollIntoView = vi.fn();

describe("ChatPanel", () => {
  beforeEach(() => {
    mockSession = { status: "executing", claudeSessionId: "cs-123" };
    mockMessages = [];
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue(undefined);
  });

  it("shows loading state when messages are undefined", () => {
    mockMessages = undefined;
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    mockMessages = [];
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Send a message to interact with Claude")).toBeInTheDocument();
  });

  it("renders user and assistant messages", () => {
    mockMessages = [
      {
        _id: "m1",
        role: "user",
        content: "Hello Claude",
        status: "complete",
        createdAt: Date.now(),
      },
      {
        _id: "m2",
        role: "assistant",
        content: "Hi there!",
        status: "complete",
        createdAt: Date.now(),
      },
    ];
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Hello Claude")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("renders system messages with centered style", () => {
    mockMessages = [
      {
        _id: "m1",
        role: "system",
        content: "Session started",
        status: "complete",
        createdAt: Date.now(),
      },
    ];
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Session started")).toBeInTheDocument();
  });

  it("shows streaming indicator for assistant message", () => {
    mockMessages = [
      {
        _id: "m1",
        role: "assistant",
        content: "Working...",
        status: "streaming",
        createdAt: Date.now(),
      },
    ];
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Generating...")).toBeInTheDocument();
    expect(screen.getByText("Claude is thinking...")).toBeInTheDocument();
  });

  it("shows error on message with error status", () => {
    mockMessages = [
      {
        _id: "m1",
        role: "assistant",
        content: "Failed",
        status: "error",
        error: "Timeout",
        createdAt: Date.now(),
      },
    ];
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText("Timeout")).toBeInTheDocument();
  });

  it("shows session ended message when terminal", () => {
    mockSession = { status: "completed" };
    mockMessages = [];
    render(<ChatPanel sessionId="s-1" />);
    expect(
      screen.getByText("Session has ended. No more messages can be sent."),
    ).toBeInTheDocument();
  });

  it("sends message on Enter key", async () => {
    const user = userEvent.setup();
    render(<ChatPanel sessionId="s-1" />);
    const textarea = screen.getByPlaceholderText("Message Claude...");
    await user.type(textarea, "Hello{Enter}");
    expect(mockSendMessage).toHaveBeenCalledWith({
      sessionId: "s-1",
      content: "Hello",
      role: "user",
    });
  });

  it("does not send empty message", async () => {
    const user = userEvent.setup();
    render(<ChatPanel sessionId="s-1" />);
    const sendButton = screen.getByTitle("Send message");
    await user.click(sendButton);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("shows claude session ID header when available", () => {
    mockSession = { status: "executing", claudeSessionId: "cs-abc-123" };
    render(<ChatPanel sessionId="s-1" />);
    expect(screen.getByText(/cs-abc-123/)).toBeInTheDocument();
  });
});
