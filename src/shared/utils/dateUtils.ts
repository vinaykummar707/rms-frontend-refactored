const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Deterministically formats a date or ISO string to the format: "Sep 12, 2026"
 * Returns "—" if the date is missing, null, or invalid.
 */
export function formatDate(
  dateInput?: string | number | Date | null
): string {
  if (!dateInput) return "—";
  const date =
    typeof dateInput === "object" && dateInput instanceof Date
      ? dateInput
      : new Date(dateInput);

  if (isNaN(date.getTime())) return "—";

  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

/**
 * Stable descending sort helper for arrays of items with a `created_at` timestamp.
 * Newest items appear first.
 */
export function sortByLatestCreated<T extends { created_at?: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });
}

