import { listColumns, listVms } from "@/lib/db";
import type { InventoryColumn, VirtualMachine } from "@/lib/types";

export async function getExportDataset() {
  const [columns, rows] = await Promise.all([listColumns(), listVms()]);
  return { columns, rows };
}

export function cellValue(row: VirtualMachine, col: InventoryColumn) {
  const value = row.data[col.field_key];
  return value == null || value === "" ? "-" : String(value);
}

export function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
