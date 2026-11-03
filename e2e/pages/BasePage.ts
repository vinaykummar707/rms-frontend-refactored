import { type Page, type Locator, expect } from "@playwright/test";

/**
 * BasePage Object Model
 * Shared behaviors and elements present across all pages (Navigation, Header, Toasts, Modals).
 */
export class BasePage {
  readonly page: Page;
  readonly toastContainer: Locator;
  readonly header: Locator;
  readonly sidebarTrigger: Locator;
  readonly themeToggleBtn: Locator;
  readonly userMenuTrigger: Locator;
  readonly signOutMenuItem: Locator;
  readonly globalOrgSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.locator("div[role='alert']");
    this.header = page.locator("header");
    this.sidebarTrigger = page.locator("button[aria-label='Toggle sidebar'], button:has-text('Toggle Sidebar')");
    this.themeToggleBtn = page.locator("button[aria-label='Toggle theme']");
    this.userMenuTrigger = page.locator("header button.rounded-full");
    this.signOutMenuItem = page.locator("div[role='menuitem']:has-text('Sign out')");
    this.globalOrgSelector = page.locator("header button:has-text('All Organizations'), header button:has-text('Active Organization')");
  }

  /**
   * Waits for any active session verification loading spinners to disappear
   */
  async waitForSessionValidation() {
    const sessionSpinner = this.page.locator("text='Verifying session...'");
    if (await sessionSpinner.isVisible()) {
      await sessionSpinner.waitFor({ state: "hidden", timeout: 15_000 });
    }
  }

  /**
   * Asserts that a toast notification with the expected message is displayed
   */
  async expectToast(message?: string | RegExp, timeout = 10_000) {
    const toast = this.page.locator("div[role='alert']");
    if (message) {
      await expect(toast.filter({ hasText: message }).first()).toBeVisible({ timeout });
    } else {
      await expect(toast.first()).toBeVisible({ timeout });
    }
  }

  /**
   * Signs out the currently authenticated user through the UI
   */
  async signOut() {
    await this.userMenuTrigger.click();
    await this.signOutMenuItem.waitFor({ state: "visible" });
    await this.signOutMenuItem.click();
    await this.page.waitForURL("**/login", { timeout: 10_000 });
  }

  /**
   * Toggles theme and asserts class attribute on html document
   */
  async toggleTheme() {
    const html = this.page.locator("html");
    const initialClass = (await html.getAttribute("class")) || "";
    await this.themeToggleBtn.click();
    await expect(html).not.toHaveClass(initialClass);
  }

  /**
   * Takes a full-page diagnostic screenshot
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}_${Date.now()}.png`,
      fullPage: true,
    });
  }
}
