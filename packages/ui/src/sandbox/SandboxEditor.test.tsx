import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxEditor } from "./SandboxEditor";

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => {
    return function DynamicEditorMock(props: { value?: string }) {
      return <div data-testid="dynamic-editor">{props.value ?? ""}</div>;
    };
  },
}));

vi.mock("../backend", () => ({
  useSandboxBackend: () => ({
    listFiles: mocks.listFiles,
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
  }),
}));

describe("SandboxEditor", () => {
  beforeEach(() => {
    mocks.listFiles.mockReset();
    mocks.readFile.mockReset();
    mocks.writeFile.mockReset();
  });

  it("refreshes and retries opening when a file disappears due to root switch", async () => {
    const user = userEvent.setup();

    mocks.listFiles
      .mockResolvedValueOnce({
        cwd: ".",
        entries: [{ name: "spec.md", type: "file", size: 12 }],
      })
      .mockResolvedValueOnce({
        cwd: ".",
        entries: [{ name: "spec.md", type: "file", size: 12 }],
      });

    mocks.readFile
      .mockRejectedValueOnce(
        new Error("Failed to access `spec.md`: No such file or directory (os error 2)"),
      )
      .mockResolvedValueOnce({
        path: "spec.md",
        content: "# spec",
      });

    render(<SandboxEditor sessionId="session-1" editorType="codemirror" />);

    await screen.findByRole("button", { name: /\[file\]\s+spec\.md/i });
    await user.click(screen.getByRole("button", { name: /\[file\]\s+spec\.md/i }));

    await waitFor(() => {
      expect(mocks.readFile).toHaveBeenCalledTimes(2);
    });
    expect(mocks.readFile).toHaveBeenNthCalledWith(1, {
      sessionId: "session-1",
      path: "spec.md",
    });
    expect(mocks.readFile).toHaveBeenNthCalledWith(2, {
      sessionId: "session-1",
      path: "spec.md",
    });

    expect(mocks.listFiles).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("File loaded after refreshing workspace root."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed to access `spec\.md`/i)).not.toBeInTheDocument();
  });
});
