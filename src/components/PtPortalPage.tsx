import React, { useState, useMemo } from 'react';
import { AppDatabase, RateConfig } from '../types';
import { calculatePTProfile, PTPerformanceStats } from '../utils/calculator';
import { exportToCSV } from '../utils/excelExport';
import { verifyPtLogin, PT_AUTH_STORAGE_KEY } from '../utils/auth';
import {
  Lock,
  Calendar,
  Download,
  LogOut,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Layers,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
  Wallet,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

interface PtPortalPageProps {
  db: AppDatabase;
  operationalDate: string;
  currentRate: RateConfig;
}

export const PtPortalPage: React.FC<PtPortalPageProps> = ({
  db,
  operationalDate,
  currentRate,
}) => {
  // Stored logged-in PT scan_id in sessionStorage
  const [loggedInScanId, setLoggedInScanId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(PT_AUTH_STORAGE_KEY);
    }
    return null;
  });

  // Login form state
  const [inputScanId, setInputScanId] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Selected date for viewing earnings (default to operational date)
  const [selectedDate, setSelectedDate] = useState<string>(operationalDate);

  // Sync selectedDate and selectedMonth whenever operationalDate automatically updates
  React.useEffect(() => {
    setSelectedDate(operationalDate);
    setSelectedMonth(operationalDate.slice(0, 7));
  }, [operationalDate]);

  // Selected month filter for monthly overview (default to month of operational date, e.g. "2026-11")
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return operationalDate.slice(0, 7);
  });

  // Current logged in PT roster entry
  const loggedInPt = useMemo(() => {
    if (!loggedInScanId) return null;
    return (
      db.roster.find(
        (r) =>
          r.scan_id === loggedInScanId ||
          r.mp_id === loggedInScanId ||
          (r.scan_id && r.scan_id.toLowerCase() === loggedInScanId.toLowerCase())
      ) || null
    );
  }, [loggedInScanId, db.roster]);

  // Profile data calculated STRICTLY for this logged-in PT only
  const ptProfile: PTPerformanceStats | null = useMemo(() => {
    if (!loggedInScanId || !loggedInPt) return null;
    return calculatePTProfile(
      loggedInPt.scan_id || loggedInPt.mp_id || '',
      selectedDate,
      db.scanRateRecords,
      db.roster,
      currentRate
    );
  }, [loggedInScanId, loggedInPt, selectedDate, db.scanRateRecords, db.roster, currentRate]);

  // Available months list for filtering (includes current and previous months)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const base = new Date(operationalDate);
    // Add current and previous 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(mStr);
    }
    // Also add any month present in the PT's actual daily history
    if (ptProfile?.dailyHistory) {
      ptProfile.dailyHistory.forEach((item) => {
        if (item.date && item.date.length >= 7) {
          set.add(item.date.slice(0, 7));
        }
      });
    }
    return Array.from(set).sort().reverse();
  }, [operationalDate, ptProfile?.dailyHistory]);

  const formatMonthLabel = (mStr: string) => {
    try {
      const [year, month] = mStr.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch {
      return mStr;
    }
  };

  // Day records filtered for the chosen selectedMonth
  const monthDays = useMemo(() => {
    if (!ptProfile?.dailyHistory) return [];
    return ptProfile.dailyHistory.filter((item) => item.date.startsWith(selectedMonth));
  }, [ptProfile?.dailyHistory, selectedMonth]);

  // Aggregated monthly statistics for Month Total Earning view
  const monthStats = useMemo(() => {
    let totalScans = 0;
    let totalEarnings = 0;
    let primaryScans = 0;
    let primaryEarnings = 0;
    let secondaryScans = 0;
    let secondaryEarnings = 0;

    monthDays.forEach((d) => {
      totalScans += d.totalScans;
      totalEarnings = Number((totalEarnings + d.totalEarnings).toFixed(2));
      primaryScans += d.primaryScans;
      primaryEarnings = Number((primaryEarnings + d.primaryEarnings).toFixed(2));
      secondaryScans += d.secondaryScans;
      secondaryEarnings = Number((secondaryEarnings + d.secondaryEarnings).toFixed(2));
    });

    return {
      totalScans,
      totalEarnings,
      primaryScans,
      primaryEarnings,
      secondaryScans,
      secondaryEarnings,
      activeDaysCount: monthDays.length,
      averageDailyEarnings: monthDays.length > 0 ? Number((totalEarnings / monthDays.length).toFixed(2)) : 0,
    };
  }, [monthDays]);

  // Navigate to previous or next month
  const handleShiftMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, direction === 'prev' ? month - 2 : month, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const result = verifyPtLogin(db.roster, inputScanId, inputPassword);
    if (result.success && result.pt) {
      const scanId = result.pt.scan_id || result.pt.mp_id || '';
      sessionStorage.setItem(PT_AUTH_STORAGE_KEY, scanId);
      setLoggedInScanId(scanId);
      setInputPassword('');
    } else {
      setLoginError(result.message);
    }
  };

  // Handle Logout (returns strictly to PT login page)
  const handleLogout = () => {
    sessionStorage.removeItem(PT_AUTH_STORAGE_KEY);
    setLoggedInScanId(null);
    setInputScanId('');
    setInputPassword('');
    setLoginError(null);
  };

  // Download daily slip for worker
  const handleDownloadSlip = () => {
    if (!ptProfile) return;
    const slipRows = ptProfile.hourlyBreakdown.map((h) => ({
      'PT Name': ptProfile.mp_name,
      'Scan ID': ptProfile.scan_id,
      'Valinor ID': ptProfile.valinor_id,
      'Date': selectedDate,
      'Hour': `${h.hour}:00`,
      'Primary Scans': h.primaryScans,
      'Primary Rate (₹)': currentRate.primary_rate,
      'Primary Earnings (₹)': h.primaryEarnings.toFixed(2),
      'Secondary Scans': h.secondaryScans,
      'Secondary Rate (₹)': currentRate.secondary_rate,
      'Secondary Earnings (₹)': h.secondaryEarnings.toFixed(2),
      'Total Hourly Earnings (₹)': h.totalHourlyEarnings.toFixed(2),
      'Cumulative Day Earnings (₹)': h.cumulativeEarnings.toFixed(2),
    }));

    exportToCSV(slipRows, `PT_PayoutSlip_${ptProfile.scan_id}_${selectedDate}.csv`);
  };

  // Download monthly statement for worker
  const handleDownloadMonthStatement = () => {
    if (!ptProfile || monthDays.length === 0) {
      alert(`No records found for ${formatMonthLabel(selectedMonth)}.`);
      return;
    }
    const statementRows = monthDays.map((d) => ({
      'PT Name': ptProfile.mp_name,
      'Scan ID': ptProfile.scan_id,
      'Valinor ID': ptProfile.valinor_id,
      'Month': formatMonthLabel(selectedMonth),
      'Shift Date': d.date,
      'Primary Scans': d.primaryScans,
      'Primary Rate (₹)': d.effectiveRatePrimary,
      'Primary Earnings (₹)': d.primaryEarnings.toFixed(2),
      'Secondary Scans': d.secondaryScans,
      'Secondary Rate (₹)': d.effectiveRateSecondary,
      'Secondary Earnings (₹)': d.secondaryEarnings.toFixed(2),
      'Total Day Scans': d.totalScans,
      'Total Day Earnings (₹)': d.totalEarnings.toFixed(2),
    }));
    exportToCSV(statementRows, `PT_MonthlyStatement_${ptProfile.scan_id}_${selectedMonth}.csv`);
  };

  // -------------------------------------------------------------
  // VIEW 1: STANDALONE LOGIN FORM (NO OTHER OPTION, NO DEMO LABELS)
  // -------------------------------------------------------------
  if (!loggedInScanId || !loggedInPt) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 text-slate-100 font-sans">
        <div className="flex items-center justify-center pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-xl shadow-md tracking-wider">
              SF
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                <span>Shadowfax NCR Bamnoli DC</span>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-500/40 font-mono font-bold">
                  NBP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PT Worker Self-Service Portal
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center flex-1 my-6">
          <div className="max-w-md w-full bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-700/30 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white text-center border-b border-slate-800">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                <Building2 className="w-7 h-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                PT Earnings & Scan Portal
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                Sign in to check your daily scans, hourly productivity, and payout calculation.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5">
              {loginError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  PT Scan ID (Username)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputScanId}
                    onChange={(e) => setInputScanId(e.target.value)}
                    placeholder="Enter your Scan ID"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Your registered mobile number or scan ID.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Password (Last 5 Digits of Valinor ID)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    placeholder="Enter last 5 digits of Valinor ID"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition-colors pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Example: If your Valinor ID is VAL16945, your password is 16945.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Log In & View My Earnings</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 text-center">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Your login ID and password are automatically generated from your active DC roster entry. For any login help, please contact your DC Shift Supervisor.
                </p>
              </div>
            </form>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 pb-4">
          Shadowfax NCR Bamnoli DC (NBP) • Individual Worker Self-Service Portal
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: AUTHENTICATED PT WORKER (STRICTLY OWN DATA, FULLY SEPARATE)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col justify-between">
      {/* Dedicated Standalone Top Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-base shadow-xs">
              SF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">
                  Shadowfax NBP DC
                </span>
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold border border-amber-500/40">
                  WORKER PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                PT Individual Earnings & Productivity Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
              title="Log out of your session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Worker Profile Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-slate-700 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-2xl shadow-inner border border-amber-400/40">
                {loggedInPt.mp_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {loggedInPt.mp_name}
                  </h1>
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
                    Block {loggedInPt.assigned_block}
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ACTIVE ROSTER
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1 font-mono">
                  <span>Scan ID: <strong className="text-amber-400">{loggedInPt.scan_id}</strong></span>
                  <span>•</span>
                  <span>Valinor ID: <strong className="text-white">{loggedInPt.valinor_id}</strong></span>
                  <span>•</span>
                  <span>DC: Bamnoli (NBP)</span>
                </div>
              </div>
            </div>

            {/* Date & Month Filtering Controls Bar */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/90 p-2.5 rounded-2xl border border-slate-700">
              {/* Month Selector Filter (View Previous Months) */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-300 font-medium">Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer font-bold"
                  title="Filter and view previous month data"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white font-sans">
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 ml-1 border-l border-slate-700 pl-1">
                  <button
                    onClick={() => handleShiftMonth('prev')}
                    title="View Previous Month"
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleShiftMonth('next')}
                    title="View Next Month"
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day Shift Date Picker */}
              <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-300 font-medium">Shift Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedMonth(e.target.value.slice(0, 7));
                  }}
                  className="bg-transparent text-white font-mono text-xs focus:outline-none focus:border-amber-400 font-semibold cursor-pointer"
                />
                {selectedDate !== operationalDate && (
                  <button
                    onClick={() => {
                      setSelectedDate(operationalDate);
                      setSelectedMonth(operationalDate.slice(0, 7));
                    }}
                    className="ml-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-1.5 py-0.5 rounded transition-colors"
                    title="Jump to current operational date"
                  >
                    Today
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDownloadSlip}
                  disabled={!ptProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  title="Download your daily hourly calculation slip"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Daily Slip</span>
                </button>
                <button
                  onClick={handleDownloadMonthStatement}
                  disabled={!ptProfile || monthDays.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  title="Download full monthly statement"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Month Statement</span>
                </button>
              </div>
            </div>
          </div>

          {/* Applied Rate Badge */}
          <div className="mt-5 pt-3.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Current DC Rates Applied:</span>
              <span className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded font-mono font-semibold">
                Primary: ₹{currentRate.primary_rate.toFixed(2)}/scan
              </span>
              <span className="bg-slate-800 text-purple-300 px-2 py-0.5 rounded font-mono font-semibold">
                Secondary: ₹{currentRate.secondary_rate.toFixed(2)}/scan
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Selected Shift: <strong className="text-white font-mono">{selectedDate}</strong></span>
              <span>•</span>
              <span>Active Month View: <strong className="text-amber-400 font-mono">{formatMonthLabel(selectedMonth)}</strong></span>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid with "Month Total Earning" prominently featured */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Month Total Earning View */}
          <div className="bg-gradient-to-br from-white to-amber-50/70 border-2 border-amber-400/90 rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-600" />
                <span>Month Total Earning</span>
              </p>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-mono font-bold px-2 py-0.5 rounded border border-amber-300">
                {formatMonthLabel(selectedMonth)}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 mt-2">
              ₹{monthStats.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-between text-xs text-slate-500 font-mono mt-1 pt-1 border-t border-amber-200/60">
              <span>{monthStats.totalScans.toLocaleString()} scans</span>
              <span>{monthStats.activeDaysCount} working days</span>
            </div>
          </div>

          {/* 2. Today's Shift Earnings */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Total Day's Earnings ({selectedDate})
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2">
              ₹{(ptProfile?.todayTotalEarnings || 0).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {(ptProfile?.todayTotalScans || 0).toLocaleString()} total scans today
            </p>
          </div>

          {/* 3. Primary Process */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500" />
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Primary Process (Day)
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2">
              ₹{(ptProfile?.todayPrimaryEarnings || 0).toFixed(2)}
            </p>
            <p className="text-xs text-sky-700 font-mono mt-1">
              {(ptProfile?.todayPrimaryScans || 0).toLocaleString()} scans @ ₹{currentRate.primary_rate.toFixed(2)}
            </p>
          </div>

          {/* 4. Secondary Process */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Secondary Process (Day)
            </p>
            <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-2">
              ₹{(ptProfile?.todaySecondaryEarnings || 0).toFixed(2)}
            </p>
            <p className="text-xs text-purple-700 font-mono mt-1">
              {(ptProfile?.todaySecondaryScans || 0).toLocaleString()} scans @ ₹{currentRate.secondary_rate.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Hourly Scan Breakdown & Timeline */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span>Hourly Scans & Earnings Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hour-by-hour scans registered for your Scan ID on {selectedDate}
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-slate-200 self-start sm:self-auto font-semibold">
              Active Hours Worked: {ptProfile?.hourlyBreakdown.filter((h) => h.primaryScans > 0 || h.secondaryScans > 0).length || 0} hrs
            </span>
          </div>

          {/* Hourly Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Hour Window</th>
                  <th className="py-3 px-3 text-right">Primary Scans</th>
                  <th className="py-3 px-3 text-right">Primary Earnings</th>
                  <th className="py-3 px-3 text-right">Secondary Scans</th>
                  <th className="py-3 px-3 text-right">Secondary Earnings</th>
                  <th className="py-3 px-3 text-right">Total Scans</th>
                  <th className="py-3 px-3 text-right">Hourly Earnings</th>
                  <th className="py-3 px-3 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ptProfile && ptProfile.hourlyBreakdown.length > 0 ? (
                  ptProfile.hourlyBreakdown.map((h) => {
                    const hasActivity = h.primaryScans > 0 || h.secondaryScans > 0;
                    return (
                      <tr
                        key={h.hour}
                        className={hasActivity ? 'bg-white hover:bg-amber-50/50 transition-colors' : 'text-slate-400 bg-slate-50/30'}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {String(h.hour).padStart(2, '0')}:00 - {String(Number(h.hour) + 1).padStart(2, '0')}:00
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {h.primaryScans > 0 ? h.primaryScans.toLocaleString() : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {h.primaryEarnings > 0 ? `₹${h.primaryEarnings.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-700">
                          {h.secondaryScans > 0 ? h.secondaryScans.toLocaleString() : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-700">
                          {h.secondaryEarnings > 0 ? `₹${h.secondaryEarnings.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {hasActivity ? (h.primaryScans + h.secondaryScans).toLocaleString() : '-'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${hasActivity ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {hasActivity ? `₹${h.totalHourlyEarnings.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600 font-semibold">
                          {h.cumulativeEarnings > 0 ? `₹${h.cumulativeEarnings.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No scan activity recorded for your Scan ID on {selectedDate}.
                    </td>
                  </tr>
                )}
              </tbody>
              {ptProfile && (
                <tfoot className="bg-slate-100 font-bold font-mono text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-3 px-3">Total Day Summary</td>
                    <td className="py-3 px-3 text-right">{ptProfile.todayPrimaryScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">₹{ptProfile.todayPrimaryEarnings.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-purple-800">{ptProfile.todaySecondaryScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-purple-800">₹{ptProfile.todaySecondaryEarnings.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right">{ptProfile.todayTotalScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-emerald-800">₹{ptProfile.todayTotalEarnings.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right">₹{ptProfile.todayTotalEarnings.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Per-Day Wise Earnings & Monthly Shift History */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Per-Day Wise Earnings ({formatMonthLabel(selectedMonth)})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily earnings breakdown, primary/secondary scan counts, and shift payouts for {formatMonthLabel(selectedMonth)}
              </p>
            </div>

            {/* Month Filter Selector in table header */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <Filter className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-slate-500 font-medium">Filter Month:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 ml-1 border-l border-slate-300 pl-1">
                  <button
                    onClick={() => handleShiftMonth('prev')}
                    title="View Previous Month"
                    className="p-0.5 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleShiftMonth('next')}
                    title="View Next Month"
                    className="p-0.5 text-slate-500 hover:text-slate-900"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleDownloadMonthStatement}
                disabled={monthDays.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors disabled:opacity-40"
                title="Download this month's daily statement as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Month CSV</span>
              </button>
            </div>
          </div>

          {/* Monthly Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs">
            <div>
              <span className="text-slate-500 font-medium">{formatMonthLabel(selectedMonth)} Total:</span>
              <p className="text-lg font-black font-mono text-emerald-700">
                ₹{monthStats.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Total Monthly Scans:</span>
              <p className="text-lg font-black font-mono text-slate-900">
                {monthStats.totalScans.toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Working Days:</span>
              <p className="text-lg font-black font-mono text-slate-900">
                {monthStats.activeDaysCount} days
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Daily Average:</span>
              <p className="text-lg font-black font-mono text-amber-700">
                ₹{monthStats.averageDailyEarnings.toFixed(2)} / day
              </p>
            </div>
          </div>

          {/* Day-by-Day Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Primary Scans</th>
                  <th className="py-3 px-3 text-right">Primary (₹)</th>
                  <th className="py-3 px-3 text-right">Secondary Scans</th>
                  <th className="py-3 px-3 text-right">Secondary (₹)</th>
                  <th className="py-3 px-3 text-right">Total Scans</th>
                  <th className="py-3 px-3 text-right">Day Earnings (₹)</th>
                  <th className="py-3 px-3 text-center">Hourly Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {monthDays.length > 0 ? (
                  monthDays.map((d) => {
                    const isSelectedDay = d.date === selectedDate;
                    return (
                      <tr
                        key={d.date}
                        className={`transition-colors ${
                          isSelectedDay
                            ? 'bg-amber-50/80 font-bold border-l-4 border-l-amber-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900 font-sans flex items-center gap-1.5">
                          <span>{d.date}</span>
                          {isSelectedDay && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded font-sans">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {d.primaryScans > 0 ? d.primaryScans.toLocaleString() : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                          {d.primaryEarnings > 0 ? `₹${d.primaryEarnings.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-700">
                          {d.secondaryScans > 0 ? d.secondaryScans.toLocaleString() : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-700 font-semibold">
                          {d.secondaryEarnings > 0 ? `₹${d.secondaryEarnings.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {d.totalScans.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 text-sm">
                          ₹{d.totalEarnings.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <button
                            onClick={() => {
                              setSelectedDate(d.date);
                              window.scrollTo({ top: 350, behavior: 'smooth' });
                            }}
                            className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline inline-flex items-center gap-0.5"
                          >
                            <span>View Hourly</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No daily records found for {formatMonthLabel(selectedMonth)}. You can select a previous month using the filter above.
                    </td>
                  </tr>
                )}
              </tbody>
              {monthDays.length > 0 && (
                <tfoot className="bg-slate-100 font-bold font-mono text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-3 px-3 font-sans">Month Total ({monthDays.length} Days)</td>
                    <td className="py-3 px-3 text-right">{monthStats.primaryScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">₹{monthStats.primaryEarnings.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-purple-800">{monthStats.secondaryScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-purple-800">₹{monthStats.secondaryEarnings.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right">{monthStats.totalScans.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-emerald-800 text-sm">₹{monthStats.totalEarnings.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Operational Rules & Policy Notice */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2 leading-relaxed shadow-2xs">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>Operational Payout Rules & Calculation Policy</span>
          </p>
          <p>
            • Rate Multipliers: Primary scans are calculated at <strong>₹{currentRate.primary_rate.toFixed(2)}</strong> per scan; Secondary scans are calculated at <strong>₹{currentRate.secondary_rate.toFixed(2)}</strong> per scan.
          </p>
          <p>
            • Strict Worker Privacy: You are logged into your individual self-service view. Your data is isolated to your assigned Scan ID and Valinor ID.
          </p>
          <p>
            • Discrepancies: In case of physical mismatch with system scans, please contact your DC Shift Incharge with your Scan ID.
          </p>
        </div>
      </main>

      {/* Standalone Worker Portal Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-semibold text-slate-700">
            Shadowfax NCR Bamnoli DC (Site: NBP) • PT Worker Self-Service Portal
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Confidential Worker Portal • Authorized PT Access Only
          </div>
        </div>
      </footer>
    </div>
  );
};
