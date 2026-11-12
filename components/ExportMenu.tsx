"use client";

import { useEffect, useRef } from "react";

export function ExportMenu() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => {
      const details = rootRef.current?.querySelector("details");
      if (details?.open) details.open = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="export-inline" ref={rootRef}>
      <details className="export-menu">
        <summary className="export-toggle" title="Ekspor data">
          <span className="export-toggle-icon" aria-hidden="true">
            ⇩
          </span>
          <span>Ekspor</span>
        </summary>
        <div className="export-panel">
          <p>Unduh inventory</p>
          <a href="/api/export/excel">Microsoft Excel (.xls)</a>
          <a href="/api/export/word">Microsoft Word (.doc)</a>
          <a href="/api/export/pdf">PDF (.pdf)</a>
        </div>
      </details>
    </div>
  );
}
