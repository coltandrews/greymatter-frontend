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
  it("does not expose direct schedule-request calls from browser code", () => {
    const forbidden = [
      "/api/vendor/ola/" + "schedule-request",
      "createVendorOla" + "ScheduleRequest",
    ];

    for (const file of sourceFiles(path.resolve(process.cwd(), "src"))) {
      const source = readFileSync(file, "utf8");
      for (const fragment of forbidden) {
        expect(source, `${file} must not contain ${fragment}`).not.toContain(fragment);
      }
    }
  });
});
