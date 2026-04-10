import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeploymentTimeline } from "./DeploymentTimeline";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      deployments: {
        deploymentTracking: {
          listByProgram: "sourceControl.deployments.deploymentTracking:listByProgram",
        },
      },
    },
  },
}));

const mockDeployments = [
  {
    _id: "dep-1",
    status: "success",
    environment: "production",
    sha: "abc1234567890",
    ref: "main",
    deployedBy: "dev1",
    deployedAt: Date.now() - 3600_000,
    durationMs: 180_000,
    workflowName: "deploy.yml",
  },
  {
    _id: "dep-2",
    status: "failure",
    environment: "staging",
    sha: "def5678901234",
    ref: "develop",
    deployedBy: null,
    deployedAt: Date.now() - 7200_000,
    durationMs: null,
    workflowName: null,
  },
];

describe("DeploymentTimeline", () => {
  it("shows loading text when data is undefined", () => {
    mockQueryReturn = undefined;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("Loading deployments...")).toBeInTheDocument();
  });

  it("shows empty state when no deployments", () => {
    mockQueryReturn = [];
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("No deployment data available.")).toBeInTheDocument();
  });

  it("renders deployment environment and status", () => {
    mockQueryReturn = mockDeployments;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("Deployed")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders shortened SHA", () => {
    mockQueryReturn = mockDeployments;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("def5678")).toBeInTheDocument();
  });

  it("shows deployer when available", () => {
    mockQueryReturn = mockDeployments;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("by dev1")).toBeInTheDocument();
  });

  it("shows workflow name when available", () => {
    mockQueryReturn = mockDeployments;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("deploy.yml")).toBeInTheDocument();
  });

  it("shows duration when available", () => {
    mockQueryReturn = mockDeployments;
    render(<DeploymentTimeline programId={"prog-1" as any} />);
    expect(screen.getByText("Duration: 3m")).toBeInTheDocument();
  });
});
