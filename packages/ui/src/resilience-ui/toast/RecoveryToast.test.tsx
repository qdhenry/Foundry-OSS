import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecoveryToast } from "./RecoveryToast";

describe("RecoveryToast", () => {
  it("renders service display name with restored text", () => {
    render(<RecoveryToast service="convex" />);
    expect(screen.getByText("Database restored")).toBeInTheDocument();
  });

  it("renders github service display name", () => {
    render(<RecoveryToast service="github" />);
    expect(screen.getByText("GitHub restored")).toBeInTheDocument();
  });
});
