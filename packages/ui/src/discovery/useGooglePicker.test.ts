import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGooglePicker } from "./useGooglePicker";

describe("useGooglePicker", () => {
  it("starts in idle state", () => {
    const { result } = renderHook(() =>
      useGooglePicker({
        apiKey: "test-key",
        clientId: "test-client",
        onFilesSelected: vi.fn(),
      }),
    );
    expect(result.current.pickerState).toBe("idle");
    expect(result.current.sdkError).toBeNull();
    expect(typeof result.current.openPicker).toBe("function");
  });

  it("sets sdkError when google picker is unavailable", () => {
    const { result } = renderHook(() =>
      useGooglePicker({
        apiKey: "test-key",
        clientId: "test-client",
        onFilesSelected: vi.fn(),
      }),
    );
    // Call openPicker without google.picker available
    result.current.openPicker("fake-token");
    expect(result.current.sdkError).toBe("Google Picker unavailable — use file upload instead");
  });
});
