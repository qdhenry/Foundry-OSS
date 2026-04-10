import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react — MUST be before component import
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useAction: () => vi.fn(),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-test" } }),
}));

// Mock program context
vi.mock("../programs", () => ({
  useProgramContext: () => ({
    program: { name: "Test Program" },
    programId: "prog-1",
    slug: "test",
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/test/design",
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock @untitledui/icons with the named exports used by DesignPage
vi.mock("@untitledui/icons", () => ({
  Palette: () => null,
  Upload01: () => null,
  DownloadCloud01: () => null,
  Trash01: () => null,
}));

// Mock child components to isolate DesignPage
vi.mock("./DesignUploadZone", () => ({
  DesignUploadZone: () => <div data-testid="upload-zone" />,
}));

vi.mock("./DesignAnalysisPanel", () => ({
  DesignAnalysisPanel: ({ open }: { open: boolean }) =>
    open ? <div data-testid="analysis-panel" /> : null,
}));

vi.mock("./DesignTokenEditor", () => ({
  DesignTokenEditor: () => <div data-testid="token-editor" />,
}));

vi.mock("./InteractionSpecTable", () => ({
  InteractionSpecTable: () => <div data-testid="interaction-table" />,
}));

import { DesignPage } from "./DesignPage";

const MOCK_ASSETS = [
  {
    _id: "asset-1",
    name: "Homepage Screenshot",
    type: "screenshot",
    status: "analyzed",
    fileUrl: null,
  },
  { _id: "asset-2", name: "Design Tokens", type: "tokens", status: "uploaded", fileUrl: null },
];

describe("DesignPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty arrays so page is not loading
    mockUseQuery.mockReturnValue([]);
  });

  it("renders empty state when no assets and no token sets", () => {
    mockUseQuery.mockReturnValue([]);
    render(<DesignPage />);
    expect(screen.getByText("No design assets yet")).toBeInTheDocument();
  });

  it("renders gallery with assets when assets are returned", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "designAssets:listByProgram") return MOCK_ASSETS;
      return [];
    });
    render(<DesignPage />);
    expect(screen.getByText("Homepage Screenshot")).toBeInTheDocument();
    expect(screen.getByText("Design Tokens")).toBeInTheDocument();
  });

  it("toggles from gallery to hierarchy view and back", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "designAssets:listByProgram") return MOCK_ASSETS;
      return [];
    });

    render(<DesignPage />);

    // Start in gallery view — asset names visible
    expect(screen.getByText("Homepage Screenshot")).toBeInTheDocument();

    // Click Hierarchy button
    await user.click(screen.getByRole("button", { name: "Hierarchy" }));
    expect(screen.getByText(/Hierarchy view coming soon/)).toBeInTheDocument();

    // Click Gallery button to go back
    await user.click(screen.getByRole("button", { name: "Gallery" }));
    expect(screen.getByText("Homepage Screenshot")).toBeInTheDocument();
  });

  it("renders delete button on asset cards", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "designAssets:listByProgram") return MOCK_ASSETS;
      return [];
    });

    render(<DesignPage />);
    const deleteButtons = screen.getAllByTitle("Delete asset");
    expect(deleteButtons.length).toBe(MOCK_ASSETS.length);
  });

  it("renders analyzing spinner for assets with status analyzing", () => {
    const analyzingAssets = [
      {
        _id: "asset-3",
        name: "Analyzing Asset",
        type: "screenshot",
        status: "analyzing",
        fileUrl: null,
      },
    ];
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "designAssets:listByProgram") return analyzingAssets;
      return [];
    });

    render(<DesignPage />);
    // The "analyzing" badge text should be visible
    expect(screen.getByText("analyzing")).toBeInTheDocument();
  });

  it("shows loading state when useQuery returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<DesignPage />);
    // When undefined, assetCount/tokenCount default to 0 and isEmpty = true
    // The header subtitle shows the upload prompt
    expect(
      screen.getByText("Upload screenshots and design files to build your design context"),
    ).toBeInTheDocument();
  });
});
