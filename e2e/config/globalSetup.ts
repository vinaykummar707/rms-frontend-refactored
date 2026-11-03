import { type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Global Setup for Playwright E2E Tests
 * Prepares authentication storage directories and session caches.
 */
export default async function globalSetup(_config: FullConfig) {
  const authDir = path.resolve(process.cwd(), "e2e/.auth");

  // Ensure .auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Pre-seed an empty auth state placeholder if none exists
  const dummyState = { cookies: [], origins: [] };
  const placeholderPath = path.join(authDir, "emptyState.json");
  if (!fs.existsSync(placeholderPath)) {
    fs.writeFileSync(placeholderPath, JSON.stringify(dummyState, null, 2));
  }
}

