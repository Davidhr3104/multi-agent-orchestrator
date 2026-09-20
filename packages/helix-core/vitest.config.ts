import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // secrets.ts caches state on globalThis (shared across test files running
    // in the same worker); disabling file-level parallelism avoids test
    // files racing each other over HELIX_OPERATOR_KEY and similar secrets.
    fileParallelism: false,
  },
});
