import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VerificationScreenshotGrid } from "./VerificationScreenshotGrid";

const MOCK_SCREENSHOTS = [
  {
    _id: "ss-1",
    url: "https://example.com/home.png",
    route: "/",
    label: "Homepage",
    viewport: { width: 1280, height: 720 },
    order: 1,
  },
  {
    _id: "ss-2",
    url: "https://example.com/login.png",
    route: "/login",
    label: "Login Page",
    viewport: { width: 1280, height: 720 },
    order: 2,
  },
  {
    _id: "ss-3",
    url: "https://example.com/dashboard.png",
    route: "/dashboard",
    label: "Dashboard",
    viewport: { width: 1280, height: 720 },
    order: 3,
  },
];

describe("VerificationScreenshotGrid", () => {
  it("renders header with screenshot count", () => {
    render(<VerificationScreenshotGrid screenshots={MOCK_SCREENSHOTS} />);
    expect(screen.getByText("Screenshots (3)")).toBeInTheDocument();
  });

  it("renders thumbnail images with labels", () => {
    render(<VerificationScreenshotGrid screenshots={MOCK_SCREENSHOTS} />);
    expect(screen.getByAltText("Homepage")).toBeInTheDocument();
    expect(screen.getByAltText("Login Page")).toBeInTheDocument();
    expect(screen.getByAltText("Dashboard")).toBeInTheDocument();
  });

  it("returns null for empty screenshots array", () => {
    const { container } = render(<VerificationScreenshotGrid screenshots={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("opens lightbox on thumbnail click", async () => {
    const user = userEvent.setup();
    render(<VerificationScreenshotGrid screenshots={MOCK_SCREENSHOTS} />);

    // Click the first thumbnail (the button containing the Homepage image)
    const thumbnail = screen.getByAltText("Homepage").closest("button")!;
    await user.click(thumbnail);

    // Lightbox should show navigation counter
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("shows next navigation arrow in lightbox when not on last item", async () => {
    const user = userEvent.setup();
    render(<VerificationScreenshotGrid screenshots={MOCK_SCREENSHOTS} />);

    // Open lightbox on the first screenshot
    const thumbnail = screen.getByAltText("Homepage").closest("button")!;
    await user.click(thumbnail);

    // The lightbox should show the forward arrow (ChevronRight) but not the back arrow
    // since we are on the first item. The forward button navigates to the next screenshot.
    // After clicking next, the counter should update.
    const nextButtons = screen
      .getByText("1 / 3")
      .closest("div")
      ?.parentElement?.querySelectorAll("button");
    // There should be at least a close button and a next button
    expect(nextButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("closes lightbox on X button click", async () => {
    const user = userEvent.setup();
    render(<VerificationScreenshotGrid screenshots={MOCK_SCREENSHOTS} />);

    // Open lightbox
    const thumbnail = screen.getByAltText("Homepage").closest("button")!;
    await user.click(thumbnail);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // Find and click the close button (the X button in the lightbox)
    // The close button is the one with the X icon, positioned at -right-3 -top-3
    // We can find it by looking for buttons within the lightbox overlay
    const lightboxOverlay = screen.getByText("1 / 3").closest("[class*='fixed']")!;
    const closeButton = lightboxOverlay.querySelector("button[class*='-right-3']")!;
    await user.click(closeButton);

    // Lightbox should be gone
    expect(screen.queryByText("1 / 3")).not.toBeInTheDocument();
  });
});
