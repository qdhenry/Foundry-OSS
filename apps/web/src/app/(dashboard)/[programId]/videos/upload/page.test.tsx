import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/videos", () => ({
  ProgramVideoUploadRoute: () => (
    <div data-testid="shared-video-upload-route">Shared Video Upload Route</div>
  ),
}));

import VideoUploadPage from "./page";

describe("VideoUploadPage wrapper", () => {
  it("renders shared ProgramVideoUploadRoute", () => {
    render(<VideoUploadPage />);

    expect(screen.getByTestId("shared-video-upload-route")).toHaveTextContent(
      "Shared Video Upload Route",
    );
  });
});
