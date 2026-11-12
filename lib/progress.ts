export type WorkStatus = "selesai" | "berjalan" | "belum" | "terlambat";

export type WorkRow = {
  id: number;
  title: string;
  description: string;
  owner: string;
  weight: number;
  manual_progress: number;
  start_date: string;
  due_date: string;
};

export type SubRow = {
  id: number;
  work_id: number;
  title: string;
  description: string;
  owner: string;
  weight: number;
  progress: number;
  due_date: string;
  sort_order: number;
};

export type SubView = SubRow & {
  status: WorkStatus;
  share: number;
  contribution: number;
};

export type WorkView = WorkRow & {
  progress: number;
  status: WorkStatus;
  usesSubs: boolean;
  subs: SubView[];
  weightShare: number;
  contribution: number;
};

export type WorkInput = {
  title: string;
  description: string;
  owner: string;
  weight: number;
  manualProgress: number;
  startDate: string | null;
  dueDate: string | null;
};

export type SubInput = {
  title: string;
  description: string;
  owner: string;
  weight: number;
  progress: number;
  dueDate: string | null;
};

export type SubDraftInput = {
  id: number | null;
  title: string;
  progress: number;
  note: string;
};

export const STATUS_LABEL: Record<WorkStatus, string> = {
  selesai: "Selesai",
  berjalan: "Berjalan",
  belum: "Belum mulai",
  terlambat: "Terlambat",
};

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateID(iso: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function formatPoints(value: number) {
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatWeight(value: number) {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function statusBadgeClass(status: WorkStatus) {
  if (status === "selesai") return "badge badge-up";
  if (status === "terlambat") return "badge badge-down";
  if (status === "berjalan") return "badge badge-maint";
  return "badge";
}

export function barClass(status: WorkStatus) {
  if (status === "selesai") return "prg-bar done";
  if (status === "terlambat") return "prg-bar late";
  if (status === "belum") return "prg-bar idle";
  return "prg-bar";
}

export function workStatus(
  progress: number,
  dueDate: string,
  today: string
): WorkStatus {
  if (progress >= 100) return "selesai";
  if (dueDate && dueDate < today) return "terlambat";
  if (progress <= 0) return "belum";
  return "berjalan";
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function presentWork(
  work: WorkRow,
  subs: SubRow[],
  today: string,
  siblingCount: number
): WorkView {
  const children = subs
    .filter((sub) => sub.work_id === work.id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const usesSubs = children.length > 0;
  const completed = children.filter((sub) => sub.progress >= 100).length;
  const progress = usesSubs
    ? clampProgress((completed / children.length) * 100)
    : clampProgress(work.manual_progress);
  const share = children.length > 0 ? 100 / children.length : 0;

  const subViews: SubView[] = children.map((sub) => {
    const complete = sub.progress >= 100;
    return {
      ...sub,
      progress: complete ? 100 : 0,
      status: workStatus(complete ? 100 : 0, sub.due_date, today),
      share,
      contribution: complete ? share : 0,
    };
  });

  let status = workStatus(progress, work.due_date, today);
  if (status === "belum" && usesSubs) status = "berjalan";
  const weightShare = siblingCount > 0 ? 100 / siblingCount : 0;

  return {
    ...work,
    progress,
    status,
    usesSubs,
    subs: subViews,
    weightShare,
    contribution: (weightShare * progress) / 100,
  };
}

export function presentDashboard(
  works: WorkRow[],
  subs: SubRow[],
  today: string
) {
  const totalWeight = works.reduce((sum, work) => sum + work.weight, 0);
  const views = works.map((work) => presentWork(work, subs, today, works.length));
  const overall =
    views.length > 0
      ? clampProgress(
          views.reduce((sum, work) => sum + work.progress, 0) / views.length
        )
      : 0;

  return {
    views,
    overall,
    totalWeight,
    counts: {
      total: views.length,
      selesai: views.filter((work) => work.status === "selesai").length,
      berjalan: views.filter((work) => work.status === "berjalan").length,
      belum: views.filter((work) => work.status === "belum").length,
      terlambat: views.filter((work) => work.status === "terlambat").length,
      subTotal: subs.length,
    },
  };
}

function fieldText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

function parseWeight(value: string) {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number) || number <= 0 || number > 9999) return null;
  return Math.round(number * 100) / 100;
}

function parseProgress(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

export function parseWorkForm(
  formData: FormData
): { ok: true; value: WorkInput } | { ok: false; error: string } {
  const title = fieldText(formData, "title");
  const description = fieldText(formData, "description");
  const owner = fieldText(formData, "owner");
  const weight = parseWeight(fieldText(formData, "weight") || "1");
  const manualProgress = parseProgress(fieldText(formData, "manual_progress") || "0");
  const startDate = parseDate(fieldText(formData, "start_date"));
  const dueDate = parseDate(fieldText(formData, "due_date"));

  if (!title) return { ok: false, error: "Nama pekerjaan wajib diisi." };
  if (title.length > 200) {
    return { ok: false, error: "Nama pekerjaan maksimal 200 karakter." };
  }
  if (description.length > 4000) {
    return { ok: false, error: "Deskripsi maksimal 4000 karakter." };
  }
  if (owner.length > 128) {
    return { ok: false, error: "Nama penanggung jawab maksimal 128 karakter." };
  }
  if (weight == null) return { ok: false, error: "Bobot harus lebih dari 0." };
  if (manualProgress == null) {
    return { ok: false, error: "Progress manual harus bilangan 0 sampai 100." };
  }
  if (startDate === undefined || dueDate === undefined) {
    return { ok: false, error: "Format tanggal tidak valid." };
  }
  if (startDate && dueDate && startDate > dueDate) {
    return {
      ok: false,
      error: "Tanggal mulai tidak boleh sesudah target selesai.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      owner,
      weight,
      manualProgress,
      startDate,
      dueDate,
    },
  };
}

export function parseSubForm(
  formData: FormData
): { ok: true; value: SubInput } | { ok: false; error: string } {
  const title = fieldText(formData, "title");
  const description = fieldText(formData, "description");
  const owner = fieldText(formData, "owner");
  const weight = parseWeight(fieldText(formData, "weight") || "1");
  const progress = parseProgress(fieldText(formData, "progress") || "0");
  const dueDate = parseDate(fieldText(formData, "due_date"));

  if (!title) return { ok: false, error: "Nama sub pekerjaan wajib diisi." };
  if (title.length > 200) {
    return { ok: false, error: "Nama sub pekerjaan maksimal 200 karakter." };
  }
  if (description.length > 4000) {
    return { ok: false, error: "Deskripsi maksimal 4000 karakter." };
  }
  if (owner.length > 128) {
    return { ok: false, error: "Nama penanggung jawab maksimal 128 karakter." };
  }
  if (weight == null) return { ok: false, error: "Bobot harus lebih dari 0." };
  if (progress == null) {
    return { ok: false, error: "Progress harus bilangan 0 sampai 100." };
  }
  if (dueDate === undefined) {
    return { ok: false, error: "Format tanggal tidak valid." };
  }

  return {
    ok: true,
    value: { title, description, owner, weight, progress, dueDate },
  };
}

export function parseSubList(
  formData: FormData
): { ok: true; value: SubDraftInput[] } | { ok: false; error: string } {
  const ids = formData.getAll("sub_id").map((value) => String(value).trim());
  const titles = formData.getAll("sub_title").map((value) => String(value).trim());
  const states = formData.getAll("sub_state").map((value) => String(value).trim());
  const notes = formData.getAll("sub_note").map((value) => String(value).trim());

  if (
    ids.length !== titles.length ||
    titles.length !== states.length ||
    titles.length !== notes.length
  ) {
    return { ok: false, error: "Data sub pekerjaan tidak lengkap." };
  }

  const value: SubDraftInput[] = [];
  for (let index = 0; index < titles.length; index += 1) {
    const title = titles[index];
    if (!title) continue;
    if (title.length > 200) {
      return { ok: false, error: "Nama sub pekerjaan maksimal 200 karakter." };
    }
    const note = notes[index];
    if (note.length > 4000) {
      return { ok: false, error: `Keterangan "${title}" maksimal 4000 karakter.` };
    }
    const complete = states[index] === "complete";
    const rawId = ids[index];
    const id = rawId ? Number(rawId) : null;
    if (rawId && (!Number.isInteger(id) || (id ?? 0) <= 0)) {
      return { ok: false, error: "Sub pekerjaan tidak valid." };
    }
    value.push({ id, title, progress: complete ? 100 : 0, note });
  }

  return { ok: true, value };
}

export function averageProgress(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
