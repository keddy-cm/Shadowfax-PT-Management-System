import React from 'react';
import {
  RefreshCw,
  Calendar,
  Building2,
  BarChart3,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Settings,
  Clock,
  Bot,
  Database,
  Lock,
  Unlock,
  Smartphone,
  Filter,
  History,
  Zap,
} from 'lucide-react';
import { isTodayDate } from '../utils/dateUtils';

export type NavTab =
  | 'dashboard'
  | 'pt-details'
  | 'upload-rate'
  | 'upload-history'
  | 'reports'
  | 'admin'
  | 'mailbot';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  operationalDate: string;
  setOperationalDate: (date: string) => void;
  userRole: 'ADMIN' | 'MANAGER';
  setUserRole: (role: 'ADMIN' | 'MANAGER') => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshedAt: string;
  isAdminAuthenticated: boolean;
  onRequireAdminAuth: () => void;
  onLockAdmin: () => void;
  onOpenSharePtModal: () => void;
  onOpenFilterModal?: () => void;
  onResetToToday?: () => void;
  countdownSec?: number;
  refreshIntervalSec?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  operationalDate,
  setOperationalDate,
  userRole,
  setUserRole,
  autoRefresh,
  setAutoRefresh,
  onManualRefresh,
  isRefreshing,
  lastRefreshedAt,
  isAdminAuthenticated,
  onRequireAdminAuth,
  onLockAdmin,
  onOpenSharePtModal,
  onOpenFilterModal,
  onResetToToday,
  countdownSec,
  refreshIntervalSec = 30,
}) => {
  const isCurrentDay = isTodayDate(operationalDate);

  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3 border-b border-slate-100">
          {/* Logo & Facility Details */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-black text-white text-xl shadow-xs tracking-wider">
              SF
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  Shadowfax NCR Bamnoli DC
                </span>
                <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded font-mono font-bold border border-amber-300">
                  SITE CODE: NBP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                PT Scan & Payment Management System • Manual File Processing Engine
              </p>
            </div>
          </div>

          {/* Operational Date & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Operational Date Selector with Today / Historical Status */}
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
                <span className="text-slate-500 mr-1.5 font-medium hidden sm:inline">Date:</span>
                <input
                  id="operational-date-input"
                  type="date"
                  value={operationalDate}
                  onChange={(e) => setOperationalDate(e.target.value)}
                  className="bg-transparent text-slate-900 font-mono text-xs focus:outline-none cursor-pointer font-bold"
                  title="Select operational date"
                />
              </div>

              {/* Status Indicator */}
              {isCurrentDay ? (
                <div
                  className="flex items-center gap-1 bg-emerald-100/90 text-emerald-800 text-[11px] font-bold px-2 py-1 rounded-lg border border-emerald-300/60"
                  title="Current Day: Automatically updates to tomorrow at midnight."
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Today</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span
                    className="flex items-center gap-1 bg-amber-100 text-amber-900 text-[11px] font-bold px-2 py-1 rounded-lg border border-amber-300"
                    title="Viewing historical records. Automatic date change paused."
                  >
                    <History className="w-3 h-3 text-amber-700" />
                    <span>Past Date</span>
                  </span>
                  {onResetToToday && (
                    <button
                      onClick={onResetToToday}
                      className="text-[11px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                      title="Return immediately to current day"
                    >
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span>Today</span>
                    </button>
                  )}
                </div>
              )}

              {/* Filter View Button */}
              {onOpenFilterModal && (
                <button
                  onClick={onOpenFilterModal}
                  className="ml-1 flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-50 text-slate-800 hover:text-amber-950 border border-slate-200 hover:border-amber-300 rounded-lg font-bold text-xs transition-colors shadow-2xs"
                  title="Open Date Filter & Past Scans Archive"
                >
                  <Filter className="w-3 h-3 text-amber-600" />
                  <span>Filter View</span>
                </button>
              )}
            </div>

            {/* Auto Refresh Toggle & Countdown */}
            <div className="flex items-center bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-0 mr-1.5 cursor-pointer accent-amber-600"
                />
                <span className="text-slate-700 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    Auto {autoRefresh ? `(${countdownSec !== undefined ? `${countdownSec}s` : `${refreshIntervalSec}s`})` : '(Off)'}
                  </span>
                </span>
              </label>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              title={`Re-trigger calculation logic. Last updated: ${lastRefreshedAt}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
              <span className="sm:hidden">Refresh</span>
            </button>

            {/* Local Database Status Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs"
              title="Local Database Engine Active (Zero Cloud Project or Billing Required)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Database: Local Active</span>
            </div>

            {/* Role Switcher */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
                <button
                  onClick={() => {
                    if (!isAdminAuthenticated) {
                      onRequireAdminAuth();
                    } else {
                      setUserRole('ADMIN');
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                    userRole === 'ADMIN'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={isAdminAuthenticated ? 'Admin Mode (Authenticated)' : 'Admin Mode (Requires ID: Admin, Pass: Sfx@123)'}
                >
                  {isAdminAuthenticated ? (
                    <Unlock className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Lock className="w-3 h-3 text-amber-600" />
                  )}
                  <span>Admin</span>
                </button>
                <button
                  onClick={() => setUserRole('MANAGER')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    userRole === 'MANAGER'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manager
                </button>
              </div>

              {isAdminAuthenticated && (
                <button
                  onClick={onLockAdmin}
                  className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors shadow-2xs"
                  title="Lock Admin session"
                >
                  <Lock className="w-3 h-3" />
                  <span className="hidden sm:inline">Lock Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between overflow-x-auto py-2 scrollbar-none gap-2">
          <nav className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('pt-details')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'pt-details'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>PT Details & Calculator</span>
            </button>

            <button
              onClick={() => setActiveTab('upload-rate')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'upload-rate'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Upload Scan Rate File</span>
            </button>

            <button
              onClick={() => setActiveTab('upload-history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'upload-history'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-sky-600" />
              <span>Upload Scan History File</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Reports & Downloads</span>
            </button>

            <button
              onClick={() => setActiveTab('mailbot')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'mailbot'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="MailBot Automailer (Active & Operational)"
            >
              <Bot className="w-4 h-4 text-amber-600" />
              <span>MailBot Automailer</span>
              <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active</span>
              </span>
            </button>

            <button
              onClick={() => {
                if (!isAdminAuthenticated) {
                  onRequireAdminAuth();
                } else {
                  setActiveTab('admin');
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {isAdminAuthenticated ? (
                <Settings className="w-4 h-4 text-slate-900" />
              ) : (
                <Lock className="w-4 h-4 text-amber-600" />
              )}
              <span>Admin Management</span>
            </button>

            <button
              onClick={onOpenSharePtModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all whitespace-nowrap shadow-2xs"
              title="Share separate worker self-service link with PTs"
            >
              <Smartphone className="w-4 h-4 text-amber-700" />
              <span>Share PT Portal Link</span>
            </button>
          </nav>

          <div className="hidden lg:flex items-center text-[11px] text-slate-500 font-mono shrink-0 pl-2">
            Last updated: {lastRefreshedAt}
          </div>
        </div>
      </div>
    </header>
  );
};
