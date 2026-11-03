import React, { useState } from 'react';
import {
  AppDatabase,
  RateConfig,
} from '../types';
import {
  exportToCSV,
  exportWorkbook,
  generateDailyExcelReport,
} from '../utils/excelExport';
import {
  calculateDashboardSummary,
  calculatePTProfile,
  getActiveRosterScanIds,
} from '../utils/calculator';
import { getActiveRateForDate } from '../db/storage';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  FileText,
  Clock,
  Users,
  CheckCircle,
} from 'lucide-react';

interface ReportsHubProps {
  db: AppDatabase;
  operationalDate: string;
  setOperationalDate: (d: string) => void;
  currentRate: RateConfig;
}

export const ReportsHub: React.FC<ReportsHubProps> = ({
  db,
  operationalDate,
  setOperationalDate,
  currentRate,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const notifyDownload = (name: string) => {
    setDownloadSuccess(`Downloaded: ${name}`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadComprehensiveExcel = () => {
    const wb = generateDailyExcelReport(db, operationalDate);
    const filename = `Shadowfax_NBP_Daily_PT_Report_${operationalDate}.xlsx`;
    exportWorkbook(wb, filename);
    notifyDownload(filename);
  };

  const handleExportScanRateData = () => {
    const activeScanIdSet = getActiveRosterScanIds(db.roster);
    // Strictly filter out any scan records from workers not in the active roster
    const registeredRecords = db.scanRateRecords.filter(
      (r) => !r.is_machine && activeScanIdSet.has(r.normalized_mp_id)
    );
    const rows = registeredRecords.map((r) => ({
      'Import ID': r.import_id,
      'Operational Date': r.operational_date,
      'Action User': r.action_user,
      'Scan_ID': r.normalized_mp_id,
      'Valinor_ID': r.valinor_id || '',
      'Layout Name': r.layout_name,
      'Hour': r.hour,
      'Scan Count': r.scan_count,
      'Process Type': r.process_type,
      'Assigned Block': r.assigned_block || 'Unassigned',
      'Primary Rate': r.primary_rate_applied,
      'Secondary Rate': r.secondary_rate_applied,
      'Primary Earnings': r.primary_earnings,
      'Secondary Earnings': r.secondary_earnings,
      'Total Earnings': r.total_earnings,
      'Created At': r.created_at,
    }));
    exportToCSV(rows, `Scan_Rate_Active_PT_Data_${operationalDate}.csv`);
    notifyDownload(`Scan_Rate_Active_PT_Data_${operationalDate}.csv`);
  };

  const handleExportScanHistoryData = () => {
    const activeScanIdSet = getActiveRosterScanIds(db.roster);
    // Strictly filter out any scan history records from workers not in the active roster
    const registeredHistory = db.scanHistoryRecords.filter(
      (r) => r.normalized_mp_id && activeScanIdSet.has(r.normalized_mp_id)
    );
    const rows = registeredHistory.map((r) => ({
      'Import ID': r.import_id,
      'Operational Date': r.operational_date,
      'AWB / Shipment ID': r.awb_or_shipment_id || '',
      'Action User': r.action_user || '',
      'Scan_ID': r.normalized_mp_id || '',
      'Valinor_ID': r.valinor_id || '',
      'Layout Name': r.layout_name || '',
      'Status': r.status || '',
      'Process Type': r.process_type || '',
      'Hour': r.hour || '',
      'Created At': r.created_at,
    }));
    exportToCSV(rows, `Scan_History_Active_PT_Data_${operationalDate}.csv`);
    notifyDownload(`Scan_History_Active_PT_Data_${operationalDate}.csv`);
  };

  const handleExportDailySummary = () => {
    const summary = calculateDashboardSummary(operationalDate, db.scanRateRecords, db.roster, currentRate, 'ALL');
    const rows = [
      {
        'Operational Date': operationalDate,
        'Primary PTs': summary.totalPrimaryPTs,
        'Primary Scans': summary.totalPrimaryScans,
        'Primary Rate (₹)': currentRate.primary_rate,
        'Primary Cost (₹)': summary.totalPrimaryCost,
        'Secondary PTs': summary.totalSecondaryPTs,
        'Secondary Scans': summary.totalSecondaryScans,
        'Secondary Rate (₹)': currentRate.secondary_rate,
        'Secondary Cost (₹)': summary.totalSecondaryCost,
        'Total Scans': summary.totalCombinedScans,
        'Total Payout (₹)': summary.totalCombinedCost,
      },
    ];
    exportToCSV(rows, `Daily_Summary_${operationalDate}.csv`);
    notifyDownload(`Daily_Summary_${operationalDate}.csv`);
  };

  const handleExportWeeklySummary = () => {
    const selDate = new Date(operationalDate);
    const sevenDaysAgo = new Date(selDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startStr = sevenDaysAgo.toISOString().split('T')[0];

    const dates = Array.from(new Set(db.scanRateRecords.map((r) => r.operational_date)))
      .filter((d) => d <= operationalDate && d >= startStr)
      .sort();

    const rows = dates.map((d) => {
      const rate = getActiveRateForDate(d);
      const s = calculateDashboardSummary(d, db.scanRateRecords, db.roster, rate, 'ALL');
      return {
        'Date': d,
        'Primary PTs': s.totalPrimaryPTs,
        'Primary Scans': s.totalPrimaryScans,
        'Primary Cost (₹)': s.totalPrimaryCost,
        'Secondary PTs': s.totalSecondaryPTs,
        'Secondary Scans': s.totalSecondaryScans,
        'Secondary Cost (₹)': s.totalSecondaryCost,
        'Total Scans': s.totalCombinedScans,
        'Total Cost (₹)': s.totalCombinedCost,
      };
    });

    exportToCSV(rows, `Weekly_Payment_Summary_${operationalDate}.csv`);
    notifyDownload(`Weekly_Payment_Summary_${operationalDate}.csv`);
  };

  const handleExportMonthlySummary = () => {
    const currentMonthPrefix = operationalDate.substring(0, 7);
    const dates = Array.from(new Set(db.scanRateRecords.map((r) => r.operational_date)))
      .filter((d) => d.startsWith(currentMonthPrefix))
      .sort();

    const rows = dates.map((d) => {
      const rate = getActiveRateForDate(d);
      const s = calculateDashboardSummary(d, db.scanRateRecords, db.roster, rate, 'ALL');
      return {
        'Date': d,
        'Primary Scans': s.totalPrimaryScans,
        'Primary Cost (₹)': s.totalPrimaryCost,
        'Secondary Scans': s.totalSecondaryScans,
        'Secondary Cost (₹)': s.totalSecondaryCost,
        'Total Scans': s.totalCombinedScans,
        'Total Cost (₹)': s.totalCombinedCost,
      };
    });

    exportToCSV(rows, `Monthly_Payment_Summary_${currentMonthPrefix}.csv`);
    notifyDownload(`Monthly_Payment_Summary_${currentMonthPrefix}.csv`);
  };

  const handleExportPtWiseEarnings = () => {
    const activePTs = db.roster.filter((r) => r.status === 'Active');
    const rows = activePTs.map((pt) => {
      const profile = calculatePTProfile(pt.scan_id || pt.mp_id || '', operationalDate, db.scanRateRecords, db.roster, currentRate);
      return {
        'Scan_ID': pt.scan_id || pt.mp_id || '',
        'Valinor_ID': pt.valinor_id || '',
        'MP_Name': pt.mp_name,
        'Assigned_Block': pt.assigned_block,
        'Primary Scans': profile?.todayPrimaryScans || 0,
        'Primary Earnings (₹)': profile?.todayPrimaryEarnings || 0,
        'Secondary Scans': profile?.todaySecondaryScans || 0,
        'Secondary Earnings (₹)': profile?.todaySecondaryEarnings || 0,
        'Total Scans': profile?.todayTotalScans || 0,
        'Total Earnings (₹)': profile?.todayTotalEarnings || 0,
      };
    }).sort((a, b) => b['Total Earnings (₹)'] - a['Total Earnings (₹)']);

    exportToCSV(rows, `PT_Wise_Earnings_${operationalDate}.csv`);
    notifyDownload(`PT_Wise_Earnings_${operationalDate}.csv`);
  };

  const handleExportHourlyScans = () => {
    const activeScanIdSet = getActiveRosterScanIds(db.roster);
    const dateRecords = db.scanRateRecords.filter(
      (r) =>
        r.operational_date === operationalDate &&
        !r.is_machine &&
        activeScanIdSet.has(r.normalized_mp_id)
    );
    const hourMap = new Map<string, { primaryScans: number; secondaryScans: number }>();
    dateRecords.forEach((r) => {
      const h = String(r.hour);
      const curr = hourMap.get(h) || { primaryScans: 0, secondaryScans: 0 };
      if (r.process_type === 'PRIMARY') curr.primaryScans += r.scan_count;
      if (r.process_type === 'SECONDARY') curr.secondaryScans += r.scan_count;
      hourMap.set(h, curr);
    });

    const rows = Array.from(hourMap.entries())
      .map(([h, val]) => ({
        'Hour': h,
        'Primary Scans': val.primaryScans,
        'Primary Cost (₹)': Number((val.primaryScans * currentRate.primary_rate).toFixed(2)),
        'Secondary Scans': val.secondaryScans,
        'Secondary Cost (₹)': Number((val.secondaryScans * currentRate.secondary_rate).toFixed(2)),
        'Total Scans': val.primaryScans + val.secondaryScans,
        'Total Hourly Earnings (₹)': Number(((val.primaryScans * currentRate.primary_rate) + (val.secondaryScans * currentRate.secondary_rate)).toFixed(2)),
      }))
      .sort((a, b) => Number(a.Hour) - Number(b.Hour));

    exportToCSV(rows, `Hourly_Scans_Report_${operationalDate}.csv`);
    notifyDownload(`Hourly_Scans_Report_${operationalDate}.csv`);
  };

  const handleExportRegisteredPTRoster = () => {
    const rows = db.roster.map((r) => ({
      'Scan_ID': r.scan_id || r.mp_id,
      'Valinor_ID': r.valinor_id || '',
      'MP_Name': r.mp_name,
      'Assigned_Block': r.assigned_block,
      'Status': r.status,
      'Registered At': r.created_at,
    }));
    exportToCSV(rows, `Registered_PT_Roster_${operationalDate}.csv`);
    notifyDownload(`Registered_PT_Roster_${operationalDate}.csv`);
  };

  const handleExportUnregisteredMPs = () => {
    const rows = db.unregisteredMps.map((u) => ({
      'Raw Action User': u.raw_action_user,
      'Scan_ID': u.normalized_mp_id,
      'First Seen Date': u.first_seen_date,
      'Total Scans': u.total_scans_recorded,
      'Last Layout': u.last_layout_used,
      'Status': u.status,
    }));
    exportToCSV(rows, `Unregistered_MP_Report_${operationalDate}.csv`);
    notifyDownload(`Unregistered_MP_Report_${operationalDate}.csv`);
  };

  const handleExportImportHistory = () => {
    const rows = db.importLogs.map((l) => ({
      'Import ID': l.id,
      'File Type': l.file_type,
      'Filename': l.filename,
      'Operational Date': l.operational_date,
      'Uploaded At': l.uploaded_at,
      'Total Rows': l.total_rows,
      'Valid Rows': l.valid_rows,
      'Invalid Rows': l.invalid_rows,
      'Machine Rows': l.machine_sorter_rows,
      'Unknown Layout Rows': l.unknown_layout_rows,
      'Unregistered MP Rows': l.unregistered_mp_rows,
      'Replacement Mode': l.replacement_mode ? 'Yes' : 'No',
      'Status': l.status,
    }));
    exportToCSV(rows, `Import_Audit_History_${operationalDate}.csv`);
    notifyDownload(`Import_Audit_History_${operationalDate}.csv`);
  };

  const reportItems = [
    {
      title: 'Comprehensive Multi-Sheet Daily Excel Report',
      desc: 'All-in-one workbook containing Executive Summary, PT-Wise Earnings, Primary/Secondary breakdowns, Block summaries, and Hourly analytics.',
      badge: 'XLSX Recommended',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-300',
      action: handleDownloadComprehensiveExcel,
      icon: FileSpreadsheet,
    },
    {
      title: 'Database JSON Snapshot & Complete Backup',
      desc: 'Complete daily operational backup including PT roster, rates, scan records, and audit logs formatted in JSON format.',
      badge: 'JSON Backup',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-300',
      action: () => {
        const jsonStr = JSON.stringify(db, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Shadowfax_NBP_DC_Backup_${operationalDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notifyDownload(`Database JSON Backup (${operationalDate})`);
      },
      icon: FileSpreadsheet,
    },
    {
      title: 'Complete Scan Rate Data',
      desc: 'All ingested hourly scan rate rows, user identifiers, Scan_ID, Valinor_ID, layouts, blocks, and payouts.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportScanRateData,
      icon: FileText,
    },
    {
      title: 'Scan History Raw Data',
      desc: 'All ingested scan history records, event types, status markers, Scan_ID, and AWBs.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportScanHistoryData,
      icon: FileText,
    },
    {
      title: 'Daily Summary Report',
      desc: 'Top-level totals for Primary and Secondary scans, cost breakdowns, and active PT counts.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportDailySummary,
      icon: Calendar,
    },
    {
      title: 'Weekly Payment Summary (7 Days)',
      desc: 'Rolling 7-day operational totals, daily scans, and cost progression.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportWeeklySummary,
      icon: Calendar,
    },
    {
      title: 'Monthly Payment Summary',
      desc: 'Month-to-date daily payment totals, scan volume, and cost reconciliation.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportMonthlySummary,
      icon: Calendar,
    },
    {
      title: 'PT-Wise Earnings Ranking',
      desc: 'Registered PT earnings ranking sorted by total actual earnings, with Scan_ID and Valinor_ID.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportPtWiseEarnings,
      icon: Users,
    },
    {
      title: 'Hourly Scans & Earnings Breakdown',
      desc: 'Operational hour-by-hour scan volumes and cumulative cost progression.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportHourlyScans,
      icon: Clock,
    },
    {
      title: 'Registered PT Roster Export',
      desc: 'Current roster database with Scan_ID, Valinor_ID, MP_Name, Assigned_Block, and Status.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportRegisteredPTRoster,
      icon: Users,
    },
    {
      title: 'Unregistered MP Review Report',
      desc: 'Full list of unrecognized action_user identifiers recorded from files, scans, and last layouts.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportUnregisteredMPs,
      icon: Users,
    },
    {
      title: 'Import Audit History & Errors',
      desc: 'Audit logs of all uploaded files, upload timestamps, row counts, and replacements.',
      badge: 'CSV',
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-300',
      action: handleExportImportHistory,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <span>Operational Reports & Downloads Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Export multi-sheet Excel workbooks and CSV files reconciled with Shadowfax DC dashboard formulas.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
            <span className="text-slate-500 mr-1.5 font-medium hidden sm:inline">Report Date:</span>
            <input
              type="date"
              value={operationalDate}
              onChange={(e) => setOperationalDate(e.target.value)}
              className="bg-transparent text-slate-900 font-mono font-bold focus:outline-none cursor-pointer"
            />
          </div>
          {operationalDate === new Date().toISOString().split('T')[0] ? (
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
              Today
            </span>
          ) : (
            <button
              onClick={() => setOperationalDate(new Date().toISOString().split('T')[0])}
              className="text-[11px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-0.5 rounded-md transition-colors"
              title="Set to today's date"
            >
              Reset to Today
            </button>
          )}
        </div>
      </div>

      {downloadSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Grid of Available Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Date: {operationalDate}
                </span>
                <button
                  onClick={item.action}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
