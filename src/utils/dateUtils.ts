import { AppDatabase } from '../types';

/**
 * Returns current calendar day in YYYY-MM-DD format using local time (IST/Local)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns yesterday's calendar day in YYYY-MM-DD format using local time
 */
export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats YYYY-MM-DD into readable local date (e.g. "Mon, 03 Nov 2026")
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export function isTodayDate(dateStr: string): boolean {
  return dateStr === getTodayDateString();
}

export function isYesterdayDate(dateStr: string): boolean {
  return dateStr === getYesterdayDateString();
}

export interface HistoricalDateInfo {
  date: string;
  formattedDate: string;
  scanCount: number;
  ptCount: number;
  recordCount: number;
  isToday: boolean;
  isYesterday: boolean;
}

/**
 * Scans the database records to extract all dates that have scan or import activity,
 * sorted descending (newest first).
 */
export function extractAvailableHistoricalDates(db: AppDatabase): HistoricalDateInfo[] {
  const dateMap = new Map<string, { scans: number; pts: Set<string>; records: number }>();

  // From scan rate records
  (db.scanRateRecords || []).forEach((r) => {
    if (!r.operational_date) return;
    const current = dateMap.get(r.operational_date) || { scans: 0, pts: new Set<string>(), records: 0 };
    current.scans += r.scan_count || 0;
    current.records += 1;
    if (r.normalized_mp_id) {
      current.pts.add(r.normalized_mp_id);
    }
    dateMap.set(r.operational_date, current);
  });

  // From scan history records (if not already counted)
  (db.scanHistoryRecords || []).forEach((r) => {
    if (!r.operational_date) return;
    const current = dateMap.get(r.operational_date) || { scans: 0, pts: new Set<string>(), records: 0 };
    if (!dateMap.has(r.operational_date)) {
      current.records += 1;
      if (r.normalized_mp_id) current.pts.add(r.normalized_mp_id);
      dateMap.set(r.operational_date, current);
    }
  });

  // From import logs
  (db.importLogs || []).forEach((l) => {
    if (!l.operational_date) return;
    if (!dateMap.has(l.operational_date)) {
      dateMap.set(l.operational_date, { scans: 0, pts: new Set<string>(), records: l.valid_rows || 0 });
    }
  });

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();

  // Always ensure today is represented if empty
  if (!dateMap.has(todayStr)) {
    dateMap.set(todayStr, { scans: 0, pts: new Set<string>(), records: 0 });
  }

  const results: HistoricalDateInfo[] = [];

  dateMap.forEach((val, date) => {
    results.push({
      date,
      formattedDate: formatDisplayDate(date),
      scanCount: val.scans,
      ptCount: val.pts.size,
      recordCount: val.records,
      isToday: date === todayStr,
      isYesterday: date === yesterdayStr,
    });
  });

  // Sort descending by date string
  results.sort((a, b) => b.date.localeCompare(a.date));

  return results;
}
