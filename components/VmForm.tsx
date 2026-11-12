import Link from "next/link";
import {
  groupedSections,
  REQUIRED_KEYS,
  sectionTitle,
  STATUS_OPTIONS,
  type InventoryColumn,
} from "@/lib/types";

export function VmForm({
  action,
  columns,
  values,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  columns: InventoryColumn[];
  values: Record<string, string>;
  submitLabel: string;
}) {
  const sections = groupedSections(columns);

  return (
    <form className="card" action={action}>
      <div className="form-grid">
        {sections.map((section) => (
          <div key={section.name} className="form-section">
            <h3 className="section-title">{sectionTitle(section.name)}</h3>
            {section.columns.map((col) => (
              <div className="field" key={col.id}>
                <label htmlFor={col.field_key}>
                  {col.label}
                  {REQUIRED_KEYS.has(col.field_key) ? " *" : ""}
                </label>
                {col.field_key === "system_status" ? (
                  <select
                    id={col.field_key}
                    name={col.field_key}
                    defaultValue={values[col.field_key] ?? "UP"}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={col.field_key}
                    name={col.field_key}
                    defaultValue={values[col.field_key] ?? ""}
                    required={REQUIRED_KEYS.has(col.field_key)}
                    placeholder={col.label}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
        <Link className="btn btn-ghost" href="/">
          Batal
        </Link>
      </div>
    </form>
  );
}
