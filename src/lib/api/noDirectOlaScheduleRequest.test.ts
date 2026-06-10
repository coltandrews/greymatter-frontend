import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return sourceFiles(fullPath);
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      return [];
    }
    return [fullPath];
  });
}

describe("frontend Ola schedule safety", () => {
  it("does not expose direct Ola credentials or vendor API calls from browser code", () => {
    const forbidden = [
      "OLA_API_BASE_URL",
      "OLA_AUTH_TOKEN",
      "OLA_SECRET_TOKEN",
      "X-Access-Token",
      "dev-api.ola-digital-int.com",
      "/auth/tennant/login",
      "/api-v2/telehealth/service/new-schedule-request",
      "/api/vendor/ola/" + "schedule-request",
      "createVendorOla" + "ScheduleRequest",
    ];
    const publicOlaEnvPattern = /NEXT_PUBLIC_[A-Z0-9_]*OLA/;

    for (const file of sourceFiles(path.resolve(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      for (const fragment of forbidden) {
        expect(source, `${file} must not contain ${fragment}`).not.toContain(fragment);
      }
      expect(source, `${file} must not expose Ola values through NEXT_PUBLIC_*`).not.toMatch(
        publicOlaEnvPattern,
      );
    }
  });
});
