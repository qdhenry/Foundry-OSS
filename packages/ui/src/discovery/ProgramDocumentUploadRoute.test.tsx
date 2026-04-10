import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ProgramDocumentsRoute", () => ({
  ProgramDocumentsRoute: () => <div data-testid="documents-route">Documents</div>,
}));

import { ProgramDocumentUploadRoute } from "./ProgramDocumentUploadRoute";

describe("ProgramDocumentUploadRoute", () => {
  it("renders ProgramDocumentsRoute", () => {
    render(<ProgramDocumentUploadRoute />);
    expect(screen.getByTestId("documents-route")).toBeInTheDocument();
  });
});
