import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentAnalysisSuggestions } from "../DocumentAnalysisSuggestions";

// Mock convex/react
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
}));

// Mock convex generated api
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    documentAnalysis: {
      getByDocument: "documentAnalysis:getByDocument",
    },
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  FileText: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
  Plus: (props: Record<string, unknown>) => <span data-testid="icon-plus" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  Lightbulb: (props: Record<string, unknown>) => <span data-testid="icon-lightbulb" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
}));

const defaultProps = {
  documentId: "doc123" as any,
  programId: "prog123" as any,
};

describe("DocumentAnalysisSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state when analysis is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Analyzing document...")).toBeInTheDocument();
  });

  it("renders no analysis state when analysis is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("No analysis available")).toBeInTheDocument();
  });

  it("renders in-progress state when status is queued", () => {
    mockUseQuery.mockReturnValue({ status: "queued", findings: null });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Analysis in progress...")).toBeInTheDocument();
  });

  it("renders in-progress state when status is analyzing", () => {
    mockUseQuery.mockReturnValue({ status: "analyzing", findings: null });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Analysis in progress...")).toBeInTheDocument();
  });

  it("renders failed state message", () => {
    mockUseQuery.mockReturnValue({ status: "failed", findings: null });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Analysis failed. Try again.")).toBeInTheDocument();
  });

  it("renders analysis complete header with correct finding counts", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Req 1",
            description: "Desc 1",
            category: "functional",
            confidence: 0.9,
          },
        ],
        risks: [
          {
            title: "Risk 1",
            severity: "high",
            description: "Risk desc",
          },
        ],
        insights: ["Insight 1", "Insight 2"],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("AI Analysis Complete")).toBeInTheDocument();
    expect(
      screen.getByText(/Found 4 findings: 1 requirement, 1 risk, 2 insights\./),
    ).toBeInTheDocument();
  });

  it("renders suggested requirements with title, description, and badges", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Payment Integration",
            description: "Implement payment gateway",
            category: "technical",
            confidence: 0.85,
          },
        ],
        risks: [],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Payment Integration")).toBeInTheDocument();
    expect(screen.getByText("Implement payment gateway")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("technical")).toBeInTheDocument();
    expect(screen.getByText("Suggested Requirements (1)")).toBeInTheDocument();
  });

  it("renders source excerpt when provided", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Req",
            description: "Desc",
            category: "functional",
            confidence: 0.7,
            sourceExcerpt: "excerpt from document",
          },
        ],
        risks: [],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText(/excerpt from document/)).toBeInTheDocument();
  });

  it("renders risk indicators with severity badges", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [],
        risks: [
          {
            title: "Data Loss Risk",
            severity: "critical",
            description: "Potential data loss during migration",
            mitigation: "Implement backup strategy",
          },
        ],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Data Loss Risk")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("Potential data loss during migration")).toBeInTheDocument();
    expect(screen.getByText(/Implement backup strategy/)).toBeInTheDocument();
    expect(screen.getByText("Risk Indicators (1)")).toBeInTheDocument();
  });

  it("renders key insights", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [],
        risks: [],
        insights: ["System has complex integration points", "Legacy data needs transformation"],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("Key Insights (2)")).toBeInTheDocument();
    expect(screen.getByText("System has complex integration points")).toBeInTheDocument();
    expect(screen.getByText("Legacy data needs transformation")).toBeInTheDocument();
  });

  it("accept requirement button updates local state", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Req 1",
            description: "Desc 1",
            category: "functional",
            confidence: 0.9,
          },
        ],
        risks: [],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);

    const addButton = screen.getByText("Add Requirement");
    expect(addButton).toBeInTheDocument();

    await user.click(addButton);

    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.queryByText("Add Requirement")).not.toBeInTheDocument();
  });

  it("accept risk button updates local state", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [],
        risks: [
          {
            title: "Risk 1",
            severity: "high",
            description: "A risk",
          },
        ],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);

    const logButton = screen.getByText("Log as Risk");
    expect(logButton).toBeInTheDocument();

    await user.click(logButton);

    expect(screen.getByText("Logged")).toBeInTheDocument();
    expect(screen.queryByText("Log as Risk")).not.toBeInTheDocument();
  });

  it("renders correct confidence badge for low confidence", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Low Confidence Req",
            description: "Desc",
            category: "functional",
            confidence: 0.3,
          },
        ],
        risks: [],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders correct confidence badge for medium confidence", () => {
    mockUseQuery.mockReturnValue({
      status: "complete",
      findings: {
        requirements: [
          {
            title: "Medium Confidence Req",
            description: "Desc",
            category: "functional",
            confidence: 0.6,
          },
        ],
        risks: [],
        insights: [],
      },
    });
    render(<DocumentAnalysisSuggestions {...defaultProps} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
