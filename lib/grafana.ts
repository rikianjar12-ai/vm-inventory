const DEFAULT_GRAFANA = "http://192.168.38.11:3001";

export function grafanaBaseUrl() {
  return (
    process.env.GRAFANA_URL ||
    process.env.NEXT_PUBLIC_GRAFANA_URL ||
    DEFAULT_GRAFANA
  ).replace(/\/$/, "");
}

function dashboardUrl(uid: string, slug: string) {
  return `${grafanaBaseUrl()}/d/${uid}/${slug}?orgId=1&refresh=30s`;
}

export function grafanaDashboardUrl() {
  const uid = process.env.GRAFANA_DASHBOARD_UID || "lrt-server-health";
  return dashboardUrl(uid, "data-center-overview");
}

export function grafanaLinks() {
  return {
    overview: grafanaDashboardUrl(),
    server: dashboardUrl("lrt-server-detail", "server-detail"),
    app: dashboardUrl("lrt-app-db", "aplikasi-database"),
    network: dashboardUrl("lrt-network", "jaringan"),
    alerts: dashboardUrl("lrt-alerts", "alert-insiden"),
  };
}
