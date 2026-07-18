import { notFound } from "next/navigation";
import { readReport, findApplication, trackerCanDelete } from "@/lib/career-ops";
import { ReportView } from "@/components/report-view";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  const { id } = await params;
  const app = findApplication(id, session);
  const report = readReport(id, session);
  if (!app && !report) notFound();
  return <ReportView id={id} app={app} report={report?.content ?? null} file={report?.file ?? null} canDelete={trackerCanDelete()} />;
}
