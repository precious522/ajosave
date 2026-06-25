/**
 * Security test: verify STELLAR_SECRET_KEY is never embedded in CLI argument strings.
 * Closes #500.
 */

import * as fs from "fs";
import * as path from "path";

const SOROBAN_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../lib/soroban.ts"),
  "utf-8"
);

const DEPLOY_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../../scripts/deploy-contract.ts"),
  "utf-8"
);

describe("Issue #500 – secret key not in CLI args", () => {
  it("soroban.ts does not pass secret key as --source in execSync string", () => {
    // The old pattern interpolated sourceKey directly into the command string.
    // It must not appear; only the env-var reference $STELLAR_SECRET_KEY is allowed.
    expect(SOROBAN_SRC).not.toMatch(/--source\s+\$\{sourceKey\}/);
    expect(SOROBAN_SRC).not.toMatch(/--source\s+['"]?\$\{sourceKey\}/);
  });

  it("soroban.ts uses env var reference for --source-account", () => {
    expect(SOROBAN_SRC).toMatch(/--source-account\s+\$STELLAR_SECRET_KEY/);
  });

  it("soroban.ts passes STELLAR_SECRET_KEY via env option in execSync", () => {
    expect(SOROBAN_SRC).toMatch(/STELLAR_SECRET_KEY:\s*sourceKey/);
  });

  it("deploy-contract.ts does not pass secret key as --source in execSync string", () => {
    expect(DEPLOY_SRC).not.toMatch(/--source\s+\$\{sourceKey\}/);
  });

  it("deploy-contract.ts uses env var reference for --source-account", () => {
    expect(DEPLOY_SRC).toMatch(/--source-account\s+\$STELLAR_SECRET_KEY/);
  });

  it("deploy-contract.ts passes STELLAR_SECRET_KEY via env option in execSync", () => {
    expect(DEPLOY_SRC).toMatch(/STELLAR_SECRET_KEY:\s*sourceKey/);
  });
});
