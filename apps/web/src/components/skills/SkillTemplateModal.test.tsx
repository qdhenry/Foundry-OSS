import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillTemplateModal } from "./SkillTemplateModal";

const mockPush = vi.fn();
const mockForkTemplate = vi.fn();

const mockTemplates = [
  {
    id: "tpl-1",
    name: "API Integration",
    description: "Standard API integration skill",
    domain: "backend",
    lineCount: 120,
  },
  {
    id: "tpl-2",
    name: "UI Component",
    description: "Frontend component builder",
    domain: "frontend",
    lineCount: 85,
  },
];

let queryReturn: any = mockTemplates;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
  useMutation: () => mockForkTemplate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({ slug: "my-program" }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skills: {
      listTemplates: "skills:listTemplates",
      forkTemplate: "skills:forkTemplate",
    },
  },
}));

describe("SkillTemplateModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockPush.mockReset();
    mockForkTemplate.mockReset();
    mockOnClose.mockReset();
    queryReturn = mockTemplates;
  });

  it("returns null when not open", () => {
    const { container } = render(
      <SkillTemplateModal programId="prog-1" isOpen={false} onClose={mockOnClose} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders modal header", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Skill Templates")).toBeInTheDocument();
  });

  it("renders template names", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("API Integration")).toBeInTheDocument();
    expect(screen.getByText("UI Component")).toBeInTheDocument();
  });

  it("renders domain badges", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });

  it("renders template descriptions", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("Standard API integration skill")).toBeInTheDocument();
    expect(screen.getByText("Frontend component builder")).toBeInTheDocument();
  });

  it("renders line counts", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText("120 lines")).toBeInTheDocument();
    expect(screen.getByText("85 lines")).toBeInTheDocument();
  });

  it("renders loading skeleton when templates undefined", () => {
    queryReturn = undefined;
    const { container } = render(
      <SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    // The backdrop is the first fixed inset-0 div
    const backdrop = document.querySelector(".fixed.inset-0.z-50.bg-black\\/30");
    if (backdrop) fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("renders Fork to Program buttons", () => {
    render(<SkillTemplateModal programId="prog-1" isOpen={true} onClose={mockOnClose} />);
    const forkButtons = screen.getAllByText("Fork to Program");
    expect(forkButtons).toHaveLength(2);
  });
});
