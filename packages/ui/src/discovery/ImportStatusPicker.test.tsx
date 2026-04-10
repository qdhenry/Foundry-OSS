import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImportStatusPicker } from "./ImportStatusPicker";

describe("ImportStatusPicker", () => {
  it("renders label text", () => {
    render(<ImportStatusPicker value="draft" onChange={vi.fn()} />);
    expect(screen.getByText("Import as")).toBeInTheDocument();
  });

  it("renders all status options", () => {
    render(<ImportStatusPicker value="draft" onChange={vi.fn()} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Deferred")).toBeInTheDocument();
  });

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    render(<ImportStatusPicker value="draft" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "active" },
    });
    expect(onChange).toHaveBeenCalledWith("active");
  });

  it("respects disabled prop", () => {
    render(<ImportStatusPicker value="draft" onChange={vi.fn()} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
