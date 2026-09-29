import { defineConfig } from "vitest/config";

// Tests de firestore.rules: necesitan el emulador (pnpm test:rules lo levanta).
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
