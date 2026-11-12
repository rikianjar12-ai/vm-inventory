const DEFAULT_GRAFANA = "http://192.168.38.11:3001";
const DEFAULT_UID = "lrt-server-health";

export function grafanaBaseUrl() {
  return (
    process.env.GRAFANA_URL ||
    process.env.NEXT_PUBLIC_GRAFANA_URL ||
    DEFAULT_GRAFANA
  ).replace(/\/$/, "");
}

export function grafanaDashboardUrl() {
  const uid = process.env.GRAFANA_DASHBOARD_UID || DEFAULT_UID;
  return `${grafanaBaseUrl()}/d/${uid}/pantauan-server-lrt-jabodebek?orgId=1&refresh=30s`;
}
