import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillEditor } from "./SkillEditor";

describe("SkillEditor", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockReset();
  });

  it("renders content in textarea", () => {
    render(<SkillEditor content={"line one\nline two"} onChange={mockOnChange} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("line one\nline two");
  });

  it("renders line numbers", () => {
    render(<SkillEditor content={"first\nsecond\nthird"} onChange={mockOnChange} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows line count in footer", () => {
    render(<SkillEditor content={"a\nb\nc\nd"} onChange={mockOnChange} />);
    expect(screen.getByText("4 lines")).toBeInTheDocument();
  });

  it("shows singular 'line' for single line", () => {
    render(<SkillEditor content="single" onChange={mockOnChange} />);
    expect(screen.getByText("1 line")).toBeInTheDocument();
  });

  it("calls onChange when user types", () => {
    render(<SkillEditor content="hello" onChange={mockOnChange} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(mockOnChange).toHaveBeenCalledWith("hello world");
  });

  it("shows Read Only label when readOnly is true", () => {
    render(<SkillEditor content="test" onChange={mockOnChange} readOnly />);
    expect(screen.getByText("Read Only")).toBeInTheDocument();
  });

  it("does not show Read Only label when readOnly is false", () => {
    render(<SkillEditor content="test" onChange={mockOnChange} />);
    expect(screen.queryByText("Read Only")).not.toBeInTheDocument();
  });

  it("makes textarea readOnly when prop is set", () => {
    render(<SkillEditor content="test" onChange={mockOnChange} readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("readonly");
  });
});
