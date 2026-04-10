import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerificationPanel } from "./VerificationPanel";

let latestReturn: any;
let checksReturn: any;
let screenshotsReturn: any;

vi.mock("convex/react", () => ({
  useQuery: (fn: string) => {
    if (fn.includes("getLatestByTask")) return latestReturn;
    if (fn.includes("getChecks")) return checksReturn;
    if (fn.includes("getScreenshots")) return screenshotsReturn;
    return undefined;
  },
  useAction: () => vi.fn(),
}));

vi.mock(
  "lucide-react",
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => {
          const component = (props: any) => (
            <span data-testid={`icon-${String(name)}`} {...props} />
          );
          component.displayName = String(name);
          return component;
        },
      },
    ),
);

vi.mock("./VerificationChecksList", () => ({
  VerificationChecksList: ({ checks }: any) => (
    <div data-testid="checks-list">{checks.length} checks</div>
  ),
}));

vi.mock("./VerificationScreenshotGrid", () => ({
  VerificationScreenshotGrid: ({ screenshots }: any) => (
    <div data-testid="screenshot-grid">{screenshots.length} screenshots</div>
  ),
}));

vi.mock("./VerificationStatusBadge", () => ({
  VerificationStatusBadge: ({ status }: any) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock("./VerificationSummary", () => ({
  VerificationSummary: () => <div data-testid="verification-summary" />,
}));

describe("VerificationPanel", () => {
  it("shows loading when latest is undefined", () => {
    latestReturn = undefined;
    checksReturn = undefined;
    screenshotsReturn = undefined;
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("Loading verification data...")).toBeInTheDocument();
  });

  it("shows empty state when latest is null", () => {
    latestReturn = null;
    checksReturn = undefined;
    screenshotsReturn = undefined;
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("No verification has been run yet.")).toBeInTheDocument();
  });

  it("shows running state for provisioning", () => {
    latestReturn = { _id: "v-1", status: "provisioning" };
    checksReturn = [];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("Provisioning verification sandbox...")).toBeInTheDocument();
  });

  it("shows running state for running", () => {
    latestReturn = { _id: "v-1", status: "running" };
    checksReturn = [];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("Running verification checks...")).toBeInTheDocument();
  });

  it("renders verification header", () => {
    latestReturn = { _id: "v-1", status: "completed" };
    checksReturn = [];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("Verification")).toBeInTheDocument();
  });

  it("renders re-verify button when not running", () => {
    latestReturn = { _id: "v-1", status: "completed" };
    checksReturn = [];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByText("Re-verify")).toBeInTheDocument();
  });

  it("hides re-verify button when running", () => {
    latestReturn = { _id: "v-1", status: "running" };
    checksReturn = [];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.queryByText("Re-verify")).not.toBeInTheDocument();
  });

  it("renders checks list when checks exist", () => {
    latestReturn = { _id: "v-1", status: "completed" };
    checksReturn = [{ status: "passed" }, { status: "failed" }];
    screenshotsReturn = [];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByTestId("checks-list")).toBeInTheDocument();
  });

  it("renders screenshot grid when screenshots exist", () => {
    latestReturn = { _id: "v-1", status: "completed" };
    checksReturn = [];
    screenshotsReturn = [{ url: "https://example.com/shot.png" }];
    render(<VerificationPanel taskId="task-1" />);
    expect(screen.getByTestId("screenshot-grid")).toBeInTheDocument();
  });
});
