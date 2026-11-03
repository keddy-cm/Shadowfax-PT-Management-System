import * as XLSX from 'xlsx';
import {
  AppDatabase,
  PTRosterEntry,
  ScanRateRecord,
  ScanHistoryRecord,
  RateConfig,
  BlockType
} from '../types';
import { calculateDashboardSummary, calculatePTProfile, getActiveRosterScanIds } from './calculator';
import { getActiveRateForDate } from '../db/storage';

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function exportWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadFile(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Generates the Comprehensive Daily Excel Report with multiple worksheets
 */
export function generateDailyExcelReport(
  db: AppDatabase,
  operationalDate: string
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const currentRate = getActiveRateForDate(operationalDate);
  const overallSummary = calculateDashboardSummary(operationalDate, db.scanRateRecords, db.roster, currentRate, 'ALL');

  // Sheet 1: Executive Summary
  const summaryData = [
    ['SHADOWFAX NCR BAMNOLI DC (NBP) - DAILY PT SCAN & PAYMENT REPORT'],
    ['Operational Date:', operationalDate],
    ['Report Generated At:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'],
    ['Primary Per-Scan Rate (INR):', currentRate.primary_rate],
    ['Secondary Per-Scan Rate (INR):', currentRate.secondary_rate],
    [],
    ['METRIC', 'PRIMARY PROCESS', 'SECONDARY PROCESS', 'TOTAL COMBINED'],
    ['Total Registered PTs', overallSummary.totalPrimaryPTs, overallSummary.totalSecondaryPTs, db.roster.filter(r => r.status === 'Active').length],
    ['Total Scans', overallSummary.totalPrimaryScans, overallSummary.totalSecondaryScans, overallSummary.totalCombinedScans],
    ['Per-Scan Rate (₹)', currentRate.primary_rate, currentRate.secondary_rate, '-'],
    ['Total Payment Cost (₹)', overallSummary.totalPrimaryCost, overallSummary.totalSecondaryCost, overallSummary.totalCombinedCost],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // Sheet 2: PT-Wise Combined Earnings
  const activePTs = db.roster.filter(r => r.status === 'Active');
  const ptEarningsData = activePTs.map(pt => {
    const profile = calculatePTProfile(pt.scan_id || pt.mp_id || '', operationalDate, db.scanRateRecords, db.roster, currentRate);
    return {
      'Scan_ID': pt.scan_id || pt.mp_id || '',
      'Valinor_ID': pt.valinor_id || '',
      'MP_Name': pt.mp_name,
      'Assigned_Block': pt.assigned_block,
      'Primary Scans': profile?.todayPrimaryScans || 0,
      'Primary Rate (₹)': currentRate.primary_rate,
      'Primary Earnings (₹)': profile?.todayPrimaryEarnings || 0,
      'Secondary Scans': profile?.todaySecondaryScans || 0,
      'Secondary Rate (₹)': currentRate.secondary_rate,
      'Secondary Earnings (₹)': profile?.todaySecondaryEarnings || 0,
      'Total Scans': profile?.todayTotalScans || 0,
      'Total Earnings (₹)': profile?.todayTotalEarnings || 0,
    };
  }).sort((a, b) => b['Total Earnings (₹)'] - a['Total Earnings (₹)']);

  const wsPTEarnings = XLSX.utils.json_to_sheet(ptEarningsData);
  XLSX.utils.book_append_sheet(wb, wsPTEarnings, 'PT-Wise Earnings');

  // Sheet 3: Primary Process Details
  const primaryRows = overallSummary.primaryPTs.map(p => ({
    'Scan_ID': p.scan_id,
    'Valinor_ID': p.valinor_id,
    'MP_Name': p.mp_name,
    'Assigned_Block': p.assigned_block,
    'Scans': p.scans,
    'Rate (₹)': p.rate,
    'Total Cost (₹)': p.total_cost,
  }));
  const wsPrimary = XLSX.utils.json_to_sheet(primaryRows.length ? primaryRows : [{ Note: 'No primary scans recorded for this date' }]);
  XLSX.utils.book_append_sheet(wb, wsPrimary, 'Primary Process');

  // Sheet 4: Secondary Process Details
  const secondaryRows = overallSummary.secondaryPTs.map(p => ({
    'Scan_ID': p.scan_id,
    'Valinor_ID': p.valinor_id,
    'MP_Name': p.mp_name,
    'Assigned_Block': p.assigned_block,
    'Scans': p.scans,
    'Rate (₹)': p.rate,
    'Total Cost (₹)': p.total_cost,
  }));
  const wsSecondary = XLSX.utils.json_to_sheet(secondaryRows.length ? secondaryRows : [{ Note: 'No secondary scans recorded for this date' }]);
  XLSX.utils.book_append_sheet(wb, wsSecondary, 'Secondary Process');

  // Sheet 5: Block-Wise Breakdown
  const blocks: BlockType[] = ['A', 'B', 'C', 'D', 'E'];
  const blockData = blocks.map(b => {
    const bSummary = calculateDashboardSummary(operationalDate, db.scanRateRecords, db.roster, currentRate, b);
    return {
      'Block': `Block ${b}`,
      'Primary PTs': bSummary.totalPrimaryPTs,
      'Primary Scans': bSummary.totalPrimaryScans,
      'Primary Cost (₹)': bSummary.totalPrimaryCost,
      'Secondary PTs': bSummary.totalSecondaryPTs,
      'Secondary Scans': bSummary.totalSecondaryScans,
      'Secondary Cost (₹)': bSummary.totalSecondaryCost,
      'Total Scans': bSummary.totalCombinedScans,
      'Total Cost (₹)': bSummary.totalCombinedCost,
    };
  });
  const wsBlock = XLSX.utils.json_to_sheet(blockData);
  XLSX.utils.book_append_sheet(wb, wsBlock, 'Block Summary');

  // Sheet 6: Hourly Scan Breakdown - strictly active registered PTs only
  const activeScanIdSet = getActiveRosterScanIds(db.roster);
  const dateRecords = db.scanRateRecords.filter(
    r => r.operational_date === operationalDate && !r.is_machine && activeScanIdSet.has(r.normalized_mp_id)
  );
  const hourMap = new Map<string, { primaryScans: number; secondaryScans: number; totalScans: number }>();
  dateRecords.forEach(r => {
    const h = String(r.hour);
    const curr = hourMap.get(h) || { primaryScans: 0, secondaryScans: 0, totalScans: 0 };
    if (r.process_type === 'PRIMARY') curr.primaryScans += r.scan_count;
    if (r.process_type === 'SECONDARY') curr.secondaryScans += r.scan_count;
    curr.totalScans += r.scan_count;
    hourMap.set(h, curr);
  });
  const hourlyData = Array.from(hourMap.entries())
    .map(([h, val]) => ({
      'Hour': h,
      'Primary Scans': val.primaryScans,
      'Primary Cost (₹)': Number((val.primaryScans * currentRate.primary_rate).toFixed(2)),
      'Secondary Scans': val.secondaryScans,
      'Secondary Cost (₹)': Number((val.secondaryScans * currentRate.secondary_rate).toFixed(2)),
      'Total Scans': val.totalScans,
      'Total Earnings (₹)': Number(((val.primaryScans * currentRate.primary_rate) + (val.secondaryScans * currentRate.secondary_rate)).toFixed(2)),
    }))
    .sort((a, b) => Number(a.Hour) - Number(b.Hour));

  const wsHourly = XLSX.utils.json_to_sheet(hourlyData.length ? hourlyData : [{ Note: 'No hourly records for this date' }]);
  XLSX.utils.book_append_sheet(wb, wsHourly, 'Hourly Breakdown');

  // Sheet 7: Unregistered MP Review Summary
  const unregData = db.unregisteredMps.map(u => ({
    'Raw Action User': u.raw_action_user,
    'Normalized ID': u.normalized_mp_id,
    'First Seen Date': u.first_seen_date,
    'Total Scans Recorded': u.total_scans_recorded,
    'Last Layout Used': u.last_layout_used,
    'Status': u.status,
  }));
  const wsUnreg = XLSX.utils.json_to_sheet(unregData.length ? unregData : [{ Note: 'No unregistered MPs recorded' }]);
  XLSX.utils.book_append_sheet(wb, wsUnreg, 'Unregistered MPs');

  return wb;
}

export function downloadScanRateTemplate() {
  const data = [
    { action_user: '7827746889', layout_name: 'NBP-INTRA-A-SSC', hour: 0, scan_count: 558 },
    { action_user: '9060572495', layout_name: 'NBP-INTRA-D-SSC_1', hour: 0, scan_count: 537 },
    { action_user: '8287995568', layout_name: 'NBP-ZON-D-SSC', hour: 0, scan_count: 457 },
    { action_user: 'bamnoli_dc_muvro_sorter', layout_name: 'NBP-MU-01', hour: 0, scan_count: 3255 },
  ];
  exportToCSV(data, 'Sample_Scan_Rate_File_NBP.csv');
}

export function downloadScanHistoryTemplate() {
  const data = [
    { awb: 'SFX102938481', action_user: '7827746889', layout_name: 'NBP-INTRA-A-SSC', status: 'RECEIVED_AT_DC', hour: 0, event_timestamp: '2026-10-31 00:15:22' },
    { awb: 'SFX102938482', action_user: '9060572495', layout_name: 'NBP-INTRA-D-SSC_1', status: 'IN_MANIFEST', hour: 0, event_timestamp: '2026-10-31 00:22:45' },
    { awb: 'SFX102938483', action_user: '8287995568', layout_name: 'NBP-ZON-D-SSC', status: 'IN_DCH_MANIFEST', hour: 0, event_timestamp: '2026-10-31 00:30:10' },
  ];
  exportToCSV(data, 'Sample_Scan_History_File_NBP.csv');
}

/**
 * EXACT TEMPLATE FORMAT REQUESTED:
 * Scan_ID Valinor_ID MP_Name Assigned_Block Status
 */
export function downloadPTRosterTemplate() {
  const data = [
    { Scan_ID: '7827746889', Valinor_ID: 'VAL7827', MP_Name: 'Rahul Sharma', Assigned_Block: 'A', Status: 'Active' },
    { Scan_ID: '9060572495', Valinor_ID: 'VAL9060', MP_Name: 'Amit Kumar', Assigned_Block: 'B', Status: 'Active' },
    { Scan_ID: '8287995568', Valinor_ID: 'VAL8287', MP_Name: 'Vikram Singh', Assigned_Block: 'D', Status: 'Active' },
    { Scan_ID: '968893', Valinor_ID: 'VAL9688', MP_Name: 'Suresh Patel', Assigned_Block: 'C', Status: 'Active' },
  ];
  exportToCSV(data, 'Sample_PT_Roster_Template_NBP.csv');
}
