import { describe, expect, it } from "vitest";
import { inferAssetType } from "./useDesignUploadQueue";

describe("inferAssetType", () => {
  it("returns screenshot for png", () => {
    expect(inferAssetType("design.png", "image/png")).toBe("screenshot");
  });

  it("returns screenshot for jpg", () => {
    expect(inferAssetType("photo.jpg", "image/jpeg")).toBe("screenshot");
  });

  it("returns screenshot for webp", () => {
    expect(inferAssetType("image.webp", "image/webp")).toBe("screenshot");
  });

  it("returns prototype for gif", () => {
    expect(inferAssetType("animation.gif", "image/gif")).toBe("prototype");
  });

  it("returns prototype for mp4", () => {
    expect(inferAssetType("demo.mp4", "video/mp4")).toBe("prototype");
  });

  it("returns tokens for json", () => {
    expect(inferAssetType("tokens.json", "application/json")).toBe("tokens");
  });

  it("returns tokens for css", () => {
    expect(inferAssetType("styles.css", "text/css")).toBe("tokens");
  });

  it("returns styleGuide for md", () => {
    expect(inferAssetType("guide.md", "text/markdown")).toBe("styleGuide");
  });

  it("returns styleGuide for pdf", () => {
    expect(inferAssetType("spec.pdf", "application/pdf")).toBe("styleGuide");
  });

  it("falls back to screenshot for unknown image mime", () => {
    expect(inferAssetType("file.unknown", "image/tiff")).toBe("screenshot");
  });

  it("falls back to prototype for unknown video mime", () => {
    expect(inferAssetType("file.unknown", "video/quicktime")).toBe("prototype");
  });

  it("falls back to styleGuide for unknown extension and mime", () => {
    expect(inferAssetType("file.xyz", "application/octet-stream")).toBe("styleGuide");
  });
});
