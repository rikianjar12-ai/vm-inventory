import { redirect } from "next/navigation";
import { grafanaDashboardUrl } from "@/lib/grafana";

export const dynamic = "force-dynamic";

export default function MonitoringPage() {
  redirect(grafanaDashboardUrl());
}
