import React, { useState, useMemo } from 'react';
import {
  AppDatabase,
  RateConfig,
  BlockType
} from '../types';
import { calculatePTProfile, PTPerformanceStats } from '../utils/calculator';
import { exportToCSV } from '../utils/excelExport';
import {
  User,
  Search,
  Calendar,
  Download,
  Clock,
  ShieldAlert,
  TrendingUp,
  BarChart2,
  Smartphone,
  Filter,
  History,
  Zap,
} from 'lucide-react';
import { isTodayDate, formatDisplayDate } from '../utils/dateUtils';

interface PtDetailsAndCalculatorProps {
  db: AppDatabase;
  operationalDate: string;
  setOperationalDate: (d: string) => void;
  currentRate: RateConfig;
  selectedPtId?: string | null;
  onSelectPtId: (id: string | null) => void;
  onOpenPtPortal?: () => void;
  onOpenFilterModal?: () => void;
  onResetToToday?: () => void;
}

export const PtDetailsAndCalculator: React.FC<PtDetailsAndCalculatorProps> = ({
  db,
  operationalDate,
  setOperationalDate,
  currentRate,
  selectedPtId,
  onSelectPtId,
  onOpenPtPortal,
  onOpenFilterModal,
  onResetToToday,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBlock, setFilterBlock] = useState<BlockType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'EARNINGS' | 'SCANS' | 'NAME'>('EARNINGS');

  // ONLY registered and active PTs are eligible to be listed!
  const activeRegisteredRoster = useMemo(() => {
    return db.roster.filter((r) => r.status === 'Active');
  }, [db.roster]);

  // Compute summary stats for each active PT to enable ranking by ACTUAL TOTAL EARNINGS
  const rankedPTList = useMemo(() => {
    return activeRegisteredRoster
      .map((pt) => {
        const profile = calculatePTProfile(
          pt.scan_id || pt.mp_id || '',
          operationalDate,
          db.scanRateRecords,
          db.roster,
          currentRate
        );
        return {
          pt,
          profile,
          todayEarnings: profile?.todayTotalEarnings || 0,
          todayScans: profile?.todayTotalScans || 0,
          allTimeEarnings: profile?.allTimeEarnings || 0,
        };
      })
      .filter(({ pt }) => {
        if (filterBlock !== 'ALL' && pt.assigned_block !== filterBlock) return false;
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          return (
            pt.mp_name.toLowerCase().includes(s) ||
            (pt.scan_id && pt.scan_id.toLowerCase().includes(s)) ||
            (pt.valinor_id && pt.valinor_id.toLowerCase().includes(s)) ||
            pt.assigned_block.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'EARNINGS') {
          return b.todayEarnings !== a.todayEarnings
            ? b.todayEarnings - a.todayEarnings
            : b.allTimeEarnings - a.allTimeEarnings;
        }
        if (sortBy === 'SCANS') {
          return b.todayScans - a.todayScans;
        }
        return a.pt.mp_name.localeCompare(b.pt.mp_name);
      });
  }, [activeRegisteredRoster, operationalDate, db.scanRateRecords, db.roster, currentRate, filterBlock, searchTerm, sortBy]);

  // Determine active profile to show - strictly only for actively registered PTs
  const activeProfile: PTPerformanceStats | null = useMemo(() => {
    const validTargetId =
      selectedPtId &&
      activeRegisteredRoster.some(
        (r) => r.scan_id === selectedPtId || r.mp_id === selectedPtId
      )
        ? selectedPtId
        : rankedPTList.length > 0
        ? rankedPTList[0].pt.scan_id || rankedPTList[0].pt.mp_id
        : null;

    if (!validTargetId) return null;
    return calculatePTProfile(validTargetId, operationalDate, db.scanRateRecords, db.roster, currentRate);
  }, [selectedPtId, activeRegisteredRoster, rankedPTList, operationalDate, db.scanRateRecords, db.roster, currentRate]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-600" />
            <span>PT Payment Calculator & Historical Performance Profiles</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Unified single-page view: Individual calculations, hourly earnings progression, and historical ranking for registered PTs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenPtPortal && (
            <button
              onClick={onOpenPtPortal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-lg shadow-xs transition-all"
              title="Get separate link to share with PT workers to check only their own earnings"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Share Worker Portal Link</span>
            </button>
          )}

          <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center px-2 py-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
              <span className="text-slate-500 mr-1.5 font-medium hidden sm:inline">Date:</span>
              <input
                type="date"
                value={operationalDate}
                onChange={(e) => setOperationalDate(e.target.value)}
                className="bg-transparent text-slate-900 font-mono font-bold focus:outline-none cursor-pointer"
              />
            </div>

            {isTodayDate(operationalDate) ? (
              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Live Today
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-1 rounded-md border border-amber-300">
                  <History className="w-3 h-3 text-amber-700" />
                  Past Date
                </span>
                {onResetToToday && (
                  <button
                    onClick={onResetToToday}
                    className="text-[11px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded-md transition-colors"
                    title="Return to today's live calculations"
                  >
                    Today
                  </button>
                )}
              </div>
            )}

            {onOpenFilterModal && (
              <button
                onClick={onOpenFilterModal}
                className="ml-1 flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-950 border border-slate-200 hover:border-amber-300 rounded-md font-bold text-xs transition-colors shadow-2xs"
                title="Filter by past dates"
              >
                <Filter className="w-3 h-3 text-amber-600" />
                <span>Filter View</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {activeRegisteredRoster.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No Registered PTs in Roster</h3>
          <p className="text-sm max-w-md mx-auto mt-2 text-slate-600">
            The PT Roster is currently blank. Please navigate to <strong>Admin Management &gt; PT Roster</strong> to add registered PTs or upload the roster template.
          </p>
          <div className="mt-4 text-xs text-slate-500 font-mono">
            Unregistered MP data is preserved securely in Admin review and is not shown on this dashboard until registered.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Searchable, Sortable Registered PT List (Ranked by Earnings) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-[750px] shadow-xs">
            <div className="border-b border-slate-100 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Registered PTs ({rankedPTList.length})
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Ranked by Total Earnings
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by Scan ID, Valinor ID, or Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Filter by Block and Sort */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Block:</span>
                  <select
                    value={filterBlock}
                    onChange={(e) => setFilterBlock(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="ALL">All Blocks</option>
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                    <option value="D">Block D</option>
                    <option value="E">Block E</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="EARNINGS">Earnings (Desc)</option>
                    <option value="SCANS">Scans (Desc)</option>
                    <option value="NAME">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scrollable PT List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-2 scrollbar-thin pr-1">
              {rankedPTList.length > 0 ? (
                rankedPTList.map(({ pt, profile, todayEarnings, todayScans }, index) => {
                  const ptScanKey = pt.scan_id || pt.mp_id;
                  const isSelected = activeProfile?.scan_id === ptScanKey;
                  return (
                    <div
                      key={ptScanKey}
                      onClick={() => onSelectPtId(ptScanKey || null)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-50/80 border border-amber-300 text-slate-900 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              index === 0
                                ? 'bg-amber-400 text-slate-950'
                                : index === 1
                                ? 'bg-slate-200 text-slate-800'
                                : index === 2
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-xs leading-none text-slate-900">
                              {pt.mp_name}
                            </p>
                            <p className="text-[11px] text-amber-700 font-mono font-medium mt-0.5">
                              Scan ID: {ptScanKey} {pt.valinor_id ? `• ${pt.valinor_id}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-bold font-mono text-emerald-700">
                            ₹{todayEarnings.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {todayScans.toLocaleString()} scans
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-semibold text-slate-700 border border-slate-200">
                          Block {pt.assigned_block}
                        </span>
                        <span>
                          Pri: {profile?.todayPrimaryScans || 0} • Sec: {profile?.todaySecondaryScans || 0}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  No registered PTs found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Detailed Profile, Hourly Breakdown, and History */}
          <div className="lg:col-span-8 space-y-6">
            {activeProfile ? (
              <>
                {/* PT Overview Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-white text-xl shadow-xs">
                        {activeProfile.mp_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900">{activeProfile.mp_name}</h2>
                          <span className="bg-amber-50 text-amber-700 border border-amber-300 text-xs px-2 py-0.5 rounded font-bold font-mono">
                            Block {activeProfile.assigned_block}
                          </span>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] px-2 py-0.5 rounded font-bold">
                            REGISTERED
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          Scan ID: <strong className="text-amber-700">{activeProfile.scan_id}</strong>
                          {activeProfile.valinor_id && (
                            <> • Valinor ID: <strong className="text-slate-800">{activeProfile.valinor_id}</strong></>
                          )}
                          {' '}• Date: {activeProfile.selectedDate}
                        </p>
                      </div>
                    </div>

                    {/* Export PT CSV */}
                    <button
                      onClick={() =>
                        exportToCSV(
                          activeProfile.hourlyBreakdown.map((h) => ({
                            'Hour': h.hour,
                            'Primary Scans': h.primaryScans,
                            'Primary Rate': currentRate.primary_rate,
                            'Primary Earnings': h.primaryEarnings,
                            'Secondary Scans': h.secondaryScans,
                            'Secondary Rate': currentRate.secondary_rate,
                            'Secondary Earnings': h.secondaryEarnings,
                            'Total Hourly Earnings': h.totalHourlyEarnings,
                            'Cumulative Earnings': h.cumulativeEarnings,
                          })),
                          `PT_${activeProfile.scan_id}_Hourly_${activeProfile.selectedDate}.csv`
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 self-start sm:self-auto transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export PT Data</span>
                    </button>
                  </div>

                  {/* Operational Date Earnings Highlight */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-[11px] text-slate-500 font-medium">Total Today's Earnings</p>
                      <p className="text-xl font-bold font-mono text-emerald-700 mt-1">
                        ₹{activeProfile.todayTotalEarnings.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {activeProfile.todayTotalScans.toLocaleString()} total scans
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-[11px] text-slate-500 font-medium">Primary Process</p>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                        ₹{activeProfile.todayPrimaryEarnings.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                        {activeProfile.todayPrimaryScans.toLocaleString()} scans @ ₹{currentRate.primary_rate.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-[11px] text-slate-500 font-medium">Secondary Process</p>
                      <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                        ₹{activeProfile.todaySecondaryEarnings.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-purple-700 font-mono mt-0.5">
                        {activeProfile.todaySecondaryScans.toLocaleString()} scans @ ₹{currentRate.secondary_rate.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <p className="text-[11px] text-slate-500 font-medium">Yesterday's Earnings</p>
                      <p className="text-xl font-bold font-mono text-slate-700 mt-1">
                        ₹{activeProfile.yesterdayTotalEarnings.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Previous operational day
                      </p>
                    </div>
                  </div>

                  {/* Summary Comparison & Historical Records */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500">Weekly Total (7d):</span>
                      <p className="font-mono font-bold text-slate-800">₹{activeProfile.weeklyTotalEarnings.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Monthly Total (30d):</span>
                      <p className="font-mono font-bold text-slate-800">₹{activeProfile.monthlyTotalEarnings.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Highest Earning Day:</span>
                      <p className="font-mono font-bold text-amber-700">
                        {activeProfile.highestEarningDay ? `₹${activeProfile.highestEarningDay.earnings.toFixed(2)} (${activeProfile.highestEarningDay.date})` : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Daily Average:</span>
                      <p className="font-mono font-bold text-slate-800">₹{activeProfile.averageDailyEarnings.toFixed(2)} / day</p>
                    </div>
                  </div>
                </div>

                {/* Hourly Breakdown Table */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Hourly Scans & Earnings Progression
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Date: {activeProfile.selectedDate}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2 mb-3">
                    Aggregated directly from the uploaded file's verified <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">hour</code> field without artificial timestamps.
                  </p>

                  {/* Visual Hourly Velocity Bar Chart */}
                  {activeProfile.hourlyBreakdown.length > 0 && (
                    <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-amber-600" />
                          Hourly Scan Velocity Visual
                        </span>
                        <div className="flex items-center gap-2.5 text-[10px]">
                          <span className="flex items-center gap-1 text-emerald-800 font-medium">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs inline-block" /> Primary
                          </span>
                          <span className="flex items-center gap-1 text-sky-800 font-medium">
                            <span className="w-2.5 h-2.5 bg-sky-500 rounded-xs inline-block" /> Secondary
                          </span>
                        </div>
                      </div>
                      <div className="h-24 flex items-end gap-1 sm:gap-1.5 pt-2">
                        {activeProfile.hourlyBreakdown.map((row) => {
                          const total = row.primaryScans + row.secondaryScans;
                          const maxScans = Math.max(1, ...activeProfile.hourlyBreakdown.map((r) => r.primaryScans + r.secondaryScans));
                          const heightPct = (total / maxScans) * 100;
                          return (
                            <div key={row.hour} className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer">
                              <div
                                className="w-full max-w-[24px] rounded-t overflow-hidden flex flex-col justify-end bg-slate-200 shadow-2xs group-hover:brightness-110 transition-all"
                                style={{ height: `${Math.max(8, heightPct)}%` }}
                                title={`Hour ${row.hour}: ${total} scans (Pri: ${row.primaryScans}, Sec: ${row.secondaryScans}) — ₹${row.totalHourlyEarnings.toFixed(2)}`}
                              >
                                <div
                                  className="w-full bg-sky-500 transition-all"
                                  style={{ height: `${total > 0 ? (row.secondaryScans / total) * 100 : 0}%` }}
                                />
                                <div
                                  className="w-full bg-emerald-500 transition-all"
                                  style={{ height: `${total > 0 ? (row.primaryScans / total) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-slate-500 mt-1 group-hover:font-bold group-hover:text-slate-900">
                                {row.hour}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Hour</th>
                          <th className="py-2.5 px-3 text-right">Primary Scans</th>
                          <th className="py-2.5 px-3 text-right">Primary (₹)</th>
                          <th className="py-2.5 px-3 text-right">Secondary Scans</th>
                          <th className="py-2.5 px-3 text-right">Secondary (₹)</th>
                          <th className="py-2.5 px-3 text-right">Hourly Total (₹)</th>
                          <th className="py-2.5 px-3 text-right">Cumulative (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {activeProfile.hourlyBreakdown.length > 0 ? (
                          activeProfile.hourlyBreakdown.map((row) => (
                            <tr key={row.hour} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-amber-700">
                                Hour {row.hour}
                              </td>
                              <td className="py-2 px-3 text-right">{row.primaryScans.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                                ₹{row.primaryEarnings.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right">{row.secondaryScans.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-purple-700 font-semibold">
                                ₹{row.secondaryEarnings.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ₹{row.totalHourlyEarnings.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-amber-800 bg-amber-50/50">
                                ₹{row.cumulativeEarnings.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                              No hourly scan records available for this PT on {activeProfile.selectedDate}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Historical Daily Performance Log */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-600" />
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Daily Scan & Payment History ({activeProfile.dailyHistory.length} Days)
                      </h3>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 mt-3 max-h-[300px] scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Primary Scans</th>
                          <th className="py-2.5 px-3 text-right">Primary (₹)</th>
                          <th className="py-2.5 px-3 text-right">Secondary Scans</th>
                          <th className="py-2.5 px-3 text-right">Secondary (₹)</th>
                          <th className="py-2.5 px-3 text-right">Total Scans</th>
                          <th className="py-2.5 px-3 text-right">Total Earnings (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {activeProfile.dailyHistory.length > 0 ? (
                          activeProfile.dailyHistory.map((day) => (
                            <tr key={day.date} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {day.date}
                              </td>
                              <td className="py-2 px-3 text-right">{day.primaryScans.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-emerald-700 font-semibold">₹{day.primaryEarnings.toFixed(2)}</td>
                              <td className="py-2 px-3 text-right">{day.secondaryScans.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right text-purple-700 font-semibold">₹{day.secondaryEarnings.toFixed(2)}</td>
                              <td className="py-2 px-3 text-right text-slate-800">{day.totalScans.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-700">₹{day.totalEarnings.toFixed(2)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-500 font-sans">
                              No daily history records found for this PT.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-xs">
                Select a registered PT from the list to view their detailed payment calculations and performance profile.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
