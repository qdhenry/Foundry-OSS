import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ParsedLogMessage } from "./parseLogMessage";
import { StructuredLogMessage } from "./StructuredLogMessage";

function makeParsed(overrides: Partial<ParsedLogMessage> = {}): ParsedLogMessage {
  return {
    summary: "Tool: Read /workspace/index.ts",
    fields: [
      { key: "Type", value: "assistant", type: "badge" },
      { key: "Tool", value: "Read", type: "badge" },
      { key: "file_path", value: "/workspace/index.ts", type: "file" },
    ],
    ...overrides,
  };
}

describe("StructuredLogMessage", () => {
  it("renders the summary text", () => {
    render(<StructuredLogMessage parsed={makeParsed()} />);
    expect(screen.getByText("Tool: Read /workspace/index.ts")).toBeInTheDocument();
  });

  it("shows the 'structured' badge", () => {
    render(<StructuredLogMessage parsed={makeParsed()} />);
    expect(screen.getByText("structured")).toBeInTheDocument();
  });

  it("does not show fields when collapsed", () => {
    render(<StructuredLogMessage parsed={makeParsed()} />);
    expect(screen.queryByText("file_path")).not.toBeInTheDocument();
  });

  it("shows fields when expanded", async () => {
    const user = userEvent.setup();
    render(<StructuredLogMessage parsed={makeParsed()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Tool")).toBeInTheDocument();
    expect(screen.getByText("file_path")).toBeInTheDocument();
  });

  it("renders badge fields with badge styling", async () => {
    const user = userEvent.setup();
    render(<StructuredLogMessage parsed={makeParsed()} />);
    await user.click(screen.getByRole("button"));

    const badgeEl = screen.getByText("assistant");
    expect(badgeEl.tagName).toBe("SPAN");
    expect(badgeEl.className).toContain("font-semibold");
  });

  it("renders file fields with file icon", async () => {
    const user = userEvent.setup();
    render(<StructuredLogMessage parsed={makeParsed()} />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("/workspace/index.ts")).toBeInTheDocument();
    // File field should have an SVG icon sibling
    const fileText = screen.getByText("/workspace/index.ts");
    const svg = fileText.closest("span")?.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders code fields in a pre element", async () => {
    const user = userEvent.setup();
    const parsed = makeParsed({
      fields: [{ key: "Content", value: "const x = 1;", type: "code" }],
    });
    render(<StructuredLogMessage parsed={parsed} />);
    await user.click(screen.getByRole("button"));

    const codeEl = screen.getByText("const x = 1;");
    expect(codeEl.tagName).toBe("PRE");
  });

  it("truncates long code fields and shows 'Show more' button", async () => {
    const user = userEvent.setup();
    const longCode = "x".repeat(300);
    const parsed = makeParsed({
      fields: [{ key: "Content", value: longCode, type: "code" }],
    });
    render(<StructuredLogMessage parsed={parsed} />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Show more")).toBeInTheDocument();
    // Content should be truncated
    const preEl = screen.getByText(/^x+…$/);
    expect(preEl.textContent?.length).toBeLessThan(longCode.length);
  });

  it("expands long code on 'Show more' click", async () => {
    const user = userEvent.setup();
    const longCode = "y".repeat(300);
    const parsed = makeParsed({
      fields: [{ key: "Content", value: longCode, type: "code" }],
    });
    render(<StructuredLogMessage parsed={parsed} />);
    await user.click(screen.getByRole("button")); // expand card

    await user.click(screen.getByText("Show more"));
    expect(screen.getByText("Show less")).toBeInTheDocument();
    const preEl = screen.getByText(longCode);
    expect(preEl.textContent).toBe(longCode);
  });

  it("renders text fields with truncation for long values", async () => {
    const user = userEvent.setup();
    const longText = "z".repeat(300);
    const parsed = makeParsed({
      fields: [{ key: "Note", value: longText, type: "text" }],
    });
    render(<StructuredLogMessage parsed={parsed} />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("more")).toBeInTheDocument();
  });

  it("collapses fields on second click", async () => {
    const user = userEvent.setup();
    render(<StructuredLogMessage parsed={makeParsed()} />);

    const button = screen.getByRole("button");
    await user.click(button); // expand
    expect(screen.getByText("Type")).toBeInTheDocument();

    await user.click(button); // collapse
    expect(screen.queryByText("file_path")).not.toBeInTheDocument();
  });
});
