import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ISandboxBackend, SandboxBackendProvider, useSandboxBackend } from "./backend";

vi.mock("convex/react", () => ({
  useConvex: () => ({
    action: vi.fn().mockResolvedValue({}),
    mutation: vi.fn().mockResolvedValue({}),
  }),
}));

describe("SandboxBackendProvider", () => {
  it("provides cloud backend by default", () => {
    function Consumer() {
      const backend = useSandboxBackend();
      return <div data-testid="has-backend">{typeof backend.sendChatMessage}</div>;
    }
    render(
      <SandboxBackendProvider>
        <Consumer />
      </SandboxBackendProvider>,
    );
    expect(screen.getByTestId("has-backend")).toHaveTextContent("function");
  });

  it("cloud backend has all required methods", () => {
    const methods: string[] = [];
    function Consumer() {
      const backend = useSandboxBackend();
      for (const key of Object.keys(backend)) {
        methods.push(key);
      }
      return <div data-testid="ok">ok</div>;
    }
    render(
      <SandboxBackendProvider>
        <Consumer />
      </SandboxBackendProvider>,
    );
    expect(methods).toContain("getTerminalConnectionInfo");
    expect(methods).toContain("listFiles");
    expect(methods).toContain("readFile");
    expect(methods).toContain("writeFile");
    expect(methods).toContain("sendChatMessage");
    expect(methods).toContain("cancelSession");
    expect(methods).toContain("restartSession");
  });

  it("accepts custom backend via prop", () => {
    const mockBackend: ISandboxBackend = {
      getTerminalConnectionInfo: vi.fn(),
      listFiles: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      sendChatMessage: vi.fn(),
      cancelSession: vi.fn(),
      restartSession: vi.fn(),
    };
    let captured: ISandboxBackend | null = null;
    function Consumer() {
      captured = useSandboxBackend();
      return <div data-testid="custom">ok</div>;
    }
    render(
      <SandboxBackendProvider backend={mockBackend}>
        <Consumer />
      </SandboxBackendProvider>,
    );
    expect(screen.getByTestId("custom")).toBeInTheDocument();
    expect(captured).toBe(mockBackend);
  });

  it("throws when useSandboxBackend called outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function BadConsumer() {
      useSandboxBackend();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      "useSandboxBackend must be used within a SandboxBackendProvider",
    );
    spy.mockRestore();
  });
});
