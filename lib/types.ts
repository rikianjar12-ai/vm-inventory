export type InventoryColumn = {
  id: number;
  field_key: string;
  label: string;
  section_name: string;
  sort_order: number;
  is_protected: boolean;
};

export type VirtualMachine = {
  id: number;
  data: Record<string, string>;
};

export type SectionGroup = {
  name: string;
  columns: InventoryColumn[];
};

export const PROTECTED_KEYS = new Set([
  "system_status",
  "server_id",
  "ip",
  "lokasi_server",
  "application",
  "cpu_core",
  "ram_gb",
  "storage_gb",
  "os",
  "os_version",
  "app_version",
  "db_version",
]);

export const DEFAULT_COLUMNS: Array<
  [string, string, string, number, boolean]
> = [
  ["system_status", "SYSTEM STATUS", "Umum", 10, true],
  ["server_id", "SERVER ID", "Umum", 20, true],
  ["ip", "IP", "Umum", 30, true],
  ["lokasi_server", "Lokasi Server", "Umum", 40, true],
  ["application", "APPLICATION", "Umum", 50, true],
  ["cpu_core", "CPUs (CORE)", "Spesifikasi", 60, true],
  ["ram_gb", "RAM (GB)", "Spesifikasi", 70, true],
  ["storage_gb", "STORAGE (GB)", "Spesifikasi", 80, true],
  ["os", "OS", "Spesifikasi", 85, true],
  ["os_version", "OS VERSION", "Versi", 90, true],
  ["app_version", "APP VERSION", "Versi", 100, true],
  ["db_version", "DB VERSION", "Versi", 110, true],
];

export const SAMPLE_VMS: Record<string, string>[] = [
  {
    system_status: "UP",
    server_id: "VM-PROD-01",
    ip: "10.10.1.11",
    lokasi_server: "DC Jakarta - Rack A1",
    application: "Core Banking",
    cpu_core: "8",
    ram_gb: "32",
    storage_gb: "500",
    os: "RHEL",
    os_version: "8.8",
    app_version: "4.2.1",
    db_version: "PostgreSQL 15.4",
  },
  {
    system_status: "UP",
    server_id: "VM-APP-02",
    ip: "10.10.1.21",
    lokasi_server: "DC Jakarta - Rack A2",
    application: "Internet Banking",
    cpu_core: "16",
    ram_gb: "64",
    storage_gb: "1000",
    os: "Ubuntu",
    os_version: "22.04 LTS",
    app_version: "3.8.0",
    db_version: "MySQL 8.0",
  },
  {
    system_status: "MAINTENANCE",
    server_id: "VM-DB-03",
    ip: "10.10.2.31",
    lokasi_server: "DC Surabaya - Rack B3",
    application: "Database Cluster",
    cpu_core: "32",
    ram_gb: "128",
    storage_gb: "4000",
    os: "Oracle Linux",
    os_version: "8",
    app_version: "-",
    db_version: "Oracle 19c",
  },
  {
    system_status: "DOWN",
    server_id: "VM-DEV-04",
    ip: "10.20.5.44",
    lokasi_server: "DC Bandung - Rack C1",
    application: "Portal Internal",
    cpu_core: "4",
    ram_gb: "16",
    storage_gb: "250",
    os: "Windows Server",
    os_version: "2022",
    app_version: "2.1.5",
    db_version: "SQL Server 2019",
  },
];

export const STATUS_OPTIONS = ["UP", "DOWN", "MAINTENANCE"] as const;

/** Samakan ejaan lama Specifikasi dengan Spesifikasi (tanpa mengubah field_key). */
export function normalizeSectionName(name: string) {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "specifikasi" || lower === "spesifikasi") return "Spesifikasi";
  return trimmed;
}

export function groupedSections(columns: InventoryColumn[]): SectionGroup[] {
  const sections: SectionGroup[] = [];
  let current: SectionGroup | null = null;
  for (const col of columns) {
    const name = normalizeSectionName(col.section_name);
    if (!current || current.name !== name) {
      current = { name, columns: [] };
      sections.push(current);
    }
    current.columns.push(col);
  }
  return sections;
}

export function sectionTitle(name: string) {
  const canonical = normalizeSectionName(name);
  if (canonical === "Spesifikasi") return "SPESIFIKASI";
  if (canonical === "Versi") return "OS/APP/DB VERSION";
  return canonical;
}

/** Kolom Umum tampil satu baris; SPESIFIKASI dan Versi memakai grup colspan. */
export function isGroupedHeader(section: SectionGroup) {
  if (section.name === "Umum") return false;
  return section.columns.length > 1;
}

export function isProtectedColumn(
  col: Pick<InventoryColumn, "field_key" | "is_protected">
) {
  return col.is_protected || PROTECTED_KEYS.has(col.field_key);
}

export const REQUIRED_KEYS = new Set(["server_id", "ip"]);

export function slugify(label: string) {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
  return key || "kolom_baru";
}

export function statusClass(status: string) {
  const value = status.toUpperCase();
  if (value === "UP") return "badge badge-up";
  if (value === "DOWN") return "badge badge-down";
  if (value === "MAINTENANCE") return "badge badge-maint";
  return "badge";
}
