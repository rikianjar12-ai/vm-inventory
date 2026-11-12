import { barClass, type WorkStatus } from "@/lib/progress";

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="prg-ring" role="img" aria-label={`${label} ${pct} persen`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="prg-track" cx="70" cy="70" r={radius} />
        <circle
          className="prg-value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="prg-ring-label">
        <strong>{pct}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  status,
  label,
}: {
  value: number;
  status: WorkStatus;
  label: string;
}) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      className={barClass(status)}
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${width}%` }} />
    </div>
  );
}
