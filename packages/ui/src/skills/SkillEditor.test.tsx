import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillEditor } from "./SkillEditor";

describe("SkillEditor", () => {
  it("renders textarea with content", () => {
    render(<SkillEditor content={"line one\nline two"} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("line one\nline two");
  });

  it("renders line numbers", () => {
    render(<SkillEditor content={"a\nb\nc"} onChange={vi.fn()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders line count in footer", () => {
    render(<SkillEditor content={"a\nb\nc"} onChange={vi.fn()} />);
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });

  it("renders singular line label", () => {
    render(<SkillEditor content="single" onChange={vi.fn()} />);
    expect(screen.getByText("1 line")).toBeInTheDocument();
  });

  it("calls onChange when editing", () => {
    const onChange = vi.fn();
    render(<SkillEditor content="hello" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello world" } });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("shows Read Only label when readOnly", () => {
    render(<SkillEditor content="test" onChange={vi.fn()} readOnly />);
    expect(screen.getByText("Read Only")).toBeInTheDocument();
  });

  it("sets textarea readOnly attribute", () => {
    render(<SkillEditor content="test" onChange={vi.fn()} readOnly />);
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
  });

  it("does not show Read Only label when editable", () => {
    render(<SkillEditor content="test" onChange={vi.fn()} />);
    expect(screen.queryByText("Read Only")).not.toBeInTheDocument();
  });
});
