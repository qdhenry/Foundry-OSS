/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { vi } from "vitest";

// Deterministic UUIDs for testing
let uuidCounter = 0;
const mockSandboxBackend = {
  getTerminalConnectionInfo: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
    wsUrl: "ws://localhost:3000/sandbox-terminal",
    token: "test-token",
    sandboxId: sessionId,
  })),
  listFiles: vi.fn(async () => ({ cwd: "/workspace", entries: [] })),
  readFile: vi.fn(async ({ path }: { path: string }) => ({ path, content: "" })),
  writeFile: vi.fn(async () => null),
  sendChatMessage: vi.fn(async () => null),
  cancelSession: vi.fn(async () => null),
  restartSession: vi.fn(async () => null),
};

vi.stubGlobal(
  "crypto",
  Object.assign({}, globalThis.crypto, {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  }),
);

// Reset UUID counter between tests
beforeEach(() => {
  uuidCounter = 0;
});

// Stub backend package exports so sandbox components can run in isolation.
vi.mock("@foundry/ui/backend", () => ({
  SandboxBackendProvider: ({ children }: { children: ReactNode }) => children,
  useSandboxBackend: () => mockSandboxBackend,
}));

vi.mock("@/lib/sandboxBackendContext", () => ({
  SandboxBackendProvider: ({ children }: { children: ReactNode }) => children,
  useSandboxBackend: () => mockSandboxBackend,
}));

// Stub convex/react hooks
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  useQuery: () => undefined,
  useConvex: () => ({
    query: vi.fn(),
    mutation: vi.fn(),
    action: vi.fn(),
  }),
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));

// Stub @clerk/nextjs
vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
  useUser: () => ({ user: { id: "user_test" } }),
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@clerk/clerk-react", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
  useUser: () => ({ user: { id: "user_test" } }),
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
}));
