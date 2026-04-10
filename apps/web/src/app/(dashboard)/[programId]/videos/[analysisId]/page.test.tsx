import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/videos", () => ({
  ProgramVideoDetailRoute: () => (
    <div data-testid="shared-video-detail-route">Shared Video Detail Route</div>
  ),
}));

import VideoAnalysisDetailPage from "./page";

describe("VideoAnalysisDetailPage wrapper", () => {
  it("renders shared ProgramVideoDetailRoute", () => {
    render(<VideoAnalysisDetailPage />);

    expect(screen.getByTestId("shared-video-detail-route")).toHaveTextContent(
      "Shared Video Detail Route",
    );
  });
});
