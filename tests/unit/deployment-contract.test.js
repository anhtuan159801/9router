import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const customServer = require(resolve(root, "custom-server.js"));

describe("deployment port contract", () => {
  it("keeps the npm production start command environment-driven", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

    expect(packageJson.scripts.start).toBe("node custom-server.js");
    expect(packageJson.scripts.start).not.toContain("20127");
  });

  it("uses the Docker default and reconciles a single Koyeb exposed port", () => {
    const { applyRuntimeDefaults, getKoyebExposedPorts, DEFAULT_PORT } = customServer.__test__;
    const localEnv = applyRuntimeDefaults({});
    const koyebEnv = applyRuntimeDefaults({ PORT: "8000" });
    const staleKoyebEnv = applyRuntimeDefaults({
      PORT: "20128",
      KOYEB_PORT_8000_PROTOCOL: "http",
    });

    expect(DEFAULT_PORT).toBe("20128");
    expect(localEnv).toMatchObject({ PORT: "20128", HOSTNAME: "0.0.0.0" });
    expect(koyebEnv).toMatchObject({ PORT: "8000", HOSTNAME: "0.0.0.0" });
    expect(getKoyebExposedPorts(staleKoyebEnv)).toEqual(["8000"]);
    expect(staleKoyebEnv.PORT).toBe("8000");
  });

  it("keeps Docker metadata aligned with the local fallback", () => {
    const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");

    expect(dockerfile).toContain("ENV PORT=20128");
    expect(dockerfile).toContain("ENV HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain("EXPOSE 20128");
    expect(dockerfile).toContain('CMD ["node", "custom-server.js"]');
  });

  it("provides an unauthenticated application health route", () => {
    const healthRoute = readFileSync(resolve(root, "src/app/api/health/route.js"), "utf8");

    expect(healthRoute).toContain("export async function GET()");
    expect(healthRoute).toContain("{ ok: true }");
  });
});
