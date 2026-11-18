import { DataCenterBoard } from "@/components/DataCenterBoard";
import { getOverview } from "@/lib/dc-overview";
import { grafanaLinks } from "@/lib/grafana";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Center Overview · LRT Jabodebek",
};

export default async function MonitoringPage() {
  const data = await getOverview();
  return <DataCenterBoard initial={data} links={grafanaLinks()} />;
}
