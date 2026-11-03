import React, { useState } from 'react';
import {
  AppDatabase,
  RateConfig,
  BlockType,
} from '../types';
import {
  calculateDCHourlyBreakdown,
  calculateAllBlocksMetrics,
  DCHourlyStat,
} from '../utils/calculator';
import {
  BarChart2,
  TrendingUp,
  Clock,
  Layers,
  Award,
  Zap,
  ShieldCheck,
  Activity,
  Users,
} from 'lucide-react';

interface AnalyticsChartsProps {
  db: AppDatabase;
  operationalDate: string;
  currentRate: RateConfig;
  selectedBlock?: BlockType | 'ALL';
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  db,
  operationalDate,
  currentRate,
}) => {
  const [chartView, setChartView] = useState<'stacked' | 'grouped'>('stacked');
  const [hoveredHour, setHoveredHour] = useState<DCHourlyStat | null>(null);

  const { hourlyStats, peakHour, totalDayScans, totalDayCost } =
    calculateDCHourlyBreakdown(operationalDate, db.scanRateRecords, db.roster, currentRate);

  const { metrics: blockMetrics, highestBlock } =
    calculateAllBlocksMetrics(operationalDate, db.scanRateRecords, db.roster, currentRate);

  // Active hours count (hours with > 0 scans)
  const activeHoursCount = hourlyStats.filter((h) => h.totalScans > 0).length;

  // Primary vs Secondary totals
  const totalPrimaryScans = hourlyStats.reduce((sum, h) => sum + h.primaryScans, 0);
  const totalSecondaryScans = hourlyStats.reduce((sum, h) => sum + h.secondaryScans, 0);
  const primaryScanPercent = totalDayScans > 0 ? ((totalPrimaryScans / totalDayScans) * 100).toFixed(1) : '0';
  const secondaryScanPercent = totalDayScans > 0 ? ((totalSecondaryScans / totalDayScans) * 100).toFixed(1) : '0';

  // Find max hourly total for scaling the chart height
  const maxHourlyScans = Math.max(1, ...hourlyStats.map((h) => h.totalScans));

  return (
    <div className="space-y-6">
      {/* Top Operational Velocity & Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Peak Velocity */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Peak DC Velocity
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {peakHour ? peakHour.totalScans.toLocaleString() : '0'}
            </span>
            <span className="text-xs text-slate-500">scans/hr</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Peak Hour: {peakHour ? `${peakHour.label} IST` : 'None'}</span>
          </div>
        </div>

        {/* Active Operational Hours */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Shift Hours
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {activeHoursCount}
            </span>
            <span className="text-xs text-slate-500">/ 24 hrs active</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-sky-700 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              Avg: {activeHoursCount > 0 ? Math.round(totalDayScans / activeHoursCount).toLocaleString() : 0} scans/hr
            </span>
          </div>
        </div>

        {/* Highest Producing Block */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Top DC Block
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {highestBlock ? `${highestBlock.block} Block` : 'N/A'}
            </span>
            <span className="text-xs text-slate-500">
              {highestBlock ? `${highestBlock.scanSharePercentage}% share` : ''}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <Users className="w-3.5 h-3.5" />
            <span>
              {highestBlock ? `${highestBlock.totalScans.toLocaleString()} scans (₹${highestBlock.totalCost.toLocaleString()})` : 'No data'}
            </span>
          </div>
        </div>

        {/* DC Process Split Ratio */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Process Ratio
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-emerald-700 font-mono">
              {primaryScanPercent}%
            </span>
            <span className="text-xs text-slate-400">Pri /</span>
            <span className="text-xl font-black text-sky-700 font-mono">
              {secondaryScanPercent}%
            </span>
            <span className="text-xs text-slate-400">Sec</span>
          </div>
          <div className="mt-2 w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${primaryScanPercent}%` }}
              title={`Primary: ${primaryScanPercent}%`}
            />
            <div
              className="bg-sky-500 h-full transition-all"
              style={{ width: `${secondaryScanPercent}%` }}
              title={`Secondary: ${secondaryScanPercent}%`}
            />
          </div>
        </div>
      </div>

      {/* Main Hourly Scan Distribution Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-600" />
              Hourly Scan Volume & Throughput
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hourly aggregate distribution of verified registered PT scans across 24 hours at NBP DC
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                Primary (₹{currentRate.primary_rate.toFixed(2)})
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block" />
                Secondary (₹{currentRate.secondary_rate.toFixed(2)})
              </span>
            </div>

            {/* View Mode */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
              <button
                onClick={() => setChartView('stacked')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  chartView === 'stacked'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Stacked
              </button>
              <button
                onClick={() => setChartView('grouped')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  chartView === 'grouped'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grouped
              </button>
            </div>
          </div>
        </div>

        {/* Hovered Hour Tooltip Ribbon */}
        <div className="py-2.5 px-3 my-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 min-h-[38px]">
          {hoveredHour ? (
            <>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  Hour {hoveredHour.hour} ({hoveredHour.label})
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-semibold text-slate-700">
                  Total Scans: <span className="font-mono text-slate-900">{hoveredHour.totalScans.toLocaleString()}</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-semibold text-emerald-700">
                  Primary: <span className="font-mono">{hoveredHour.primaryScans.toLocaleString()}</span> (₹{hoveredHour.primaryCost.toLocaleString()})
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-semibold text-sky-700">
                  Secondary: <span className="font-mono">{hoveredHour.secondaryScans.toLocaleString()}</span> (₹{hoveredHour.secondaryCost.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Active PTs:</span>
                <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {hoveredHour.activePTs}
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-bold text-amber-700">
                  Hourly Payout: ₹{hoveredHour.totalCost.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <span className="text-slate-500 italic">
              Hover over any hour column to view detailed Primary, Secondary, and active PT counts.
            </span>
          )}
        </div>

        {/* Chart Canvas Area */}
        <div className="h-64 sm:h-72 w-full pt-4 pb-2 flex items-end gap-1 sm:gap-2">
          {hourlyStats.map((stat) => {
            const isPeak = peakHour && peakHour.hour === stat.hour && stat.totalScans > 0;
            const primaryHeightPct = maxHourlyScans > 0 ? (stat.primaryScans / maxHourlyScans) * 100 : 0;
            const secondaryHeightPct = maxHourlyScans > 0 ? (stat.secondaryScans / maxHourlyScans) * 100 : 0;
            const totalHeightPct = maxHourlyScans > 0 ? (stat.totalScans / maxHourlyScans) * 100 : 0;

            return (
              <div
                key={stat.hour}
                onMouseEnter={() => setHoveredHour(stat)}
                onMouseLeave={() => setHoveredHour(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
              >
                {/* Peak Indicator Badge */}
                {isPeak && (
                  <div className="absolute -top-6 text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap animate-bounce">
                    PEAK
                  </div>
                )}

                {/* Bars */}
                {chartView === 'stacked' ? (
                  <div className="w-full flex flex-col justify-end items-center max-w-[28px] h-full">
                    {stat.totalScans === 0 ? (
                      <div className="w-full h-1 bg-slate-200 rounded-t-xs" />
                    ) : (
                      <div
                        className="w-full flex flex-col justify-end rounded-t overflow-hidden transition-all duration-300 group-hover:brightness-110 shadow-xs"
                        style={{ height: `${Math.max(4, totalHeightPct)}%` }}
                      >
                        {/* Secondary (top of stack) */}
                        <div
                          className="w-full bg-sky-500 transition-all"
                          style={{ height: `${totalHeightPct > 0 ? (stat.secondaryScans / stat.totalScans) * 100 : 0}%` }}
                        />
                        {/* Primary (bottom of stack) */}
                        <div
                          className="w-full bg-emerald-500 transition-all"
                          style={{ height: `${totalHeightPct > 0 ? (stat.primaryScans / stat.totalScans) * 100 : 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  // Grouped view
                  <div className="w-full flex items-end justify-center gap-0.5 max-w-[28px] h-full">
                    <div
                      className="w-1/2 bg-emerald-500 rounded-t-xs transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${Math.max(stat.primaryScans > 0 ? 4 : 1, primaryHeightPct)}%` }}
                    />
                    <div
                      className="w-1/2 bg-sky-500 rounded-t-xs transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${Math.max(stat.secondaryScans > 0 ? 4 : 1, secondaryHeightPct)}%` }}
                    />
                  </div>
                )}

                {/* Hour Label */}
                <span className="text-[10px] font-mono text-slate-500 mt-2 group-hover:font-bold group-hover:text-slate-900 transition-colors">
                  {stat.hour}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chart Bottom Summary */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 font-mono">
            <span>Total Day Scans: <strong className="text-slate-900">{totalDayScans.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Total Cost: <strong className="text-slate-900">₹{totalDayCost.toLocaleString()}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strictly isolated to active roster PTs (excluding sorter & unmapped layouts)</span>
          </div>
        </div>
      </div>

      {/* Block-Wise Performance Comparison Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Block-Wise Scan & Payment Distribution (A, B, C, D, E)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational workload and payment allocation per DC block
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          {blockMetrics.map((b) => (
            <div
              key={b.block}
              className={`p-3.5 rounded-xl border transition-all ${
                b.totalScans > 0
                  ? 'bg-slate-50/70 border-slate-200 hover:border-amber-400 hover:shadow-xs'
                  : 'bg-slate-50/30 border-slate-200/60 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 font-mono bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                  Block {b.block}
                </span>
                <span className="text-xs font-bold text-amber-700 font-mono">
                  {b.scanSharePercentage}%
                </span>
              </div>

              <div className="mt-2.5">
                <div className="text-lg font-black text-slate-900 font-mono">
                  {b.totalScans.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">total scans</div>
              </div>

              {/* Share Progress Bar */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${b.scanSharePercentage}%` }}
                />
              </div>

              {/* Sub-metrics */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Payout:</span>
                  <span className="font-mono font-bold text-slate-900">₹{b.totalCost.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Active PTs:</span>
                  <span className="font-mono font-bold text-slate-900">{b.activePTCount}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-emerald-700 font-medium">Pri: {b.primaryScans.toLocaleString()}</span>
                  <span className="text-sky-700 font-medium">Sec: {b.secondaryScans.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
