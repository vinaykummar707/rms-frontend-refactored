/**
 * E2E Test Environment Configuration
 * Centralizes all test URLs, timeouts, API endpoints, and test credentials.
 */

export const testEnv = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:9092",
  supabaseUrl: process.env.VITE_SUPABASE_URL || "https://supabase.navitronix.in",
  supabaseAnonKey:
    process.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU4MzkzMDAwLCJleHAiOjE5MTYxNTk0MDB9.ndWaEbKzxiLYhEvyBugDAsPFRhMhgi26g0PBk1alXyU",
  bitmapApiUrl: process.env.VITE_BITMAP_API_URL || "http://localhost:5288/api/bitmap",
  controllerApiUrl:
    process.env.VITE_CONTROLLER_API_URL || "https://api.navitronix.in/navitranix/api",

  // Default Test Accounts for multi-role verification
  credentials: {
    superAdmin: {
      email: process.env.TEST_SUPER_ADMIN_EMAIL || "superadmin@navitronix.in",
      password: process.env.TEST_SUPER_ADMIN_PASSWORD || "Navitronix@2026",
    },
    orgAdmin: {
      email: process.env.TEST_ORG_ADMIN_EMAIL || "orgadmin@ksrtc.gov.in",
      password: process.env.TEST_ORG_ADMIN_PASSWORD || "Navitronix@2026",
    },
    depotAdmin: {
      email: process.env.TEST_DEPOT_ADMIN_EMAIL || "depotadmin@ksrtc.gov.in",
      password: process.env.TEST_DEPOT_ADMIN_PASSWORD || "Navitronix@2026",
    },
    regularCustomer: {
      email: process.env.TEST_REGULAR_CUSTOMER_EMAIL || "client@fleetops.com",
      password: process.env.TEST_REGULAR_CUSTOMER_PASSWORD || "Navitronix@2026",
    },
    inactiveUser: {
      email: "inactive.user@navitronix.in",
      password: "InactivePassword@123",
    },
  },

  timeouts: {
    action: 10_000,
    navigation: 20_000,
    networkIdle: 15_000,
    toastWait: 5_000,
  },
};

