const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function parseLocalDate(
  value: string | null | undefined
): Date | undefined {
  if (!value) return undefined;
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

export function formatLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function splitDateTimeLocal(value: string | null | undefined): {
  date: Date | undefined;
  time: string;
} {
  const local = toDateTimeLocalValue(value);
  if (!local) return { date: undefined, time: "" };

  const [datePart, timePart = ""] = local.split("T");
  return { date: parseLocalDate(datePart), time: timePart };
}

export function combineLocalDateTime(
  date: Date | undefined,
  time: string
): string | null {
  if (!date) return null;
  return fromDateTimeLocalValue(`${formatLocalDate(date)}T${time || "09:00"}`);
}
