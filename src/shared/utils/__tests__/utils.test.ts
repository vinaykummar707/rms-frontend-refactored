import { describe, it, expect, vi } from "vitest";
import { fetchTransliteration } from "../transliteration";
import {
  getBitmapColumns,
  getBitmapHeight,
  getColumnsByBoard,
  ensureNumber,
} from "../measurements";

describe("Shared Utility Functions", () => {
  it("fetches transliteration suggestions using fetch API", async () => {
    // Mock global fetch
    const mockResponse = ["SUCCESS", [["Bangalore", ["ಬೆಂಗಳೂರು", "ಬೆಂಗಳೂರು"]]]];
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    } as any);

    const results = await fetchTransliteration("Bangalore", "kn");
    expect(results).toContain("ಬೆಂಗಳೂರು");
  });

  it("calculates bitmap column count accurately from multiline string", () => {
    const bitmap = "10101\n01010\n11111";
    expect(getBitmapColumns(bitmap)).toBe(5);
    expect(getBitmapHeight(bitmap)).toBe(3);
  });

  it("resolves board column width based on signboard type", () => {
    expect(getColumnsByBoard("front", "single", 112)).toBe(112);
    expect(getColumnsByBoard("side", "two")).toBe(96);
    expect(getColumnsByBoard("rear", "single")).toBe(96);
  });

  it("ensures valid numeric values with fallbacks", () => {
    expect(ensureNumber("42", 10)).toBe(42);
    expect(ensureNumber(undefined, 16)).toBe(16);
    expect(ensureNumber("invalid", 8)).toBe(8);
  });
});
