import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxTerminal } from "./SandboxTerminal";

const mockGetTerminalConnectionInfo = vi.fn();
const terminalCtorSpy = vi.fn();
const fitAddonCtorSpy = vi.fn();
let throwOnTerminalConstruct: Error | null = null;

let terminalInstance: {
  cols: number;
  rows: number;
  loadAddon: (...args: unknown[]) => unknown;
  open: (...args: unknown[]) => unknown;
  focus: (...args: unknown[]) => unknown;
  write: (...args: unknown[]) => unknown;
  writeln: (...args: unknown[]) => unknown;
  onData: ReturnType<typeof vi.fn>;
  onResize: ReturnType<typeof vi.fn>;
  dispose: (...args: unknown[]) => unknown;
};

vi.mock("../backend", () => ({
  useSandboxBackend: () => ({
    getTerminalConnectionInfo: mockGetTerminalConnectionInfo,
  }),
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class MockTerminal {
    cols = 120;
    rows = 32;

    constructor(options?: unknown) {
      terminalCtorSpy(options);
      if (throwOnTerminalConstruct) {
        throw throwOnTerminalConstruct;
      }
      this.cols = terminalInstance.cols;
      this.rows = terminalInstance.rows;
    }

    loadAddon = (...args: unknown[]) => terminalInstance.loadAddon(...args);
    open = (...args: unknown[]) => terminalInstance.open(...args);
    focus = (...args: unknown[]) => terminalInstance.focus(...args);
    write = (...args: unknown[]) => terminalInstance.write(...args);
    writeln = (...args: unknown[]) => terminalInstance.writeln(...args);
    onData = (...args: unknown[]) =>
      (terminalInstance.onData as (...innerArgs: unknown[]) => unknown)(...args);
    onResize = (...args: unknown[]) =>
      (terminalInstance.onResize as (...innerArgs: unknown[]) => unknown)(...args);
    dispose = (...args: unknown[]) => terminalInstance.dispose(...args);
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class MockFitAddon {
    constructor() {
      fitAddonCtorSpy();
    }

    fit = vi.fn();
  },
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  binaryType = "";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = MockWebSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSING;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({
      code: 1000,
      reason: "closed",
      wasClean: true,
    } as CloseEvent);
  });

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    }, 0);
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

function decodeSentInput(payload: unknown): string {
  if (ArrayBuffer.isView(payload)) {
    const view = payload as ArrayBufferView;
    return new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  }
  if (payload instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(payload));
  }
  return "";
}

describe("SandboxTerminal", () => {
  beforeEach(() => {
    mockGetTerminalConnectionInfo.mockReset();
    terminalCtorSpy.mockReset();
    fitAddonCtorSpy.mockReset();
    throwOnTerminalConstruct = null;
    MockWebSocket.reset();

    mockGetTerminalConnectionInfo.mockResolvedValue({
      wsUrl: "ws://localhost:4567/terminal",
      token: "token-123",
      sandboxId: "sandbox-1",
    });

    terminalInstance = {
      cols: 120,
      rows: 32,
      loadAddon: vi.fn(),
      open: vi.fn(),
      focus: vi.fn(),
      write: vi.fn(),
      writeln: vi.fn(),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onResize: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    };

    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  it("lazily initializes xterm only after connect is clicked", async () => {
    const user = userEvent.setup();
    render(<SandboxTerminal sessionId="session-1" />);

    expect(terminalCtorSpy).not.toHaveBeenCalled();
    expect(fitAddonCtorSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(mockGetTerminalConnectionInfo).toHaveBeenCalledWith({
        sessionId: "session-1",
      });
    });
    await waitFor(() => {
      expect(terminalCtorSpy).toHaveBeenCalledTimes(1);
      expect(fitAddonCtorSpy).toHaveBeenCalledTimes(1);
    });
    expect(terminalCtorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        convertEol: true,
      }),
    );
  });

  it("shows a non-crashing error when terminal initialization fails", async () => {
    const user = userEvent.setup();
    throwOnTerminalConstruct = new Error("Interactive terminal unavailable");

    render(<SandboxTerminal sessionId="session-1" />);
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Interactive terminal unavailable")).toBeInTheDocument();
  });

  it("uses websocket PTY stream for input, resize, and output", async () => {
    const user = userEvent.setup();
    render(<SandboxTerminal sessionId="session-1" />);

    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toBe("ws://localhost:4567/terminal?token=token-123&cols=120&rows=32");

    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();

    const onDataHandler = terminalInstance.onData.mock.calls[0]?.[0] as
      | ((value: string) => void)
      | undefined;
    const onResizeHandler = terminalInstance.onResize.mock.calls[0]?.[0] as
      | ((size: { cols: number; rows: number }) => void)
      | undefined;

    expect(onDataHandler).toBeTypeOf("function");
    expect(onResizeHandler).toBeTypeOf("function");

    onDataHandler?.("pwd\r");
    onResizeHandler?.({ cols: 100, rows: 40 });

    const binarySendPayload = ws.send.mock.calls
      .map((call) => call[0])
      .find((value) => ArrayBuffer.isView(value) || value instanceof ArrayBuffer);
    expect(decodeSentInput(binarySendPayload)).toBe("pwd\r");
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "resize", cols: 100, rows: 40 }));

    const binaryChunk = new TextEncoder().encode("line1\r\n");
    ws.onmessage?.({ data: binaryChunk } as MessageEvent);
    expect(terminalInstance.write).toHaveBeenCalledWith(expect.any(Uint8Array));

    ws.onmessage?.({ data: "ready$ " } as MessageEvent);
    expect(terminalInstance.write).toHaveBeenCalledWith("ready$ ");

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });

  it("still connects via websocket when stale desktop-shell transport is returned", async () => {
    const user = userEvent.setup();
    mockGetTerminalConnectionInfo.mockResolvedValueOnce({
      wsUrl: "ws://localhost:4567/terminal",
      token: "token-123",
      sandboxId: "sandbox-1",
      transport: "desktop-shell",
    } as any);

    render(<SandboxTerminal sessionId="session-1" />);
    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("renders process exit payload and resets to disconnected state", async () => {
    const user = userEvent.setup();
    render(<SandboxTerminal sessionId="session-1" />);

    await user.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      ws.onmessage?.({
        data: JSON.stringify({ type: "exit", code: 0 }),
      } as MessageEvent);
    });

    expect(terminalInstance.writeln).toHaveBeenCalledWith(
      expect.stringContaining("Process exited with code 0"),
    );
    expect(await screen.findByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("renders websocket error payload as user-visible error", async () => {
    const user = userEvent.setup();
    render(<SandboxTerminal sessionId="session-1" />);

    await user.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      ws.onmessage?.({
        data: JSON.stringify({ type: "error", message: "shell failed" }),
      } as MessageEvent);
    });

    expect(await screen.findByText("shell failed")).toBeInTheDocument();
  });

  it("shows a user-facing error when websocket URL is unavailable", async () => {
    const user = userEvent.setup();
    mockGetTerminalConnectionInfo.mockResolvedValueOnce({
      wsUrl: " ",
      token: "token-123",
      sandboxId: "sandbox-1",
    });

    render(<SandboxTerminal sessionId="session-1" />);
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Terminal websocket URL is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });
});
