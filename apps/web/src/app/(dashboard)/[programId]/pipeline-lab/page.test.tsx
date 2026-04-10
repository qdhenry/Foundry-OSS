import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@foundry/ui/pipeline-lab", () => ({
  ProgramPipelineLabRoute: () => (
    <div data-testid="shared-pipeline-lab-route">Shared Pipeline Lab Route</div>
  ),
}));

import ProgramPipelineLabPage from "./page";

describe("ProgramPipelineLabPage wrapper", () => {
  it("renders shared ProgramPipelineLabRoute", () => {
    render(<ProgramPipelineLabPage />);

    expect(screen.getByTestId("shared-pipeline-lab-route")).toHaveTextContent(
      "Shared Pipeline Lab Route",
    );
  });
});
