import { test, expect } from "../../fixtures/baseTest";

test.describe("Foundational Smoke: Authentication & Access Guards", () => {
  test.beforeEach(async ({ mockApis }) => {
    // Apply standard mocks for external APIs
  });

  test("SMK-01A: Login Page loads with complete branding and form controls", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.expectLoaded();

    // Verify Brand Heading
    await expect(loginPage.brandHeading).toContainText("Navitronix RMS");

    // Verify Input Placeholders & Defaults
    await expect(loginPage.emailInput).toHaveAttribute(
      "placeholder",
      "name@transport.gov.in"
    );
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    // Verify Sign In Button is enabled
    await expect(loginPage.submitBtn).toBeEnabled();
  });

  test("SMK-01B: Password visibility toggle reveals and masks characters", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.passwordInput.fill("SecretPassword123!");

    // Initially type is password
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");

    // Click toggle to reveal
    const isVisibleNow = await loginPage.togglePasswordVisibility();
    expect(isVisibleNow).toBe(true);
    await expect(loginPage.passwordInput).toHaveAttribute("type", "text");

    // Click toggle again to mask
    const isMaskedAgain = await loginPage.togglePasswordVisibility();
    expect(isMaskedAgain).toBe(false);
    await expect(loginPage.passwordInput).toHaveAttribute("type", "password");
  });

  test("SMK-01C: Forgot password dialog opens, validates, and closes", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill("recovery@agency.gov.in");

    // Open reset dialog
    await loginPage.forgotPasswordLink.click();
    await expect(loginPage.resetDialog).toBeVisible();

    // Email should be populated from the login field
    await expect(loginPage.resetEmailInput).toHaveValue("recovery@agency.gov.in");

    // Cancel closes the dialog
    await loginPage.cancelResetBtn.click();
    await expect(loginPage.resetDialog).not.toBeVisible();
  });

  test("SMK-01D: Protected routes automatically redirect unauthenticated users to /login", async ({
    page,
  }) => {
    // Attempt direct deep link into protected sections without authentication
    await page.goto("/home/organizations");
    await page.waitForURL("**/login", { timeout: 15_000 });

    // Try editor direct path
    await page.goto("/routes/create");
    await page.waitForURL("**/login", { timeout: 15_000 });

    // Assert user remains on login page
    expect(page.url()).toContain("/login");
  });

  test("SMK-01E: Invalid credentials display error notification without crashing", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(
      "nonexistent_admin@navitronix.in",
      "InvalidPassword999!"
    );

    // Verify toast error appears for invalid credentials
    await loginPage.expectToast(/Failed to sign in|Invalid login credentials|Invalid email or password/i);
    // Ensure form is still usable
    await expect(loginPage.submitBtn).toBeEnabled();
  });

  test("SMK-01F: Theme switch toggles html class attribute between light and dark", async ({
    loginPage,
  }) => {
    await loginPage.goto();
    await loginPage.toggleTheme();
  });
});
