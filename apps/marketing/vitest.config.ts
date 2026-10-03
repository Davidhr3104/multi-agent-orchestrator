import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

const scratch = path.join(os.tmpdir(), `helix-marketing-vitest-${process.pid}`);

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    // Tests never read the developer's saved keys or write into the app's real .data folder.
    env: {
      HELIX_SECRETS_PATH: path.join(scratch, "secrets.json"),
      HELIX_MARKETING_DATA_DIR: scratch,
    },
  },
});
