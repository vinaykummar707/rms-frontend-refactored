import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { MockApiHelpers } from "../utils/mockApiHelpers";
import { TestDataFactory } from "../utils/testDataFactory";
import { testEnv } from "../config/testEnv";

export interface CustomFixtures {
  loginPage: LoginPage;
  mockApis: typeof MockApiHelpers;
  testData: typeof TestDataFactory;
  authenticateAs: (
    role: "superAdmin" | "orgAdmin" | "depotAdmin" | "regularCustomer"
  ) => Promise<void>;
}

export const test = base.extend<CustomFixtures>({
  // Injected LoginPage Page Object
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // Injected Mock API Helpers
  mockApis: async ({ page }, use) => {
    // Automatically apply standard mocks for hardware & bitmap APIs
    await MockApiHelpers.setupStandardMocks(page);
    await use(MockApiHelpers);
  },

  // Injected Test Data Factory
  testData: async ({}, use) => {
    await use(TestDataFactory);
  },

  // Helper fixture to sign in as any predefined role
  authenticateAs: async ({ page, loginPage }, use) => {
    const loginRole = async (
      role: "superAdmin" | "orgAdmin" | "depotAdmin" | "regularCustomer"
    ) => {
      const creds = testEnv.credentials[role];
      await loginPage.goto();
      await loginPage.login(creds.email, creds.password);
      await loginPage.waitForSessionValidation();
    };

    await use(loginRole);
  },
});

export { expect };

