import React, { useState } from 'react';
import {
  BlockType,
  AppDatabase,
  RateConfig,
} from '../types';
import { calculateDashboardSummary, getActiveRosterScanIds } from '../utils/calculator';
import {
  Users,
  Scan,
  Coins,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  Download,
  Info,
  Bot,
  FileArchive,
  Smartphone,
  History,
  Zap,
  Sparkles,
} from 'lucide-react';
import { exportToCSV } from '../utils/excelExport';
import { AnalyticsCharts } from './AnalyticsCharts';
import { isTodayDate, formatDisplayDate } from '../utils/dateUtils';

interface DashboardProps {
  db: AppDatabase;
  operationalDate: string;
  currentRate: RateConfig;
  onViewPtDetails: (scanId: string) => void;
  onOpenUploadRate: () => void;
  onOpenUploadHistory: () => void;
  onOpenMailBot?: () => void;
  onOpenPtPortal?: () => void;
  onOpenFilterModal?: () => void;
  onResetToToday?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  db,
  operationalDate,
  currentRate,
  onViewPtDetails,
  onOpenUploadRate,
  onOpenUploadHistory,
  onOpenMailBot,
  onOpenPtPortal,
  onOpenFilterModal,
  onResetToToday,
}) => {
  const [selectedBlock, setSelectedBlock] = useState<BlockType | 'ALL'>('ALL');
  const [primarySearch, setPrimarySearch] = useState('');
  const [secondarySearch, setSecondarySearch] = useState('');

  // Calculate summary based exclusively on registered roster and selected block
  const summary = calculateDashboardSummary(
    operationalDate,
    db.scanRateRecords,
    db.roster,
    currentRate,
    selectedBlock
  );

  const activeScanIdSet = getActiveRosterScanIds(db.roster);

  const lastScanRateImport = db.importLogs.find(
    (l) => l.file_type === 'SCAN_RATE' && l.status === 'SUCCESS'
  );

  // Strictly filter for records belonging to active registered PTs
  const registeredRecordsForDate = db.scanRateRecords.filter(
    (r) =>
      r.operational_date === operationalDate &&
      !r.is_machine &&
      activeScanIdSet.has(r.normalized_mp_id)
  );

  const recordsForDateCount = registeredRecordsForDate.length;

  const unregisteredScansCount = db.scanRateRecords
    .filter(
      (r) =>
        r.operational_date === operationalDate &&
        !r.is_machine &&
        !activeScanIdSet.has(r.normalized_mp_id)
    )
    .reduce((acc, r) => acc + r.scan_count, 0);

  const machineRecordsCount = db.scanRateRecords.filter(
    (r) => r.operational_date === operationalDate && r.is_machine
  ).reduce((acc, r) => acc + r.scan_count, 0);

  const filteredPrimaryPTs = summary.primaryPTs.filter(
    (pt) =>
      pt.mp_name.toLowerCase().includes(primarySearch.toLowerCase()) ||
      pt.scan_id.includes(primarySearch) ||
      pt.valinor_id.toLowerCase().includes(primarySearch.toLowerCase())
  );

  const filteredSecondaryPTs = summary.secondaryPTs.filter(
    (pt) =>
      pt.mp_name.toLowerCase().includes(secondarySearch.toLowerCase()) ||
      pt.scan_id.includes(secondarySearch) ||
      pt.valinor_id.toLowerCase().includes(secondarySearch.toLowerCase())
  );

  const blockTabs: { id: BlockType | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'Overall View' },
    { id: 'A', label: 'A Block' },
    { id: 'B', label: 'B Block' },
    { id: 'C', label: 'C Block' },
    { id: 'D', label: 'D Block' },
    { id: 'E', label: 'E Block' },
  ];

  return (
    <div className="space-y-6">
      {/* Historical Filter Active Notice */}
      {!isTodayDate(operationalDate) && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/60 to-orange-50 border border-amber-300 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-800 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <History className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-950">
                  Viewing Historical Data: {operationalDate} ({formatDisplayDate(operationalDate)})
                </span>
                <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  Past Shift
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                All DC summary metrics, hourly scan curves, and individual PT earnings below reflect this historical date. Automatic day-rollover is paused while viewing archives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {onOpenFilterModal && (
              <button
                onClick={onOpenFilterModal}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors shadow-2xs"
              >
                <Filter className="w-3.5 h-3.5 text-amber-600" />
                <span>Change Date</span>
              </button>
            )}
            {onResetToToday && (
              <button
                onClick={onResetToToday}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Return to Today</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Status & File Upload Alerts */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Ops Date:</span>
            <span className="bg-slate-100 text-slate-900 font-mono font-bold px-2.5 py-1 rounded-lg border border-slate-200">
              {operationalDate}
            </span>
            {isTodayDate(operationalDate) ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 font-bold text-xs px-2 py-0.5 rounded border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Today
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 font-bold text-xs px-2 py-0.5 rounded border border-amber-300">
                <History className="w-3 h-3 text-amber-700" />
                Archive
              </span>
            )}
            {onOpenFilterModal && (
              <button
                onClick={onOpenFilterModal}
                className="text-xs text-amber-700 hover:text-amber-800 hover:underline font-semibold ml-1 flex items-center gap-0.5"
                title="Filter by past dates"
              >
                <Filter className="w-3 h-3" />
                <span>Filter</span>
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Last Scan Rate Import:</span>
            {lastScanRateImport ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-mono text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {lastScanRateImport.filename} ({new Date(lastScanRateImport.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            ) : (
              <span className="text-amber-700 text-xs flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                No Scan Rate file uploaded yet
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Machine Sorter:</span>
            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
              {machineRecordsCount.toLocaleString()} scans (₹0)
            </span>
          </div>

          {unregisteredScansCount > 0 && (
            <>
              <div className="h-4 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{unregisteredScansCount.toLocaleString()} unregistered scans hidden (manage in Admin)</span>
              </div>
            </>
          )}
        </div>

        {/* Quick Upload Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenPtPortal && (
            <button
              onClick={onOpenPtPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-all"
              title="Get isolated link for PT workers to log in to their separate earnings portal"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Worker Portal Link</span>
            </button>
          )}

          {onOpenMailBot && (
            <button
              onClick={onOpenMailBot}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="Open MailBot automated daily email dispatcher (Active)"
            >
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <span>MailBot</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          )}

          <button
            onClick={onOpenUploadRate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload Scan Rate</span>
          </button>
          <button
            onClick={onOpenUploadHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Upload Scan History</span>
          </button>
        </div>
      </div>

      {/* Empty State / Ready for Production Banner */}
      {recordsForDateCount === 0 && (
        <div className="bg-gradient-to-r from-amber-50/80 to-amber-100/50 border border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-xs sm:text-sm">
              <p className="font-bold text-slate-900">
                Fresh Production Setup — Ready for Operational Data ({operationalDate})
              </p>
              <p className="text-slate-600 mt-0.5 leading-relaxed text-xs">
                {db.roster.length === 0
                  ? "Roster and scan database are pristine with zero dummy data. Upload your PT Roster in Admin Panel and ingest the hourly Scan Rate File to begin live payment calculations."
                  : `Roster has ${db.roster.length} registered PT personnel. Upload the hourly Scan Rate File (.xlsx or .csv) to calculate live Primary and Secondary payouts for ${operationalDate}.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={onOpenUploadRate}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Upload Scan Rate</span>
            </button>
          </div>
        </div>
      )}

      {/* Block Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-2 rounded-xl shadow-xs">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 px-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-amber-600" /> Block Filter:
          </span>
          {blockTabs.map((tab) => {
            const isActive = selectedBlock === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedBlock(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-500 px-2 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Attributed strictly by PT Roster block assignment</span>
        </div>
      </div>

      {/* Overall KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Registered Active PTs</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {new Set([...summary.primaryPTs.map((p) => p.scan_id), ...summary.secondaryPTs.map((p) => p.scan_id)]).size}
            </span>
            <span className="text-xs text-slate-500">in {selectedBlock === 'ALL' ? 'All Blocks' : `Block ${selectedBlock}`}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Eligible Scans</span>
            <Scan className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {summary.totalCombinedScans.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">scans</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Primary Payout</span>
            <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              @ ₹{summary.primaryRate.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              ₹{summary.totalPrimaryCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Secondary Payout</span>
            <span className="text-xs font-mono text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
              @ ₹{summary.secondaryRate.toFixed(2)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-700">
              ₹{summary.totalSecondaryCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics, Hourly Throughput Chart & Block Distribution */}
      <AnalyticsCharts
        db={db}
        operationalDate={operationalDate}
        currentRate={currentRate}
        selectedBlock={selectedBlock}
      />

      {/* Two Column Layout: Primary Section & Secondary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= PRIMARY SECTION ================= */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 tracking-wide">
                  PRIMARY PROCESS
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  STATUS: RECEIVED_AT_DC
                </span>
              </div>
              <button
                onClick={() =>
                  exportToCSV(
                    summary.primaryPTs.map((p) => ({
                      'Scan_ID': p.scan_id,
                      'Valinor_ID': p.valinor_id,
                      'MP_Name': p.mp_name,
                      'Block': p.assigned_block,
                      'Scans': p.scans,
                      'Rate': p.rate,
                      'Total Cost': p.total_cost,
                    })),
                    `Primary_PT_Report_${operationalDate}_${selectedBlock}.csv`
                  )
                }
                title="Download CSV"
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>

            {/* Primary KPI Mini-bar */}
            <div className="grid grid-cols-4 gap-2 my-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Total PTs</p>
                <p className="text-lg font-bold font-mono text-slate-900">{summary.totalPrimaryPTs}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total Scans</p>
                <p className="text-lg font-bold font-mono text-emerald-700">{summary.totalPrimaryScans.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Rate</p>
                <p className="text-lg font-bold font-mono text-slate-700">₹{summary.primaryRate.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total Cost</p>
                <p className="text-lg font-bold font-mono text-emerald-700">₹{summary.totalPrimaryCost.toLocaleString()}</p>
              </div>
            </div>

            {/* Search filter */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search Primary PT by Scan ID, Valinor ID, or Name..."
                value={primarySearch}
                onChange={(e) => setPrimarySearch(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Primary Table with Scan_ID and Valinor_ID */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[420px] scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">MP Name</th>
                    <th className="py-2.5 px-2">Scan ID</th>
                    <th className="py-2.5 px-2">Valinor ID</th>
                    <th className="py-2.5 px-2">Block</th>
                    <th className="py-2.5 px-3 text-right">Today's Scans</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {filteredPrimaryPTs.length > 0 ? (
                    filteredPrimaryPTs.map((pt) => (
                      <tr key={pt.scan_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900 truncate max-w-[130px]">
                          {pt.mp_name}
                        </td>
                        <td className="py-2 px-2 text-amber-700 font-bold">{pt.scan_id}</td>
                        <td className="py-2 px-2 text-slate-500">{pt.valinor_id || '-'}</td>
                        <td className="py-2 px-2">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-slate-200">
                            {pt.assigned_block}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {pt.scans.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">
                          ₹{pt.total_cost.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => onViewPtDetails(pt.scan_id)}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 font-sans font-semibold hover:underline"
                          >
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                        No registered PTs found for Primary process matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-slate-500 font-sans border-t border-slate-100 mt-3">
            Primary Rate Applied: ₹{summary.primaryRate.toFixed(2)} • Matched via Scan_ID
          </div>
        </div>

        {/* ================= SECONDARY SECTION ================= */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                <h2 className="text-base font-bold text-slate-900 tracking-wide">
                  SECONDARY PROCESS
                </h2>
                <span className="text-[10px] bg-purple-50 text-purple-700 font-mono px-2 py-0.5 rounded border border-purple-200 font-semibold">
                  STATUS: MANIFEST / OUTBOUND
                </span>
              </div>
              <button
                onClick={() =>
                  exportToCSV(
                    summary.secondaryPTs.map((p) => ({
                      'Scan_ID': p.scan_id,
                      'Valinor_ID': p.valinor_id,
                      'MP_Name': p.mp_name,
                      'Block': p.assigned_block,
                      'Scans': p.scans,
                      'Rate': p.rate,
                      'Total Cost': p.total_cost,
                    })),
                    `Secondary_PT_Report_${operationalDate}_${selectedBlock}.csv`
                  )
                }
                title="Download CSV"
                className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>

            {/* Secondary KPI Mini-bar */}
            <div className="grid grid-cols-4 gap-2 my-4 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Total PTs</p>
                <p className="text-lg font-bold font-mono text-slate-900">{summary.totalSecondaryPTs}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total Scans</p>
                <p className="text-lg font-bold font-mono text-purple-700">{summary.totalSecondaryScans.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Rate</p>
                <p className="text-lg font-bold font-mono text-slate-700">₹{summary.secondaryRate.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total Cost</p>
                <p className="text-lg font-bold font-mono text-purple-700">₹{summary.totalSecondaryCost.toLocaleString()}</p>
              </div>
            </div>

            {/* Search filter */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search Secondary PT by Scan ID, Valinor ID, or Name..."
                value={secondarySearch}
                onChange={(e) => setSecondarySearch(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
              />
            </div>

            {/* Secondary Table with Scan_ID and Valinor_ID */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[420px] scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">MP Name</th>
                    <th className="py-2.5 px-2">Scan ID</th>
                    <th className="py-2.5 px-2">Valinor ID</th>
                    <th className="py-2.5 px-2">Block</th>
                    <th className="py-2.5 px-3 text-right">Today's Scans</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {filteredSecondaryPTs.length > 0 ? (
                    filteredSecondaryPTs.map((pt) => (
                      <tr key={pt.scan_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900 truncate max-w-[130px]">
                          {pt.mp_name}
                        </td>
                        <td className="py-2 px-2 text-amber-700 font-bold">{pt.scan_id}</td>
                        <td className="py-2 px-2 text-slate-500">{pt.valinor_id || '-'}</td>
                        <td className="py-2 px-2">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-slate-200">
                            {pt.assigned_block}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {pt.scans.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-purple-700">
                          ₹{pt.total_cost.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => onViewPtDetails(pt.scan_id)}
                            className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 font-sans font-semibold hover:underline"
                          >
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                        No registered PTs found for Secondary process matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-slate-500 font-sans border-t border-slate-100 mt-3">
            Secondary Rate Applied: ₹{summary.secondaryRate.toFixed(2)} • Matched via Scan_ID
          </div>
        </div>
      </div>
    </div>
  );
};
