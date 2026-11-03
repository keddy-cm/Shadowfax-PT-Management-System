import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  RotateCcw,
  Check,
  Zap,
  History,
  FileSpreadsheet,
  X,
  AlertCircle,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { AppDatabase } from '../types';
import {
  getTodayDateString,
  getYesterdayDateString,
  formatDisplayDate,
  extractAvailableHistoricalDates,
  HistoricalDateInfo,
} from '../utils/dateUtils';

interface DateFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationalDate: string;
  onSelectDate: (date: string, isLiveToday: boolean) => void;
  db: AppDatabase;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  refreshIntervalSec: number;
  setRefreshIntervalSec: (sec: number) => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshedAt: string;
}

export const DateFilterModal: React.FC<DateFilterModalProps> = ({
  isOpen,
  onClose,
  operationalDate,
  onSelectDate,
  db,
  autoRefresh,
  setAutoRefresh,
  refreshIntervalSec,
  setRefreshIntervalSec,
  onManualRefresh,
  isRefreshing,
  lastRefreshedAt,
}) => {
  if (!isOpen) return null;

  const todayStr = getTodayDateString();
  const yesterdayStr = getYesterdayDateString();
  const isCurrentlyToday = operationalDate === todayStr;

  const [customDate, setCustomDate] = useState(operationalDate);
  const availableDates: HistoricalDateInfo[] = extractAvailableHistoricalDates(db);

  const handleSelectToday = () => {
    onSelectDate(todayStr, true);
    onClose();
  };

  const handleSelectYesterday = () => {
    onSelectDate(yesterdayStr, false);
    onClose();
  };

  const handleSelectCustom = () => {
    if (customDate) {
      onSelectDate(customDate, customDate === todayStr);
      onClose();
    }
  };

  const handleSelectHistoricalDate = (date: string) => {
    onSelectDate(date, date === todayStr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Date & Operational Filter View</h2>
              <p className="text-xs text-slate-300">
                Switch between live current day and historical scan records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Active Date:</span>
            <span className="font-mono font-bold text-slate-900 text-sm bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {operationalDate}
            </span>
            <span className="text-slate-600 font-medium">({formatDisplayDate(operationalDate)})</span>
          </div>

          <div>
            {isCurrentlyToday ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Current Day (Auto-advancing)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 font-bold border border-amber-300 rounded-lg text-xs">
                <History className="w-3.5 h-3.5 text-amber-600" />
                Historical Filter Active
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Quick Filter Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Today Button */}
              <button
                onClick={handleSelectToday}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  isCurrentlyToday
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Today (Current Day)</span>
                    {isCurrentlyToday && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{todayStr}</p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-1">
                    Auto-rollover enabled at midnight
                  </p>
                </div>
              </button>

              {/* Yesterday Button */}
              <button
                onClick={handleSelectYesterday}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  operationalDate === yesterdayStr
                    ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Yesterday</span>
                    {operationalDate === yesterdayStr && <Check className="w-4 h-4 text-amber-600" />}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{yesterdayStr}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    Previous shift scans & payouts
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Date Filter Input */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Custom Historical Date Filter
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Select any past date to view audited scan rates, roster earnings, and logs.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleSelectCustom}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
              >
                Apply Date Filter
              </button>
            </div>
          </div>

          {/* Available Historical Dates in Database */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                Dates with Uploaded Records ({availableDates.length})
              </label>
              <span className="text-[11px] text-slate-400">Click to filter</span>
            </div>

            {availableDates.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                No past scan files uploaded yet. Upload Scan Rate or Scan History files to inspect past dates.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableDates.map((d) => {
                  const isSelected = operationalDate === d.date;
                  return (
                    <button
                      key={d.date}
                      onClick={() => handleSelectHistoricalDate(d.date)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 text-slate-900 font-bold'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{d.date}</span>
                        <span className="text-slate-500 font-normal">({d.formattedDate})</span>
                        {d.isToday && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Today
                          </span>
                        )}
                        {d.isYesterday && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            Yesterday
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-600">
                        <span>
                          <strong className="text-slate-900">{d.scanCount.toLocaleString()}</strong> scans
                        </span>
                        <span>•</span>
                        <span>
                          <strong className="text-slate-900">{d.ptCount}</strong> PTs
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-amber-600 ml-1" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Auto Refresh Configuration */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              Auto Refresh Settings
            </label>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  id="auto-refresh-toggle"
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-0 cursor-pointer accent-amber-600 w-4 h-4"
                />
                <label htmlFor="auto-refresh-toggle" className="font-semibold text-slate-800 cursor-pointer">
                  Auto-refresh active
                </label>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">Interval:</span>
                <select
                  value={refreshIntervalSec}
                  onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                  disabled={!autoRefresh}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-semibold focus:outline-none disabled:opacity-50"
                >
                  <option value={10}>10 seconds</option>
                  <option value={30}>30 seconds (Standard)</option>
                  <option value={60}>60 seconds</option>
                  <option value={120}>2 minutes</option>
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 font-mono">Last: {lastRefreshedAt}</span>
                <button
                  onClick={() => {
                    onManualRefresh();
                  }}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <RotateCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {!isCurrentlyToday ? (
            <button
              onClick={handleSelectToday}
              className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Reset filter & return to Current Day</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Current Day automatically tracks local date
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
