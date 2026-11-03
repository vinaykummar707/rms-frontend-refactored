import type { Page } from "@playwright/test";

/**
 * Mock API Helpers
 * Intercepts external backend calls (Bitmap Font API, Controller Export API, etc.)
 * allowing tests to run deterministically without external infrastructure dependencies.
 */
export class MockApiHelpers {
  /**
   * Mocks the external C# Bitmap API (port 5288)
   * Returns a valid 16-row 2D bitmap matrix matching the format expected by bitmapService.ts
   */
  static async mockBitmapApi(page: Page) {
    await page.route("**/api/bitmap**", async (route) => {
      // Generate a mock 16-row binary matrix of '1's and '0's
      const mockBitmap = Array.from({ length: 16 }, () =>
        "10101010101010101010101010101010"
      ).join("\n");

      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: mockBitmap,
      });
    });
  }

  /**
   * Mocks the hardware destination controller export API
   * Returns a mock ZIP file stream to verify export downloads
   */
  static async mockControllerExportApi(page: Page) {
    await page.route("**/navitranix/api/**", async (route) => {
      // Minimal valid ZIP binary header
      const mockZipBuffer = Buffer.from([
        0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);

      await route.fulfill({
        status: 200,
        contentType: "application/zip",
        headers: {
          "Content-Disposition": 'attachment; filename="route_export.zip"',
        },
        body: mockZipBuffer,
      });
    });
  }

  /**
   * Mocks Google / Sarvam transliteration API
   */
  static async mockTransliterationApi(page: Page) {
    await page.route("**/inputtools.google.com/**", async (route) => {
      const mockResponse = [
        "SUCCESS",
        [["Bengaluru", ["ಬೆಂಗಳೂರು", "बेंगलुरु"]]],
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockResponse),
      });
    });
  }

  /**
   * Mocks a rejected login response from Supabase Auth
   */
  static async mockAuthInvalidCredentials(page: Page, message = "Invalid login credentials") {
    await page.route("**/auth/v1/token?grant_type=password*", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: message,
          msg: message,
        }),
      });
    });
  }

  /**
   * Setup all standard external mocks in one call
   */
  static async setupStandardMocks(page: Page) {
    await this.mockBitmapApi(page);
    await this.mockControllerExportApi(page);
    await this.mockTransliterationApi(page);
  }
}
