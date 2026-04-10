import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/videos", () => ({
  ProgramVideosRoute: () => <div data-testid="shared-videos-route">Shared Videos Route</div>,
}));

import VideosPage from "./page";

describe("VideosPage wrapper", () => {
  it("renders shared ProgramVideosRoute", () => {
    render(<VideosPage />);

    expect(screen.getByTestId("shared-videos-route")).toHaveTextContent("Shared Videos Route");
  });
});
