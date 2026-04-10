import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react — MUST be before component import
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useAction: () => vi.fn(),
}));

// Mock the upload queue hook so no real XHR happens in tests
vi.mock("./useDesignUploadQueue", () => ({
  useDesignUploadQueue: () => ({
    files: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    isUploading: false,
    allDone: false,
  }),
}));

import { DesignUploadZone } from "./DesignUploadZone";

const BASE_PROPS = {
  orgId: "org-test",
  programId: "prog-1",
};

describe("DesignUploadZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the drag and drop text", () => {
    render(<DesignUploadZone {...BASE_PROPS} />);
    expect(screen.getByText("Drag and drop design assets, or click to browse")).toBeInTheDocument();
  });

  it("renders file type hints with PNG and JPG", () => {
    render(<DesignUploadZone {...BASE_PROPS} />);
    const hint = screen.getByText(/PNG, JPG/);
    expect(hint).toBeInTheDocument();
  });

  it("applies drag-active styles when dragOver event fires", () => {
    render(<DesignUploadZone {...BASE_PROPS} />);

    // The drop zone is the outer div wrapping the text
    const dropZone = screen
      .getByText("Drag and drop design assets, or click to browse")
      .closest("div[class*='rounded-xl']");
    expect(dropZone).toBeTruthy();

    // Simulate dragOver — this sets isDragging=true
    fireEvent.dragOver(dropZone as Element, {
      dataTransfer: { files: [] },
    });

    // After dragOver the zone should have the active border class
    expect(dropZone).toHaveClass("border-accent-default");
  });
});
