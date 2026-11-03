import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  ScanRateRecord,
  ImportAuditLog,
  ProcessType,
  RateConfig,
  BlockType
} from '../types';
import { normalizeMpId, isMachineSorter } from '../utils/normalizer';
import { classifyLayout, sanitizeLayoutName } from '../utils/layoutRules';
import {
  commitScanRateImport,
  recordUnknownLayout,
  recordUnregisteredMP,
  getActiveRateForDate,
} from '../db/storage';
import { downloadScanRateTemplate } from '../utils/excelExport';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  FileText,
  Info,
  Layers,
  Check,
} from 'lucide-react';

interface UploadScanRateModalProps {
  db: AppDatabase;
  currentDate: string;
  onImportComplete: (summary: string) => void;
  onCancel?: () => void;
}

interface ParsedScanRateRow {
  action_user: string;
  normalized_mp_id: string;
  valinor_id?: string;
  layout_name: string;
  hour: string | number;
  scan_count: number;
  isMachine: boolean;
  isUnknownLayout: boolean;
  isRegistered: boolean;
  processType: ProcessType;
  assignedBlock?: BlockType;
  primaryEarnings: number;
  secondaryEarnings: number;
  totalEarnings: number;
  reason: string;
}

export type ScanTypeOption = 'PRIMARY' | 'SECONDARY' | 'AUTO';

export const UploadScanRateModal: React.FC<UploadScanRateModalProps> = ({
  db,
  currentDate,
  onImportComplete,
  onCancel,
}) => {
  const [operationalDate, setOperationalDate] = useState(currentDate);
  const [scanTypeOption, setScanTypeOption] = useState<ScanTypeOption>('PRIMARY');
  const [replacementMode, setReplacementMode] = useState<'HOURLY_REPLACE' | 'FULL_DAY_REPLACE' | 'APPEND'>('HOURLY_REPLACE');
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cachedRawJson, setCachedRawJson] = useState<any[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedScanRateRow[]>([]);
  const [invalidRowCount, setInvalidRowCount] = useState(0);
  const [previewHours, setPreviewHours] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const effectiveRate = getActiveRateForDate(operationalDate);

  const processRowsWithOption = (
    rawJson: any[],
    typeOption: ScanTypeOption,
    targetDate: string
  ): {
    rows: ParsedScanRateRow[];
    invalid: number;
    hours: string[];
  } => {
    if (rawJson.length === 0) return { rows: [], invalid: 0, hours: [] };

    const sampleKeys = Object.keys(rawJson[0]).map((k) => k.trim());
    const userKey = sampleKeys.find((k) => /action_user|actionuser|user|scan_id|scanid|pt_id/i.test(k));
    const layoutKey = sampleKeys.find((k) => /layout_name|layoutname|layout/i.test(k));
    const hourKey = sampleKeys.find((k) => /^hour$/i.test(k) || /hour_id/i.test(k));
    const countKey = sampleKeys.find((k) => /scan_count|scancount|scans|count/i.test(k));

    if (!userKey || !layoutKey || !hourKey || !countKey) {
      return { rows: [], invalid: 0, hours: [] };
    }

    const rate = getActiveRateForDate(targetDate);
    // Map by scan_id for data matching
    const activeRosterMap = new Map(
      db.roster.map((r) => [r.scan_id || r.mp_id, r])
    );

    const results: ParsedScanRateRow[] = [];
    let invalidCount = 0;
    const hourSet = new Set<string>();

    rawJson.forEach((row) => {
      const rawUser = String(row[userKey] || '').trim();
      const rawLayout = sanitizeLayoutName(row[layoutKey]);
      const rawHour = row[hourKey];
      const rawCount = Number(row[countKey]);

      if (!rawUser || !rawLayout || isNaN(rawCount) || rawCount < 0) {
        invalidCount++;
        return;
      }

      const normalizedScanId = normalizeMpId(rawUser);
      const isMachine = isMachineSorter(rawUser, rawLayout);
      const layoutCheck = classifyLayout(rawLayout, rawUser);
      const ptRosterEntry = activeRosterMap.get(normalizedScanId);
      const isRegistered = Boolean(ptRosterEntry && ptRosterEntry.status === 'Active');

      const hStr = String(rawHour).trim();
      hourSet.add(hStr);

      let processType: ProcessType = 'UNKNOWN';
      let primaryEarnings = 0;
      let secondaryEarnings = 0;
      let totalEarnings = 0;
      let reason = '';

      if (isMachine) {
        processType = 'MACHINE_SORTER';
        reason = 'Machine Sorter Layout (NBP-MU-01 / Muvro). Excluded from PT payments.';
      } else if (typeOption === 'PRIMARY') {
        processType = 'PRIMARY';
        reason = `Selected: 1. Primary Scan (@ ₹${rate.primary_rate.toFixed(2)})`;
        if (isRegistered) {
          primaryEarnings = Number((rawCount * rate.primary_rate).toFixed(2));
          totalEarnings = primaryEarnings;
        }
      } else if (typeOption === 'SECONDARY') {
        processType = 'SECONDARY';
        reason = `Selected: 2. Secondary Scan (@ ₹${rate.secondary_rate.toFixed(2)})`;
        if (isRegistered) {
          secondaryEarnings = Number((rawCount * rate.secondary_rate).toFixed(2));
          totalEarnings = secondaryEarnings;
        }
      } else {
        processType = layoutCheck.processType;
        reason = layoutCheck.reason;
        if (layoutCheck.isEligible && isRegistered) {
          if (processType === 'PRIMARY') {
            primaryEarnings = Number((rawCount * rate.primary_rate).toFixed(2));
          } else if (processType === 'SECONDARY') {
            secondaryEarnings = Number((rawCount * rate.secondary_rate).toFixed(2));
          }
          totalEarnings = Number((primaryEarnings + secondaryEarnings).toFixed(2));
        }
      }

      results.push({
        action_user: rawUser,
        normalized_mp_id: normalizedScanId,
        valinor_id: ptRosterEntry?.valinor_id,
        layout_name: rawLayout,
        hour: hStr,
        scan_count: rawCount,
        isMachine,
        isUnknownLayout: typeOption === 'AUTO' ? layoutCheck.isUnknown : false,
        isRegistered,
        processType,
        assignedBlock: ptRosterEntry?.assigned_block,
        primaryEarnings,
        secondaryEarnings,
        totalEarnings,
        reason,
      });
    });

    return {
      rows: results,
      invalid: invalidCount,
      hours: Array.from(hourSet).sort((a, b) => Number(a) - Number(b)),
    };
  };

  const handleScanTypeChange = (newOption: ScanTypeOption) => {
    setScanTypeOption(newOption);
    if (cachedRawJson.length > 0) {
      const processed = processRowsWithOption(cachedRawJson, newOption, operationalDate);
      setParsedRows(processed.rows);
      setInvalidRowCount(processed.invalid);
      setPreviewHours(processed.hours);
    }
  };

  const handleDateChange = (newDate: string) => {
    setOperationalDate(newDate);
    if (cachedRawJson.length > 0) {
      const processed = processRowsWithOption(cachedRawJson, scanTypeOption, newDate);
      setParsedRows(processed.rows);
      setInvalidRowCount(processed.invalid);
      setPreviewHours(processed.hours);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary', raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          defval: '',
        });

        if (rawJson.length === 0) {
          setParseError('The uploaded file is empty.');
          setIsProcessing(false);
          return;
        }

        const sampleKeys = Object.keys(rawJson[0]).map((k) => k.trim());
        const userKey = sampleKeys.find((k) => /action_user|actionuser|user|scan_id|scanid|pt_id/i.test(k));
        const layoutKey = sampleKeys.find((k) => /layout_name|layoutname|layout/i.test(k));
        const hourKey = sampleKeys.find((k) => /^hour$/i.test(k) || /hour_id/i.test(k));
        const countKey = sampleKeys.find((k) => /scan_count|scancount|scans|count/i.test(k));

        if (!userKey || !layoutKey || !hourKey || !countKey) {
          setParseError(
            `Missing required columns. File must contain: action_user, layout_name, hour, scan_count. Found columns: ${sampleKeys.join(', ')}`
          );
          setIsProcessing(false);
          return;
        }

        setCachedRawJson(rawJson);

        const processed = processRowsWithOption(rawJson, scanTypeOption, operationalDate);
        setParsedRows(processed.rows);
        setInvalidRowCount(processed.invalid);
        setPreviewHours(processed.hours);
        setIsProcessing(false);
      } catch (err: any) {
        setParseError(`Failed to parse file: ${err.message || 'Unknown error'}`);
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleCommit = () => {
    if (parsedRows.length === 0) return;

    const importId = 'imp-rate-' + Date.now();
    const now = new Date().toISOString();

    const records: ScanRateRecord[] = parsedRows.map((row) => ({
      id: 'srr-' + Math.random().toString(36).substr(2, 9),
      import_id: importId,
      operational_date: operationalDate,
      action_user: row.action_user,
      normalized_mp_id: row.normalized_mp_id,
      valinor_id: row.valinor_id,
      layout_name: row.layout_name,
      hour: row.hour,
      scan_count: row.scan_count,
      process_type: row.processType,
      is_machine: row.isMachine,
      is_registered: row.isRegistered,
      assigned_block: row.assignedBlock,
      primary_rate_applied: effectiveRate.primary_rate,
      secondary_rate_applied: effectiveRate.secondary_rate,
      primary_earnings: row.primaryEarnings,
      secondary_earnings: row.secondaryEarnings,
      total_earnings: row.totalEarnings,
      created_at: now,
    }));

    parsedRows.forEach((r) => {
      if (r.isUnknownLayout) {
        recordUnknownLayout(r.layout_name, operationalDate, fileName, r.scan_count);
      }
      if (!r.isMachine && !r.isRegistered) {
        recordUnregisteredMP(r.action_user, r.normalized_mp_id, operationalDate, r.scan_count, r.layout_name);
      }
    });

    let hoursToReplace: Array<string | number> = [];
    if (replacementMode === 'HOURLY_REPLACE') {
      hoursToReplace = previewHours;
    } else if (replacementMode === 'FULL_DAY_REPLACE') {
      hoursToReplace = Array.from({ length: 24 }, (_, i) => String(i));
    }

    const machineCount = parsedRows.filter((r) => r.isMachine).length;
    const unknownLayoutCount = parsedRows.filter((r) => r.isUnknownLayout).length;
    const unregCount = parsedRows.filter((r) => !r.isMachine && !r.isRegistered).length;

    const auditLog: ImportAuditLog = {
      id: importId,
      file_type: 'SCAN_RATE',
      filename: `${fileName} [${scanTypeOption === 'PRIMARY' ? 'Primary Scan' : scanTypeOption === 'SECONDARY' ? 'Secondary Scan' : 'Auto-Layout'}]`,
      operational_date: operationalDate,
      uploaded_at: now,
      total_rows: parsedRows.length + invalidRowCount,
      valid_rows: parsedRows.length,
      invalid_rows: invalidRowCount,
      machine_sorter_rows: machineCount,
      unknown_layout_rows: unknownLayoutCount,
      unregistered_mp_rows: unregCount,
      replacement_mode: replacementMode !== 'APPEND',
      status: 'SUCCESS',
    };

    commitScanRateImport(operationalDate, records, auditLog, hoursToReplace);

    const typeDesc = scanTypeOption === 'PRIMARY' ? 'Primary Scans' : scanTypeOption === 'SECONDARY' ? 'Secondary Scans' : 'Scans';
    onImportComplete(
      `Successfully processed ${fileName} as ${typeDesc} for ${operationalDate}: ${parsedRows.length} rows imported (${previewHours.length} hours replaced without duplicates).`
    );
  };

  const totalScans = parsedRows.reduce((a, b) => a + b.scan_count, 0);
  const eligiblePrimaryScans = parsedRows.filter((r) => !r.isMachine && r.isRegistered && r.processType === 'PRIMARY').reduce((a, b) => a + b.scan_count, 0);
  const eligibleSecondaryScans = parsedRows.filter((r) => !r.isMachine && r.isRegistered && r.processType === 'SECONDARY').reduce((a, b) => a + b.scan_count, 0);
  const machineScans = parsedRows.filter((r) => r.isMachine).reduce((a, b) => a + b.scan_count, 0);
  const unregScans = parsedRows.filter((r) => !r.isMachine && !r.isRegistered).reduce((a, b) => a + b.scan_count, 0);
  const totalPayout = parsedRows.reduce((a, b) => a + b.totalEarnings, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Upload Scan Rate File (Aggregated Hourly Data)
            </h2>
            <p className="text-xs text-slate-500">
              Matches with PT Roster on <code className="text-amber-700 font-mono font-bold">Scan_ID</code>. Required columns: <code className="font-mono text-slate-700">action_user, layout_name, hour, scan_count</code>
            </p>
          </div>
        </div>

        <button
          onClick={downloadScanRateTemplate}
          className="text-xs text-amber-800 hover:text-amber-900 flex items-center gap-1.5 font-semibold border border-amber-300 bg-amber-50 px-3 py-1.5 rounded-lg shadow-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Download Template CSV</span>
        </button>
      </div>

      {/* ================= SCAN TYPE OPTIONS: 1. PRIMARY SCAN  2. SECONDARY SCAN ================= */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-600" />
          <span>Select Upload Scan Type</span>
          <span className="text-[11px] text-slate-500 font-normal lowercase">(choose how scans in this file will be classified)</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Option 1: Primary Scan */}
          <button
            type="button"
            onClick={() => handleScanTypeChange('PRIMARY')}
            className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              scanTypeOption === 'PRIMARY'
                ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-xs ring-1 ring-emerald-500'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-bold text-slate-900">Primary Scan</span>
              </div>
              {scanTypeOption === 'PRIMARY' && (
                <Check className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              Classifies all eligible PT scans in file as <strong>Primary</strong> (Infeed / Receiving)
            </p>
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Applied Rate:</span>
              <span className="font-mono font-bold text-emerald-700">₹{effectiveRate.primary_rate.toFixed(2)} / scan</span>
            </div>
          </button>

          {/* Option 2: Secondary Scan */}
          <button
            type="button"
            onClick={() => handleScanTypeChange('SECONDARY')}
            className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              scanTypeOption === 'SECONDARY'
                ? 'bg-purple-50 border-purple-500 text-slate-900 shadow-xs ring-1 ring-purple-500'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-bold text-slate-900">Secondary Scan</span>
              </div>
              {scanTypeOption === 'SECONDARY' && (
                <Check className="w-4 h-4 text-purple-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              Classifies all eligible PT scans in file as <strong>Secondary</strong> (Manifest / Bagging / Outbound)
            </p>
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Applied Rate:</span>
              <span className="font-mono font-bold text-purple-700">₹{effectiveRate.secondary_rate.toFixed(2)} / scan</span>
            </div>
          </button>

          {/* Option 3: Auto-Detect Layout */}
          <button
            type="button"
            onClick={() => handleScanTypeChange('AUTO')}
            className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              scanTypeOption === 'AUTO'
                ? 'bg-sky-50 border-sky-500 text-slate-900 shadow-xs ring-1 ring-sky-500'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-black text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-sm font-bold text-slate-900">Auto-Detect by Layout</span>
              </div>
              {scanTypeOption === 'AUTO' && (
                <Check className="w-4 h-4 text-sky-600" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              Classifies each row automatically based on NBP layout rules (PRI vs SEC)
            </p>
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Rates:</span>
              <span className="font-mono text-slate-700">₹{effectiveRate.primary_rate.toFixed(2)} / ₹{effectiveRate.secondary_rate.toFixed(2)}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Operational Date & Replacement Mode Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Target Operational Date
          </label>
          <input
            type="date"
            value={operationalDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 font-mono text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Active Rates on this date: Primary ₹{effectiveRate.primary_rate.toFixed(2)} • Secondary ₹{effectiveRate.secondary_rate.toFixed(2)}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Hourly Replacement & Duplicate Prevention Mode
          </label>
          <select
            value={replacementMode}
            onChange={(e) => setReplacementMode(e.target.value as any)}
            className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="HOURLY_REPLACE">
              Replace matching hours in file (Recommended for hourly upload)
            </option>
            <option value="FULL_DAY_REPLACE">
              Replace entire day's records for this operational date
            </option>
            <option value="APPEND">
              Append without deleting existing hours
            </option>
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            Enables hourly uploads throughout the shift without duplicating payment counts.
          </p>
        </div>
      </div>

      {/* File Upload Zone */}
      <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-8 text-center transition-colors bg-slate-50/50">
        <input
          type="file"
          id="scan-rate-file-input"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="scan-rate-file-input"
          className="cursor-pointer flex flex-col items-center justify-center space-y-3"
        >
          <Upload className="w-10 h-10 text-emerald-600 animate-bounce" />
          <div className="text-sm font-semibold text-slate-900">
            {fileName ? (
              <span className="text-emerald-700 font-mono">{fileName}</span>
            ) : (
              'Click to choose or drag & drop Scan Rate Excel (.xlsx) or CSV'
            )}
          </div>
          <p className="text-xs text-slate-500">
            Selected Option: <strong className="text-amber-700 font-bold">{scanTypeOption === 'PRIMARY' ? 'Option 1: Primary Scan' : scanTypeOption === 'SECONDARY' ? 'Option 2: Secondary Scan' : 'Option 3: Auto-Detect Layout'}</strong> • Matches with PT Roster on Scan_ID.
          </p>
        </label>
      </div>

      {/* Parsing Error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">File Validation Error</p>
            <p className="mt-1">{parseError}</p>
          </div>
        </div>
      )}

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Pre-Commit Validation Preview ({parsedRows.length} Rows)</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Hours detected in file: [{previewHours.join(', ')}]
            </span>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500">Total File Scans</span>
              <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{totalScans.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500">Eligible Primary Scans</span>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">{eligiblePrimaryScans.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500">Eligible Secondary Scans</span>
              <p className="text-lg font-bold font-mono text-purple-700 mt-0.5">{eligibleSecondaryScans.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500">Machine Sorter</span>
              <p className="text-lg font-bold font-mono text-slate-500 mt-0.5">{machineScans.toLocaleString()} (₹0)</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500">Calculated Payout</span>
              <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">₹{totalPayout.toFixed(2)}</p>
            </div>
          </div>

          {unregScans > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {parsedRows.filter((r) => !r.isMachine && !r.isRegistered).length} rows belong to unregistered Scan_IDs. Their scans are stored safely and will be recorded in Admin Review for roster registration.
              </span>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[300px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Action User</th>
                  <th className="py-2 px-3">Scan_ID (Match Key)</th>
                  <th className="py-2 px-3">Layout Name</th>
                  <th className="py-2 px-2 text-center">Hour</th>
                  <th className="py-2 px-3 text-right">Scans</th>
                  <th className="py-2 px-3">Classification</th>
                  <th className="py-2 px-2">PT Status</th>
                  <th className="py-2 px-3 text-right">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1.5 px-3 text-slate-900 truncate max-w-[130px]">{row.action_user}</td>
                    <td className="py-1.5 px-3 text-amber-700 font-bold">{row.normalized_mp_id}</td>
                    <td className="py-1.5 px-3">{row.layout_name}</td>
                    <td className="py-1.5 px-2 text-center text-slate-500">{row.hour}</td>
                    <td className="py-1.5 px-3 text-right font-bold">{row.scan_count}</td>
                    <td className="py-1.5 px-3 font-sans">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.isMachine
                            ? 'bg-slate-100 text-slate-600'
                            : row.processType === 'PRIMARY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.processType === 'SECONDARY'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {row.processType}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 font-sans">
                      {row.isMachine ? (
                        <span className="text-slate-500 text-[10px]">Machine</span>
                      ) : row.isRegistered ? (
                        <span className="text-emerald-700 text-[10px] font-bold">Registered (Blk {row.assignedBlock})</span>
                      ) : (
                        <span className="text-amber-700 text-[10px] font-bold">Unregistered</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-right font-bold text-emerald-700">
                      ₹{row.totalEarnings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedRows.length > 50 && (
            <p className="text-[11px] text-slate-500 text-center font-mono">
              Showing first 50 rows of {parsedRows.length} total rows.
            </p>
          )}

          {/* Commit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleCommit}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2 transition-transform active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                Commit & Apply {scanTypeOption === 'PRIMARY' ? 'Primary' : scanTypeOption === 'SECONDARY' ? 'Secondary' : ''} Scans ({parsedRows.length} Rows)
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
