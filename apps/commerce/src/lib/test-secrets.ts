import os from "node:os";
import path from "node:path";

/**
 * Test-only: points @helix/core's secret store at a file that does not exist and drops its cache,
 * so getSecret() reads only process.env and never a developer's real .data/secrets.json.
 */
export function isolateSecrets(): void {
  process.env.HELIX_SECRETS_PATH = path.join(os.tmpdir(), "helix-commerce-test-no-secrets.json");
  const g = globalThis as { __helixSecrets?: unknown; __helixSecretsLoaded?: boolean };
  g.__helixSecrets = undefined;
  g.__helixSecretsLoaded = false;
}
