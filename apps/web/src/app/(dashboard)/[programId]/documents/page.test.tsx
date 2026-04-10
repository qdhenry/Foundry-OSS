import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/discovery", () => ({
  ProgramDocumentsRoute: () => (
    <div data-testid="shared-documents-route">Shared Documents Route</div>
  ),
}));

import DocumentsPage from "./page";

describe("DocumentsPage wrapper", () => {
  it("renders shared ProgramDocumentsRoute", () => {
    render(<DocumentsPage />);

    expect(screen.getByTestId("shared-documents-route")).toHaveTextContent(
      "Shared Documents Route",
    );
  });
});
