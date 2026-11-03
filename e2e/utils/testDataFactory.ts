/**
 * Test Data Factory
 * Generates valid, schema-compliant test entities for deterministic E2E test runs.
 */

export class TestDataFactory {
  private static getTimestamp(): string {
    return Date.now().toString().slice(-6);
  }

  private static getRandomDigits(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  }

  /**
   * Generates a unique organization name complying with regex: /^[a-zA-Z0-9\s&.,'_-]+$/
   */
  static organizationName(prefix = "AutoOrg"): string {
    return `${prefix} ${this.getTimestamp()}`;
  }

  /**
   * Generates a valid corporate email
   */
  static email(prefix = "testuser"): string {
    return `${prefix}_${this.getTimestamp()}@transport.gov.in`;
  }

  /**
   * Generates a valid 10-digit Indian phone number starting with 9, 8, 7, or 6
   */
  static phone(): string {
    return `9${this.getRandomDigits(9)}`;
  }

  /**
   * Generates a strong password compliant with:
   * /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/
   */
  static password(): string {
    return "Navitronix@Test2026!";
  }

  /**
   * Generates a unique region name
   */
  static regionName(prefix = "Region"): string {
    return `${prefix} ${this.getTimestamp()}`;
  }

  /**
   * Generates a unique depot name
   */
  static depotName(prefix = "Depot"): string {
    return `${prefix} ${this.getTimestamp()}`;
  }

  /**
   * Generates a unique route number
   */
  static routeNumber(prefix = "R"): string {
    return `${prefix}-${this.getTimestamp()}`;
  }

  /**
   * Generates a complete test organization payload
   */
  static organizationPayload() {
    return {
      name: this.organizationName(),
      email: this.email("corp_admin"),
      phone: this.phone(),
      region: this.regionName(),
      depot: this.depotName(),
      adminEmail: this.email("stu_admin"),
      adminPassword: this.password(),
    };
  }

  /**
   * Generates a complete test route payload
   */
  static routePayload() {
    return {
      routeNumber: this.routeNumber("500"),
      source: "CENTRAL STATION",
      destination: "AIRPORT TERMINAL",
      via: "TECH PARK",
    };
  }
}

