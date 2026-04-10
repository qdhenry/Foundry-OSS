import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/discovery", () => ({
  ProgramDocumentUploadRoute: () => (
    <div data-testid="shared-document-upload-route">Shared Document Upload Route</div>
  ),
}));

import DocumentUploadPage from "./page";

describe("DocumentUploadPage wrapper", () => {
  it("renders shared ProgramDocumentUploadRoute", () => {
    render(<DocumentUploadPage />);

    expect(screen.getByTestId("shared-document-upload-route")).toHaveTextContent(
      "Shared Document Upload Route",
    );
  });
});
