import fs from "node:fs";
import { ExplorerView } from "@/components/explore/explorer-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { readInbox, readApplications, careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@/lib/explore";
import { getSessionUser } from "@/lib/auth";

// Read live data at request time so a bare checkout (or `next build` with no
// CAREER_OPS_ROOT) never fails — discovery seeds are best-effort.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const session = await getSessionUser();
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  try {
    seed = seedExploreFilters(session);
  } catch {
    /* bare checkout → defaults */
  }
  let rootExists = false;
  try {
    rootExists = fs.existsSync(careerOpsRoot());
  } catch {
    /* ignore */
  }
  return (
    <ExplorerView seed={seed} inboxSnapshot={readInbox(session)} appsSnapshot={readApplications(session)} rootExists={rootExists} />
  );
}
