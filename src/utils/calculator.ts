import {
  PTRosterEntry,
  ScanRateRecord,
  RateConfig,
  BlockType
} from '../types';

export interface PTDashboardRow {
  scan_id: string;
  valinor_id: string;
  mp_name: string;
  assigned_block: BlockType;
  scans: number;
  rate: number;
  total_cost: number;
  mp_id: string; // compatibility
}

export interface BlockSummary {
  block: BlockType | 'ALL';
  totalPrimaryPTs: number;
  totalPrimaryScans: number;
  primaryRate: number;
  totalPrimaryCost: number;
  primaryPTs: PTDashboardRow[];

  totalSecondaryPTs: number;
  totalSecondaryScans: number;
  secondaryRate: number;
  totalSecondaryCost: number;
  secondaryPTs: PTDashboardRow[];

  totalCombinedScans: number;
  totalCombinedCost: number;
}

export interface PTHourlyRow {
  hour: string | number;
  primaryScans: number;
  primaryEarnings: number;
  secondaryScans: number;
  secondaryEarnings: number;
  totalHourlyEarnings: number;
  cumulativeEarnings: number;
}

export interface PTPerformanceStats {
  scan_id: string;
  valinor_id: string;
  mp_name: string;
  assigned_block: BlockType;
  status: string;
  mp_id: string;

  // Selected date metrics
  selectedDate: string;
  todayPrimaryScans: number;
  todayPrimaryEarnings: number;
  todaySecondaryScans: number;
  todaySecondaryEarnings: number;
  todayTotalScans: number;
  todayTotalEarnings: number;

  // Hourly breakdown for selected date
  hourlyBreakdown: PTHourlyRow[];

  // Comparison periods
  yesterdayTotalEarnings: number;
  weeklyTotalEarnings: number;
  monthlyTotalEarnings: number;

  // Lifetime/Historical stats
  allTimeScans: number;
  allTimeEarnings: number;
  highestEarningDay: { date: string; earnings: number } | null;
  highestEarningMonth: { month: string; earnings: number } | null;
  highestScanDay: { date: string; scans: number } | null;
  averageDailyEarnings: number;
  activeDaysCount: number;

  // Daily records list
  dailyHistory: Array<{
    date: string;
    primaryScans: number;
    primaryEarnings: number;
    secondaryScans: number;
    secondaryEarnings: number;
    totalScans: number;
    totalEarnings: number;
    effectiveRatePrimary: number;
    effectiveRateSecondary: number;
  }>;
}

/**
 * Calculates Dashboard stats for a given operational date, block filter, and records.
 * STRICT: Only REGISTERED and ACTIVE PTs are included in Dashboard.
 * Matches on scan_id.
 */
export function calculateDashboardSummary(
  operationalDate: string,
  records: ScanRateRecord[],
  roster: PTRosterEntry[],
  currentRate: RateConfig,
  blockFilter: BlockType | 'ALL'
): BlockSummary {
  // Build lookup of active registered PTs by normalized scan_id
  const activeRosterMap = new Map<string, PTRosterEntry>();
  roster.forEach((r) => {
    if (r.status === 'Active') {
      const key = r.scan_id || r.mp_id;
      if (key) activeRosterMap.set(key, r);
    }
  });

  // Filter scan records for this date and exclude machines
  const dateRecords = records.filter(
    (r) => r.operational_date === operationalDate && !r.is_machine
  );

  // Group by PT for Primary
  const primaryPTMap = new Map<string, { scans: number; rate: number }>();
  // Group by PT for Secondary
  const secondaryPTMap = new Map<string, { scans: number; rate: number }>();

  dateRecords.forEach((rec) => {
    const pt = activeRosterMap.get(rec.normalized_mp_id);
    if (!pt) return;

    const ptKey = pt.scan_id || pt.mp_id || '';
    if (!ptKey) return;

    // Check block filter based EXCLUSIVELY on roster-assigned block
    if (blockFilter !== 'ALL' && pt.assigned_block !== blockFilter) {
      return;
    }

    if (rec.process_type === 'PRIMARY') {
      const existing = primaryPTMap.get(ptKey) || { scans: 0, rate: rec.primary_rate_applied || currentRate.primary_rate };
      existing.scans += rec.scan_count;
      primaryPTMap.set(ptKey, existing);
    } else if (rec.process_type === 'SECONDARY') {
      const existing = secondaryPTMap.get(ptKey) || { scans: 0, rate: rec.secondary_rate_applied || currentRate.secondary_rate };
      existing.scans += rec.scan_count;
      secondaryPTMap.set(ptKey, existing);
    }
  });

  const primaryPTs: PTDashboardRow[] = [];
  let totalPrimaryScans = 0;
  let totalPrimaryCost = 0;

  primaryPTMap.forEach((val, ptKey) => {
    const pt = activeRosterMap.get(ptKey)!;
    const cost = Number((val.scans * val.rate).toFixed(2));
    totalPrimaryScans += val.scans;
    totalPrimaryCost += cost;
    primaryPTs.push({
      scan_id: pt.scan_id || ptKey,
      valinor_id: pt.valinor_id || '',
      mp_id: pt.scan_id || ptKey,
      mp_name: pt.mp_name,
      assigned_block: pt.assigned_block,
      scans: val.scans,
      rate: val.rate,
      total_cost: cost,
    });
  });

  primaryPTs.sort((a, b) => b.total_cost - a.total_cost);

  const secondaryPTs: PTDashboardRow[] = [];
  let totalSecondaryScans = 0;
  let totalSecondaryCost = 0;

  secondaryPTMap.forEach((val, ptKey) => {
    const pt = activeRosterMap.get(ptKey)!;
    const cost = Number((val.scans * val.rate).toFixed(2));
    totalSecondaryScans += val.scans;
    totalSecondaryCost += cost;
    secondaryPTs.push({
      scan_id: pt.scan_id || ptKey,
      valinor_id: pt.valinor_id || '',
      mp_id: pt.scan_id || ptKey,
      mp_name: pt.mp_name,
      assigned_block: pt.assigned_block,
      scans: val.scans,
      rate: val.rate,
      total_cost: cost,
    });
  });

  secondaryPTs.sort((a, b) => b.total_cost - a.total_cost);

  return {
    block: blockFilter,
    totalPrimaryPTs: primaryPTs.length,
    totalPrimaryScans,
    primaryRate: currentRate.primary_rate,
    totalPrimaryCost: Number(totalPrimaryCost.toFixed(2)),
    primaryPTs,

    totalSecondaryPTs: secondaryPTs.length,
    totalSecondaryScans,
    secondaryRate: currentRate.secondary_rate,
    totalSecondaryCost: Number(totalSecondaryCost.toFixed(2)),
    secondaryPTs,

    totalCombinedScans: totalPrimaryScans + totalSecondaryScans,
    totalCombinedCost: Number((totalPrimaryCost + totalSecondaryCost).toFixed(2)),
  };
}

/**
/**
 * Helper to get a Set of all valid, active Scan_IDs and MP_IDs in the roster.
 */
export function getActiveRosterScanIds(roster: PTRosterEntry[]): Set<string> {
  const set = new Set<string>();
  roster.forEach((r) => {
    if (r.status === 'Active') {
      if (r.scan_id) set.add(r.scan_id);
      if (r.mp_id) set.add(r.mp_id);
    }
  });
  return set;
}

/**
 * Calculates complete details, hourly breakdown, and historical profile for an individual registered PT.
 * Strictly excludes any worker not actively registered in the roster.
 */
export function calculatePTProfile(
  scanOrMpId: string,
  selectedDate: string,
  records: ScanRateRecord[],
  roster: PTRosterEntry[],
  currentRate: RateConfig
): PTPerformanceStats | null {
  // STRICT: Must be present in roster AND active
  const pt = roster.find(
    (r) => (r.scan_id === scanOrMpId || r.mp_id === scanOrMpId) && r.status === 'Active'
  );
  if (!pt) return null;

  const lookupKey = pt.scan_id || pt.mp_id;
  if (!lookupKey) return null;

  // Filter all records for this active PT (matching normalized_mp_id to scan_id)
  const ptRecords = records.filter(
    (r) => r.normalized_mp_id === lookupKey && !r.is_machine
  );

  const selectedDateRecords = ptRecords.filter(
    (r) => r.operational_date === selectedDate
  );

  const hourMap = new Map<string, { primaryScans: number; primaryEarnings: number; secondaryScans: number; secondaryEarnings: number }>();

  selectedDateRecords.forEach((r) => {
    const hKey = String(r.hour);
    const curr = hourMap.get(hKey) || {
      primaryScans: 0,
      primaryEarnings: 0,
      secondaryScans: 0,
      secondaryEarnings: 0,
    };

    if (r.process_type === 'PRIMARY') {
      curr.primaryScans += r.scan_count;
      curr.primaryEarnings += r.primary_earnings || r.scan_count * (r.primary_rate_applied || currentRate.primary_rate);
    } else if (r.process_type === 'SECONDARY') {
      curr.secondaryScans += r.scan_count;
      curr.secondaryEarnings += r.secondary_earnings || r.scan_count * (r.secondary_rate_applied || currentRate.secondary_rate);
    }
    hourMap.set(hKey, curr);
  });

  const sortedHourKeys = Array.from(hourMap.keys()).sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });

  let runningEarnings = 0;
  const hourlyBreakdown: PTHourlyRow[] = sortedHourKeys.map((hKey) => {
    const val = hourMap.get(hKey)!;
    const totalHourly = Number((val.primaryEarnings + val.secondaryEarnings).toFixed(2));
    runningEarnings = Number((runningEarnings + totalHourly).toFixed(2));

    return {
      hour: hKey,
      primaryScans: val.primaryScans,
      primaryEarnings: Number(val.primaryEarnings.toFixed(2)),
      secondaryScans: val.secondaryScans,
      secondaryEarnings: Number(val.secondaryEarnings.toFixed(2)),
      totalHourlyEarnings: totalHourly,
      cumulativeEarnings: runningEarnings,
    };
  });

  let todayPrimaryScans = 0;
  let todayPrimaryEarnings = 0;
  let todaySecondaryScans = 0;
  let todaySecondaryEarnings = 0;

  selectedDateRecords.forEach((r) => {
    if (r.process_type === 'PRIMARY') {
      todayPrimaryScans += r.scan_count;
      todayPrimaryEarnings += r.primary_earnings || r.scan_count * (r.primary_rate_applied || currentRate.primary_rate);
    } else if (r.process_type === 'SECONDARY') {
      todaySecondaryScans += r.scan_count;
      todaySecondaryEarnings += r.secondary_earnings || r.scan_count * (r.secondary_rate_applied || currentRate.secondary_rate);
    }
  });

  const dateMap = new Map<string, {
    primaryScans: number;
    primaryEarnings: number;
    secondaryScans: number;
    secondaryEarnings: number;
    rateP: number;
    rateS: number;
  }>();

  ptRecords.forEach((r) => {
    const d = r.operational_date;
    const curr = dateMap.get(d) || {
      primaryScans: 0,
      primaryEarnings: 0,
      secondaryScans: 0,
      secondaryEarnings: 0,
      rateP: r.primary_rate_applied || currentRate.primary_rate,
      rateS: r.secondary_rate_applied || currentRate.secondary_rate,
    };

    if (r.process_type === 'PRIMARY') {
      curr.primaryScans += r.scan_count;
      curr.primaryEarnings += r.primary_earnings || r.scan_count * curr.rateP;
    } else if (r.process_type === 'SECONDARY') {
      curr.secondaryScans += r.scan_count;
      curr.secondaryEarnings += r.secondary_earnings || r.scan_count * curr.rateS;
    }
    dateMap.set(d, curr);
  });

  const dailyHistory = Array.from(dateMap.entries())
    .map(([date, val]) => {
      const totalScans = val.primaryScans + val.secondaryScans;
      const totalEarnings = Number((val.primaryEarnings + val.secondaryEarnings).toFixed(2));
      return {
        date,
        primaryScans: val.primaryScans,
        primaryEarnings: Number(val.primaryEarnings.toFixed(2)),
        secondaryScans: val.secondaryScans,
        secondaryEarnings: Number(val.secondaryEarnings.toFixed(2)),
        totalScans,
        totalEarnings,
        effectiveRatePrimary: val.rateP,
        effectiveRateSecondary: val.rateS,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  let allTimeScans = 0;
  let allTimeEarnings = 0;
  let highestEarningDay: { date: string; earnings: number } | null = null;
  let highestScanDay: { date: string; scans: number } | null = null;
  const monthMap = new Map<string, number>();

  dailyHistory.forEach((day) => {
    allTimeScans += day.totalScans;
    allTimeEarnings = Number((allTimeEarnings + day.totalEarnings).toFixed(2));

    if (!highestEarningDay || day.totalEarnings > highestEarningDay.earnings) {
      highestEarningDay = { date: day.date, earnings: day.totalEarnings };
    }
    if (!highestScanDay || day.totalScans > highestScanDay.scans) {
      highestScanDay = { date: day.date, scans: day.totalScans };
    }

    const m = day.date.substring(0, 7);
    monthMap.set(m, (monthMap.get(m) || 0) + day.totalEarnings);
  });

  let highestEarningMonth: { month: string; earnings: number } | null = null;
  monthMap.forEach((earnings, month) => {
    if (!highestEarningMonth || earnings > highestEarningMonth.earnings) {
      highestEarningMonth = { month, earnings: Number(earnings.toFixed(2)) };
    }
  });

  const selDateObj = new Date(selectedDate);
  const yesterdayObj = new Date(selDateObj);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const yesterdayRecord = dailyHistory.find((d) => d.date === yesterdayStr);
  const yesterdayTotalEarnings = yesterdayRecord ? yesterdayRecord.totalEarnings : 0;

  const sevenDaysAgo = new Date(selDateObj);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const weeklyRecords = dailyHistory.filter(
    (d) => d.date <= selectedDate && d.date >= sevenDaysAgoStr
  );
  const weeklyTotalEarnings = Number(
    weeklyRecords.reduce((acc, d) => acc + d.totalEarnings, 0).toFixed(2)
  );

  const thirtyDaysAgo = new Date(selDateObj);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const monthlyRecords = dailyHistory.filter(
    (d) => d.date <= selectedDate && d.date >= thirtyDaysAgoStr
  );
  const monthlyTotalEarnings = Number(
    monthlyRecords.reduce((acc, d) => acc + d.totalEarnings, 0).toFixed(2)
  );

  const activeDaysCount = dailyHistory.length;
  const averageDailyEarnings =
    activeDaysCount > 0 ? Number((allTimeEarnings / activeDaysCount).toFixed(2)) : 0;

  return {
    scan_id: pt.scan_id || lookupKey || '',
    valinor_id: pt.valinor_id || '',
    mp_id: pt.scan_id || lookupKey || '',
    mp_name: pt.mp_name,
    assigned_block: pt.assigned_block,
    status: pt.status,
    selectedDate,
    todayPrimaryScans,
    todayPrimaryEarnings: Number(todayPrimaryEarnings.toFixed(2)),
    todaySecondaryScans,
    todaySecondaryEarnings: Number(todaySecondaryEarnings.toFixed(2)),
    todayTotalScans: todayPrimaryScans + todaySecondaryScans,
    todayTotalEarnings: Number((todayPrimaryEarnings + todaySecondaryEarnings).toFixed(2)),
    hourlyBreakdown,
    yesterdayTotalEarnings,
    weeklyTotalEarnings,
    monthlyTotalEarnings,
    allTimeScans,
    allTimeEarnings,
    highestEarningDay,
    highestEarningMonth,
    highestScanDay,
    averageDailyEarnings,
    activeDaysCount,
    dailyHistory,
  };
}

export interface DCHourlyStat {
  hour: number;
  label: string;
  primaryScans: number;
  primaryCost: number;
  secondaryScans: number;
  secondaryCost: number;
  totalScans: number;
  totalCost: number;
  activePTs: number;
}

export interface BlockMetric {
  block: BlockType;
  primaryScans: number;
  secondaryScans: number;
  totalScans: number;
  totalCost: number;
  activePTCount: number;
  scanSharePercentage: number;
  costSharePercentage: number;
}

/**
 * Calculates hourly scan statistics across the whole NBP DC for active registered PTs.
 */
export function calculateDCHourlyBreakdown(
  operationalDate: string,
  scanRateRecords: ScanRateRecord[],
  roster: PTRosterEntry[],
  currentRate: RateConfig
): {
  hourlyStats: DCHourlyStat[];
  peakHour: DCHourlyStat | null;
  totalDayScans: number;
  totalDayCost: number;
} {
  const activeScanIdSet = getActiveRosterScanIds(roster);

  const registeredRecords = scanRateRecords.filter(
    (r) =>
      r.operational_date === operationalDate &&
      !r.is_machine &&
      activeScanIdSet.has(r.normalized_mp_id)
  );

  // Initialize 24-hour slots
  const hourMap: { [hour: number]: { primaryScans: number; secondaryScans: number; ptSet: Set<string> } } = {};
  for (let h = 0; h < 24; h++) {
    hourMap[h] = { primaryScans: 0, secondaryScans: 0, ptSet: new Set() };
  }

  registeredRecords.forEach((r) => {
    const rawH = Number(r.hour);
    const h = isNaN(rawH) ? 0 : Math.max(0, Math.min(23, rawH));
    if (!hourMap[h]) {
      hourMap[h] = { primaryScans: 0, secondaryScans: 0, ptSet: new Set() };
    }
    if (r.process_type === 'PRIMARY') {
      hourMap[h].primaryScans += r.scan_count;
    } else if (r.process_type === 'SECONDARY') {
      hourMap[h].secondaryScans += r.scan_count;
    }
    hourMap[h].ptSet.add(r.normalized_mp_id);
  });

  const hourlyStats: DCHourlyStat[] = [];
  let peakHour: DCHourlyStat | null = null;
  let totalDayScans = 0;
  let totalDayCost = 0;

  for (let h = 0; h < 24; h++) {
    const data = hourMap[h];
    const pCost = Number((data.primaryScans * currentRate.primary_rate).toFixed(2));
    const sCost = Number((data.secondaryScans * currentRate.secondary_rate).toFixed(2));
    const totScans = data.primaryScans + data.secondaryScans;
    const totCost = Number((pCost + sCost).toFixed(2));

    const stat: DCHourlyStat = {
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      primaryScans: data.primaryScans,
      primaryCost: pCost,
      secondaryScans: data.secondaryScans,
      secondaryCost: sCost,
      totalScans: totScans,
      totalCost: totCost,
      activePTs: data.ptSet.size,
    };

    hourlyStats.push(stat);
    totalDayScans += totScans;
    totalDayCost += totCost;

    if (!peakHour || totScans > peakHour.totalScans) {
      if (totScans > 0) {
        peakHour = stat;
      }
    }
  }

  return {
    hourlyStats,
    peakHour,
    totalDayScans,
    totalDayCost: Number(totalDayCost.toFixed(2)),
  };
}

/**
 * Calculates block-wise metrics (A, B, C, D, E) for visual graphs and share comparisons.
 */
export function calculateAllBlocksMetrics(
  operationalDate: string,
  scanRateRecords: ScanRateRecord[],
  roster: PTRosterEntry[],
  currentRate: RateConfig
): {
  metrics: BlockMetric[];
  highestBlock: BlockMetric | null;
  grandTotalScans: number;
  grandTotalCost: number;
} {
  const blocks: BlockType[] = ['A', 'B', 'C', 'D', 'E'];
  const blockData: Record<BlockType, { primary: number; secondary: number; ptSet: Set<string> }> = {
    A: { primary: 0, secondary: 0, ptSet: new Set() },
    B: { primary: 0, secondary: 0, ptSet: new Set() },
    C: { primary: 0, secondary: 0, ptSet: new Set() },
    D: { primary: 0, secondary: 0, ptSet: new Set() },
    E: { primary: 0, secondary: 0, ptSet: new Set() },
  };

  const activeRosterMap = new Map<string, PTRosterEntry>();
  roster.forEach((pt) => {
    if (pt.status === 'Active') {
      const key = pt.scan_id || pt.mp_id || '';
      if (key) activeRosterMap.set(key, pt);
    }
  });

  scanRateRecords.forEach((r) => {
    if (r.operational_date !== operationalDate || r.is_machine) return;
    const pt = activeRosterMap.get(r.normalized_mp_id);
    if (!pt) return; // Strict active roster filter

    const b = pt.assigned_block;
    if (b && blockData[b]) {
      if (r.process_type === 'PRIMARY') {
        blockData[b].primary += r.scan_count;
      } else if (r.process_type === 'SECONDARY') {
        blockData[b].secondary += r.scan_count;
      }
      blockData[b].ptSet.add(pt.scan_id);
    }
  });

  let grandTotalScans = 0;
  let grandTotalCost = 0;

  blocks.forEach((b) => {
    const scans = blockData[b].primary + blockData[b].secondary;
    const cost =
      blockData[b].primary * currentRate.primary_rate +
      blockData[b].secondary * currentRate.secondary_rate;
    grandTotalScans += scans;
    grandTotalCost += cost;
  });

  const metrics: BlockMetric[] = blocks.map((b) => {
    const data = blockData[b];
    const totalScans = data.primary + data.secondary;
    const totalCost = Number(
      (
        data.primary * currentRate.primary_rate +
        data.secondary * currentRate.secondary_rate
      ).toFixed(2)
    );
    const scanSharePercentage =
      grandTotalScans > 0 ? Number(((totalScans / grandTotalScans) * 100).toFixed(1)) : 0;
    const costSharePercentage =
      grandTotalCost > 0 ? Number(((totalCost / grandTotalCost) * 100).toFixed(1)) : 0;

    return {
      block: b,
      primaryScans: data.primary,
      secondaryScans: data.secondary,
      totalScans,
      totalCost,
      activePTCount: data.ptSet.size,
      scanSharePercentage,
      costSharePercentage,
    };
  });

  let highestBlock: BlockMetric | null = null;
  metrics.forEach((m) => {
    if (!highestBlock || m.totalScans > highestBlock.totalScans) {
      if (m.totalScans > 0) {
        highestBlock = m;
      }
    }
  });

  return {
    metrics,
    highestBlock,
    grandTotalScans,
    grandTotalCost: Number(grandTotalCost.toFixed(2)),
  };
}

/**
 * Calculates top earning registered PTs for a given operational date.
 */
export function calculateTopEarners(
  operationalDate: string,
  records: ScanRateRecord[],
  roster: PTRosterEntry[],
  currentRate: RateConfig,
  limit: number = 5
): PTPerformanceStats[] {
  const activeScanIdSet = getActiveRosterScanIds(roster);
  const profiles: PTPerformanceStats[] = [];

  roster.forEach((pt) => {
    if (pt.status !== 'Active') return;
    const scanId = pt.scan_id || pt.mp_id;
    if (!scanId || !activeScanIdSet.has(scanId)) return;

    const prof = calculatePTProfile(scanId, operationalDate, records, roster, currentRate);
    if (prof && prof.todayTotalScans > 0) {
      profiles.push(prof);
    }
  });

  return profiles
    .sort((a, b) => b.todayTotalEarnings - a.todayTotalEarnings)
    .slice(0, limit);
}

export const calculatePTPerformance = calculatePTProfile;


