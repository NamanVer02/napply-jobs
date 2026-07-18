import { Suspense } from "react";
import { pipelineSummary } from "@/lib/career-ops";
import { PipelineView } from "@/components/pipeline-view";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic"; // always read fresh local files

export default async function PipelinePage() {
  const session = await getSessionUser();
  const { inbox, applications } = pipelineSummary(session);
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={inbox} />
    </Suspense>
  );
}
