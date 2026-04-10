import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResilienceToaster } from "./ResilienceToaster";

vi.mock("sonner", () => ({
  Toaster: (props: any) => <div data-testid="toaster" data-position={props.position} />,
}));

describe("ResilienceToaster", () => {
  it("renders Toaster with bottom-right position", () => {
    const { getByTestId } = render(<ResilienceToaster />);
    expect(getByTestId("toaster")).toHaveAttribute("data-position", "bottom-right");
  });
});
