import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

/** Multi-tenant mode is active when users/registry.yml exists. In single-user
 *  mode (no registry), the web UI behaves exactly as before — no login required,
 *  all data reads/writes go to the repo root. */
export function isMultiTenant(): boolean {
  try {
    return fs.existsSync(path.join(careerOpsRoot(), "users", "registry.yml"));
  } catch {
    return false;
  }
}

/** The registry path (absolute). */
export function registryPath(): string {
  return path.join(careerOpsRoot(), "users", "registry.yml");
}
