const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/", "<rootDir>/e2e/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.module.css.d.ts",
    "!src/app/layout.tsx",
    "!src/app/error.tsx",
    "!src/app/**/error.tsx",
  ],
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
  // Integration tests require the Node environment (no DOM needed for supertest)
  testEnvironmentOptions: {},
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jest-environment-jsdom",
      testPathPattern: "src/(?!__tests__/integration)",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testPathPattern: "src/__tests__/integration/.*\\.test\\.ts$",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    },
  ],
};

module.exports = createJestConfig(config);
