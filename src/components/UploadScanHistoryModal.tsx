import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  ScanHistoryRecord,
  ImportAuditLog,
} from '../types';
import { normalizeMpId } from '../utils/normalizer';
import { classifyScanHistoryStatus } from '../utils/layoutRules';
import { commitScanHistoryImport } from '../db/storage';
import { downloadScanHistoryTemplate } from '../utils/excelExport';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Settings2,
} from 'lucide-react';

interface UploadScanHistoryModalProps {
  db: AppDatabase;
  currentDate: string;
  onImportComplete: (msg: string) => void;
  onCancel?: () => void;
}

export const UploadScanHistoryModal: React.FC<UploadScanHistoryModalProps> = ({
  db,
  currentDate,
  onImportComplete,
  onCancel,
}) => {
  const [operationalDate, setOperationalDate] = useState(currentDate);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const [colAwb, setColAwb] = useState<string>('');
  const [colUser, setColUser] = useState<string>('');
  const [colLayout, setColLayout] = useState<string>('');
  const [colStatus, setColStatus] = useState<string>('');
  const [colHour, setColHour] = useState<string>('');

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

        const json: any[] = XLSX.utils.sheet_to_json(sheet, {
          raw: false,
          defval: '',
        });

        if (json.length === 0) {
          setParseError('The uploaded Scan History file is empty.');
          setIsProcessing(false);
          return;
        }

        const detectedHeaders = Object.keys(json[0]).map((h) => h.trim());
        setHeaders(detectedHeaders);
        setRawRecords(json);

        const awb = detectedHeaders.find((h) => /awb|shipment|tracking|waybill|barcode/i.test(h)) || '';
        const user = detectedHeaders.find((h) => /action_user|user|scan_id|scanid|pt_id|mp_id|operator/i.test(h)) || '';
        const layout = detectedHeaders.find((h) => /layout|facility|location|dc_layout/i.test(h)) || '';
        const status = detectedHeaders.find((h) => /status|event|action|type|state/i.test(h)) || '';
        const hour = detectedHeaders.find((h) => /^hour$/i.test(h) || /time|slot/i.test(h)) || '';

        setColAwb(awb);
        setColUser(user);
        setColLayout(layout);
        setColStatus(status);
        setColHour(hour);

        setIsProcessing(false);
      } catch (err: any) {
        setParseError(`Failed to parse Scan History file: ${err.message || 'Unknown error'}`);
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleCommit = () => {
    if (rawRecords.length === 0) return;

    const importId = 'imp-hist-' + Date.now();
    const now = new Date().toISOString();

    const rosterMap = new Map(db.roster.map((r) => [r.scan_id || r.mp_id, r]));

    const records: ScanHistoryRecord[] = rawRecords.map((row) => {
      const rawUser = colUser ? String(row[colUser] || '').trim() : '';
      const normalizedScanId = normalizeMpId(rawUser);
      const isRegistered = Boolean(rosterMap.get(normalizedScanId));
      const rawStatus = colStatus ? String(row[colStatus] || '').trim() : '';
      const processType = classifyScanHistoryStatus(rawStatus);

      return {
        id: 'shr-' + Math.random().toString(36).substr(2, 9),
        import_id: importId,
        operational_date: operationalDate,
        raw_data: row,
        awb_or_shipment_id: colAwb ? String(row[colAwb] || '').trim() : undefined,
        action_user: rawUser,
        normalized_mp_id: normalizedScanId,
        valinor_id: rosterMap.get(normalizedScanId)?.valinor_id,
        layout_name: colLayout ? String(row[colLayout] || '').trim() : undefined,
        status: rawStatus,
        process_type: processType,
        hour: colHour ? row[colHour] : undefined,
        is_registered: isRegistered,
        created_at: now,
      };
    });

    const auditLog: ImportAuditLog = {
      id: importId,
      file_type: 'SCAN_HISTORY',
      filename: fileName,
      operational_date: operationalDate,
      uploaded_at: now,
      total_rows: rawRecords.length,
      valid_rows: rawRecords.length,
      invalid_rows: 0,
      machine_sorter_rows: 0,
      unknown_layout_rows: 0,
      unregistered_mp_rows: records.filter((r) => !r.is_registered).length,
      replacement_mode: false,
      status: 'SUCCESS',
    };

    commitScanHistoryImport(records, auditLog);

    onImportComplete(
      `Successfully imported ${records.length} records from Scan History file: ${fileName}.`
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Upload Scan History File (Independent Module)
            </h2>
            <p className="text-xs text-slate-500">
              Dedicated upload pipeline for event logs and history reports with dynamic column inspection.
            </p>
          </div>
        </div>

        <button
          onClick={downloadScanHistoryTemplate}
          className="text-xs text-sky-700 hover:text-sky-800 flex items-center gap-1.5 font-semibold border border-sky-200 bg-sky-50 px-3 py-1.5 rounded-lg shadow-xs"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Download Sample History File</span>
        </button>
      </div>

      {/* Target Date */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-sm">
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Operational Date for History Records
        </label>
        <input
          type="date"
          value={operationalDate}
          onChange={(e) => setOperationalDate(e.target.value)}
          className="w-full bg-white border border-slate-300 text-slate-900 font-mono text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
        />
      </div>

      {/* File Upload Zone */}
      <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-8 text-center transition-colors bg-slate-50/50">
        <input
          type="file"
          id="scan-history-file-input"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="scan-history-file-input"
          className="cursor-pointer flex flex-col items-center justify-center space-y-3"
        >
          <Upload className="w-10 h-10 text-sky-600 animate-bounce" />
          <div className="text-sm font-semibold text-slate-900">
            {fileName ? (
              <span className="text-sky-700 font-mono">{fileName}</span>
            ) : (
              'Click to choose or drag & drop Scan History file (.xlsx or .csv)'
            )}
          </div>
          <p className="text-xs text-slate-500">
            Completely independent ingestion pipeline without rigid column preconditions.
          </p>
        </label>
      </div>

      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">File Error</p>
            <p className="mt-1">{parseError}</p>
          </div>
        </div>
      )}

      {/* Dynamic Column Mapping */}
      {headers.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Settings2 className="w-4 h-4 text-sky-600" />
              <span>Configure File Column Mappings (Detected from {fileName})</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">AWB / Shipment ID</label>
                <select
                  value={colAwb}
                  onChange={(e) => setColAwb(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded p-1.5 focus:outline-none"
                >
                  <option value="">(None / Optional)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Action User (Scan_ID)</label>
                <select
                  value={colUser}
                  onChange={(e) => setColUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded p-1.5 focus:outline-none"
                >
                  <option value="">(None / Optional)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Layout Name</label>
                <select
                  value={colLayout}
                  onChange={(e) => setColLayout(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded p-1.5 focus:outline-none"
                >
                  <option value="">(None / Optional)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Status / Event</label>
                <select
                  value={colStatus}
                  onChange={(e) => setColStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded p-1.5 focus:outline-none"
                >
                  <option value="">(None / Optional)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Hour / Time</label>
                <select
                  value={colHour}
                  onChange={(e) => setColHour(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 rounded p-1.5 focus:outline-none"
                >
                  <option value="">(None / Optional)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Raw Preview Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[250px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="py-2 px-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {rawRecords.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {headers.map((h) => (
                      <td key={h} className="py-1.5 px-3 truncate max-w-[150px]">
                        {String(row[h] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Total records ready for ingestion: {rawRecords.length}
            </span>

            <div className="flex items-center gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleCommit}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Import Scan History ({rawRecords.length} Records)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
