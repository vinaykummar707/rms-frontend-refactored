import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * LoginPage Object Model
 * Encapsulates locators and interactions for the public /login route.
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordToggleBtn: Locator;
  readonly submitBtn: Locator;
  readonly forgotPasswordLink: Locator;

  // Forgot Password Dialog
  readonly resetDialog: Locator;
  readonly resetEmailInput: Locator;
  readonly sendResetLinkBtn: Locator;
  readonly cancelResetBtn: Locator;

  // Brand and Header
  readonly brandHeading: Locator;
  readonly cardTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator("input#email");
    this.passwordInput = page.locator("input#password");
    this.passwordToggleBtn = page.locator("input#password ~ button");
    this.submitBtn = page.locator("button[type='submit']:has-text('Sign In')");
    this.forgotPasswordLink = page.locator("button:has-text('Forgot password?')");

    this.resetDialog = page.locator("div[role='dialog']:has-text('Reset Password')");
    this.resetEmailInput = page.locator("input#reset-email");
    this.sendResetLinkBtn = page.locator("button:has-text('Send Reset Link')");
    this.cancelResetBtn = page.locator("button:has-text('Cancel')");

    this.brandHeading = page.locator("h1:has-text('Navitronix RMS')");
    this.cardTitle = page.locator("div:has-text('Sign In')").first();
  }

  /**
   * Navigates directly to the login page
   */
  async goto() {
    await this.page.goto("/login");
    await this.emailInput.waitFor({ state: "visible", timeout: 15_000 });
  }

  /**
   * Fills credentials and clicks Sign In
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitBtn.click();
  }

  /**
   * Asserts all essential login elements are rendered properly
   */
  async expectLoaded() {
    await expect(this.brandHeading).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitBtn).toBeVisible();
  }

  /**
   * Triggers the Forgot Password modal, inputs email, and submits
   */
  async requestPasswordReset(email: string) {
    await this.forgotPasswordLink.click();
    await expect(this.resetDialog).toBeVisible();
    await this.resetEmailInput.fill(email);
    await this.sendResetLinkBtn.click();
  }

  /**
   * Toggles the password visibility and returns whether the type is 'text'
   */
  async togglePasswordVisibility(): Promise<boolean> {
    await this.passwordToggleBtn.click();
    const inputType = await this.passwordInput.getAttribute("type");
    return inputType === "text";
  }
}

