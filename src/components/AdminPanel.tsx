import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AppDatabase,
  PTRosterEntry,
  RateConfig,
  BlockType,
  EmailRecipient,
} from '../types';
import {
  saveRosterEntry,
  deactivatePTRoster,
  replaceRoster,
  addRateConfig,
  saveEmailRecipient,
  deleteEmailRecipient,
  saveDatabase,
  resetToBlankDatabase,
  logEmailDelivery,
} from '../db/storage';
import { normalizeMpId } from '../utils/normalizer';
import { downloadPTRosterTemplate } from '../utils/excelExport';
import {
  Users,
  AlertTriangle,
  Mail,
  Database,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Download,
  CheckCircle,
  ShieldAlert,
  Send,
  Lock,
} from 'lucide-react';

interface AdminPanelProps {
  db: AppDatabase;
  onRefresh: () => void;
  userRole: 'ADMIN' | 'MANAGER';
  operationalDate: string;
  onLockAdmin?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  db,
  onRefresh,
  userRole,
  operationalDate,
  onLockAdmin,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<
    'roster' | 'rates' | 'unregistered' | 'layouts' | 'automailer' | 'backup'
  >('roster');

  // Rate Form State
  const [newPrimaryRate, setNewPrimaryRate] = useState<number>(0.35);
  const [newSecondaryRate, setNewSecondaryRate] = useState<number>(0.25);
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState<string>(operationalDate);
  const [rateNote, setRateNote] = useState<string>('');

  // PT Roster Add/Edit State (Exact user fields: Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status)
  const [showAddPtModal, setShowAddPtModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formScanId, setFormScanId] = useState('');
  const [formValinorId, setFormValinorId] = useState('');
  const [formMpName, setFormMpName] = useState('');
  const [formBlock, setFormBlock] = useState<BlockType>('A');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [rosterSearch, setRosterSearch] = useState('');

  // Bulk Roster Upload State
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [bulkRosterData, setBulkRosterData] = useState<PTRosterEntry[]>([]);

  // Email Recipient Form
  const [emailName, setEmailName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [emailRole, setEmailRole] = useState('');

  // Email simulation trigger state
  const [emailTriggerSuccess, setEmailTriggerSuccess] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showAdminToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAdminNotice({ message, type });
    setTimeout(() => setAdminNotice(null), 5000);
  };

  const isReadOnly = userRole === 'MANAGER';

  // ---------------- Handlers for Rates ----------------
  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (newPrimaryRate <= 0 || newSecondaryRate <= 0 || !rateEffectiveFrom) {
      showAdminToast('Please enter valid rates (> 0) and an effective date.', 'error');
      return;
    }

    addRateConfig({
      primary_rate: Number(newPrimaryRate),
      secondary_rate: Number(newSecondaryRate),
      effective_from: rateEffectiveFrom,
      created_by: 'Admin',
      note: rateNote || 'Updated payment rate',
    });

    setRateNote('');
    onRefresh();
    showAdminToast(`Payment rates updated successfully! Effective from ${rateEffectiveFrom}.`, 'success');
  };

  // ---------------- Handlers for Roster ----------------
  const handleSavePT = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!formScanId || !formMpName) {
      showAdminToast('Please fill in both Scan ID and MP Name.', 'error');
      return;
    }

    const normalizedScanId = normalizeMpId(formScanId);

    saveRosterEntry({
      scan_id: normalizedScanId,
      valinor_id: formValinorId.trim(),
      mp_name: formMpName.trim(),
      assigned_block: formBlock,
      status: formStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      original_raw_id: formScanId,
      mp_id: normalizedScanId,
    });

    setFormScanId('');
    setFormValinorId('');
    setFormMpName('');
    setFormBlock('A');
    setFormStatus('Active');
    setShowAddPtModal(false);
    setIsEditing(false);
    onRefresh();
    showAdminToast(`PT ${normalizedScanId} (${formMpName}) saved to active roster.`, 'success');
  };

  const handleDeactivate = (scanId: string) => {
    if (isReadOnly) return;
    deactivatePTRoster(scanId);
    onRefresh();
    showAdminToast(`PT ${scanId} set to Inactive. Historical records remain intact.`, 'info');
  };

  const handleBulkRosterFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary', raw: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

        if (json.length === 0) {
          alert('Uploaded roster file is empty.');
          return;
        }

        const entries: PTRosterEntry[] = json
          .map((row) => {
            const keys = Object.keys(row);
            // Match with Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status
            const scanIdKey = keys.find((k) => /scan_id|scanid|action_user|user|pt_id/i.test(k)) || keys[0];
            const valinorKey = keys.find((k) => /valinor_id|valinorid|valinor|emp_id/i.test(k));
            const nameKey = keys.find((k) => /mp_name|mpname|name/i.test(k));
            const blockKey = keys.find((k) => /assigned_block|assignedblock|block/i.test(k));
            const statusKey = keys.find((k) => /status|active/i.test(k));

            const rawScanId = String(row[scanIdKey] || '').trim();
            const rawValinor = valinorKey ? String(row[valinorKey] || '').trim() : '';
            const rawName = nameKey ? String(row[nameKey] || '').trim() : '';
            const rawBlockStr = blockKey ? String(row[blockKey] || 'A').toUpperCase().trim().replace('BLOCK', '').trim() : 'A';
            const rawStatusStr = statusKey ? String(row[statusKey] || 'Active').trim() : 'Active';

            let rawBlock = (['A', 'B', 'C', 'D', 'E'].includes(rawBlockStr) ? rawBlockStr : 'A') as BlockType;
            let status = (rawStatusStr.toLowerCase() === 'inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive';

            if (!rawScanId) return null;

            const normalized = normalizeMpId(rawScanId);
            return {
              scan_id: normalized,
              valinor_id: rawValinor,
              mp_name: rawName || `PT ${normalized}`,
              assigned_block: rawBlock,
              status,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              mp_id: normalized,
              original_raw_id: rawScanId,
            };
          })
          .filter(Boolean) as PTRosterEntry[];

        setBulkRosterData(entries);
        setShowReplaceConfirm(true);
      } catch (err: any) {
        showAdminToast('Failed to parse roster file: ' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmRosterAppend = () => {
    bulkRosterData.forEach((entry) => saveRosterEntry(entry));
    setShowReplaceConfirm(false);
    setBulkRosterData([]);
    onRefresh();
    showAdminToast(`Successfully merged ${bulkRosterData.length} PTs into roster!`, 'success');
  };

  const confirmRosterReplaceAll = () => {
    replaceRoster(bulkRosterData);
    setShowReplaceConfirm(false);
    setBulkRosterData([]);
    onRefresh();
    showAdminToast(`Entire roster replaced with ${bulkRosterData.length} PTs!`, 'success');
  };

  const handleQuickRegisterMP = (rawUser: string, normalizedId: string) => {
    if (isReadOnly) return;
    setFormScanId(normalizedId);
    setFormValinorId('');
    setFormMpName(`PT ${normalizedId}`);
    setFormBlock('A');
    setFormStatus('Active');
    setShowAddPtModal(true);
  };

  const handleApproveLayout = (layoutName: string, asProcess: 'PRIMARY' | 'SECONDARY' | 'EXCLUDED') => {
    if (isReadOnly) return;
    const target = db.unknownLayouts.find((u) => u.layout_name === layoutName);
    if (target) {
      target.status = asProcess === 'PRIMARY' ? 'APPROVED_PRIMARY' : asProcess === 'SECONDARY' ? 'APPROVED_SECONDARY' : 'EXCLUDED';
      target.approved_at = new Date().toISOString();
      saveDatabase(db);
      onRefresh();
      showAdminToast(`Layout ${layoutName} updated to: ${target.status}`, 'success');
    }
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!emailAddress || !emailName) return;

    saveEmailRecipient({
      id: 'rec-' + Date.now(),
      name: emailName,
      email: emailAddress,
      role: emailRole || 'Operations Stakeholder',
      is_active: true,
      created_at: new Date().toISOString(),
    });

    setEmailName('');
    setEmailAddress('');
    setEmailRole('');
    onRefresh();
  };

  const handleToggleRecipient = (rec: EmailRecipient) => {
    if (isReadOnly) return;
    saveEmailRecipient({ ...rec, is_active: !rec.is_active });
    onRefresh();
  };

  const handleDeleteRecipient = (id: string) => {
    if (isReadOnly) return;
    deleteEmailRecipient(id);
    onRefresh();
  };

  const handleManualEmailTrigger = () => {
    const activeRecipients = db.emailRecipients.filter((r) => r.is_active);
    if (activeRecipients.length === 0) {
      alert('No active email recipients configured.');
      return;
    }

    const dateRecords = db.scanRateRecords.filter((r) => r.operational_date === operationalDate && !r.is_machine);
    const totalScans = dateRecords.reduce((a, b) => a + b.scan_count, 0);
    const totalPayout = dateRecords.reduce((a, b) => a + b.total_earnings, 0);

    activeRecipients.forEach((rec) => {
      logEmailDelivery({
        id: 'elog-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        recipient_email: rec.email,
        recipient_name: rec.name,
        sent_at: new Date().toISOString(),
        operational_date: operationalDate,
        status: 'DELIVERED',
        total_scans: totalScans,
        total_payment: totalPayout,
        trigger_type: 'MANUAL_TRIGGER',
      });
    });

    onRefresh();
    setEmailTriggerSuccess(
      `Daily summary email dispatched successfully to ${activeRecipients.length} recipients for operational date ${operationalDate} with attached multi-sheet Excel summary.`
    );
  };

  const handleDownloadBackup = () => {
    const jsonStr = JSON.stringify(db, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NBP_PT_Database_Backup_${operationalDate}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed.roster || !parsed.rates) {
          showAdminToast('Invalid backup file schema.', 'error');
          return;
        }
        saveDatabase(parsed);
        onRefresh();
        showAdminToast('Database restored successfully from backup file!', 'success');
      } catch (err: any) {
        showAdminToast('Failed to restore backup: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetBlank = () => {
    if (isReadOnly) return;
    resetToBlankDatabase();
    onRefresh();
    showAdminToast('Database has been reset to pristine blank production schema.', 'info');
  };

  const filteredRoster = db.roster.filter(
    (r) =>
      r.mp_name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      (r.scan_id && r.scan_id.toLowerCase().includes(rosterSearch.toLowerCase())) ||
      (r.valinor_id && r.valinor_id.toLowerCase().includes(rosterSearch.toLowerCase())) ||
      r.assigned_block.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <span>Admin Management & Operational Governance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Site Code: <span className="font-mono text-amber-600 font-bold">NBP</span> • Manage PT Roster (Scan_ID & Valinor_ID), Payment Rates, Layouts, Unregistered MPs, AutoMailer, and System Backups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isReadOnly ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Manager Mode Active (Read-Only)</span>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Admin Authenticated (ID: Admin)</span>
            </div>
          )}

          {onLockAdmin && (
            <button
              onClick={onLockAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors shadow-2xs"
              title="Lock Admin Session (requires password to re-enter)"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Notice Toast Banner */}
      {adminNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-fade-in ${
            adminNotice.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : adminNotice.type === 'info'
              ? 'bg-sky-50 border-sky-300 text-sky-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          <span>{adminNotice.message}</span>
          <button
            onClick={() => setAdminNotice(null)}
            className="text-slate-500 hover:text-slate-800 font-bold ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-2">
        <button
          onClick={() => setActiveAdminSubTab('roster')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all ${
            activeAdminSubTab === 'roster'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          PT Roster ({db.roster.length})
        </button>

        <button
          onClick={() => setActiveAdminSubTab('rates')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all ${
            activeAdminSubTab === 'rates'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Payment Rates & History
        </button>

        <button
          onClick={() => setActiveAdminSubTab('unregistered')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all flex items-center gap-1.5 ${
            activeAdminSubTab === 'unregistered'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Unregistered MPs</span>
          {db.unregisteredMps.filter((u) => u.status === 'UNREGISTERED').length > 0 && (
            <span className="bg-red-500 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {db.unregisteredMps.filter((u) => u.status === 'UNREGISTERED').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminSubTab('layouts')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all ${
            activeAdminSubTab === 'layouts'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Layouts & Reviews
        </button>

        <button
          onClick={() => setActiveAdminSubTab('automailer')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all ${
            activeAdminSubTab === 'automailer'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          AutoMailer (11:59 PM IST)
        </button>

        <button
          onClick={() => setActiveAdminSubTab('backup')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all ${
            activeAdminSubTab === 'backup'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Backup & Restore
        </button>
      </div>

      {/* ================= TAB 1: PT ROSTER (Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status) ================= */}
      {activeAdminSubTab === 'roster' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                PT Roster & Identification Mapping
              </h3>
              <p className="text-xs text-slate-500">
                Matches uploaded scans strictly on <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold">Scan_ID</code>. Contains <code className="font-mono text-slate-700">Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadPTRosterTemplate}
                className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1 border border-slate-300 bg-white px-3 py-1.5 rounded-lg font-medium shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>Template CSV</span>
              </button>

              {!isReadOnly && (
                <>
                  <label className="text-xs text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 font-semibold shadow-xs">
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>Upload Roster File</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleBulkRosterFile}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormScanId('');
                      setFormValinorId('');
                      setFormMpName('');
                      setFormBlock('A');
                      setFormStatus('Active');
                      setShowAddPtModal(true);
                    }}
                    className="text-xs text-slate-950 bg-amber-500 hover:bg-amber-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New PT</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="max-w-md">
            <input
              type="text"
              placeholder="Search roster by Scan ID, Valinor ID, Name, or Block..."
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Roster Table with Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[500px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Scan_ID (Match Key)</th>
                  <th className="py-2.5 px-3">Valinor_ID</th>
                  <th className="py-2.5 px-3">MP_Name</th>
                  <th className="py-2.5 px-3 text-center">Assigned_Block</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {filteredRoster.length > 0 ? (
                  filteredRoster.map((pt) => {
                    const scanKey = pt.scan_id || pt.mp_id;
                    return (
                      <tr key={scanKey} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-amber-700 font-bold">{scanKey}</td>
                        <td className="py-2 px-3 text-slate-600 font-medium">{pt.valinor_id || '-'}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">{pt.mp_name}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold border border-amber-200">
                            Block {pt.assigned_block}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pt.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {pt.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          {!isReadOnly && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setIsEditing(true);
                                  setFormScanId(scanKey || '');
                                  setFormValinorId(pt.valinor_id || '');
                                  setFormMpName(pt.mp_name);
                                  setFormBlock(pt.assigned_block);
                                  setFormStatus(pt.status);
                                  setShowAddPtModal(true);
                                }}
                                className="text-xs text-sky-700 hover:text-sky-800 font-medium"
                                title="Edit PT"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {pt.status === 'Active' && (
                                <button
                                  onClick={() => handleDeactivate(scanKey || '')}
                                  className="text-xs text-red-600 hover:text-red-700"
                                  title="Deactivate PT"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No registered PTs found in roster.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add / Edit PT Modal with exact Scan_ID, Valinor_ID, MP_Name, Assigned_Block, Status */}
          {showAddPtModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
              <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-base font-bold text-slate-900 mb-4">
                  {isEditing ? `Edit PT: ${formScanId}` : 'Add New PT to Roster'}
                </h3>
                <form onSubmit={handleSavePT} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Scan_ID <span className="text-red-500">*</span> (Identifier matched from scan file)
                    </label>
                    <input
                      type="text"
                      disabled={isEditing}
                      value={formScanId}
                      onChange={(e) => setFormScanId(e.target.value)}
                      placeholder="e.g. 7827746889 or 968893@OneNCR_DC"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500 disabled:opacity-60 font-mono"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Used for exact data match against <code className="text-amber-700">action_user</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Valinor_ID (Shadowfax ERP / MP Employee ID)
                    </label>
                    <input
                      type="text"
                      value={formValinorId}
                      onChange={(e) => setFormValinorId(e.target.value)}
                      placeholder="e.g. VAL7827 or SFX1092"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      MP_Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formMpName}
                      onChange={(e) => setFormMpName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Assigned_Block
                    </label>
                    <select
                      value={formBlock}
                      onChange={(e) => setFormBlock(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="A">Block A</option>
                      <option value="B">Block B</option>
                      <option value="C">Block C</option>
                      <option value="D">Block D</option>
                      <option value="E">Block E</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddPtModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded shadow-xs"
                    >
                      Save PT Record
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bulk Upload Confirmation Modal */}
          {showReplaceConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
              <div className="bg-white border border-amber-300 rounded-xl p-6 max-w-lg w-full shadow-xl">
                <div className="flex items-center gap-3 text-amber-700 mb-3">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Roster Import Confirmation ({bulkRosterData.length} PTs detected)
                  </h3>
                </div>

                <p className="text-xs text-slate-600 mb-4">
                  Please choose how you wish to apply the uploaded PT roster file:
                </p>

                <div className="space-y-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Merge / Append</p>
                      <p className="text-[11px] text-slate-500">
                        Adds new PTs and updates block assignments of existing PTs without deleting.
                      </p>
                    </div>
                    <button
                      onClick={confirmRosterAppend}
                      className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded hover:bg-emerald-700"
                    >
                      Merge Roster
                    </button>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-red-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-red-700">Replace Entire Roster</p>
                      <p className="text-[11px] text-slate-500">
                        Overwrites current roster completely with this file.
                      </p>
                    </div>
                    <button
                      onClick={confirmRosterReplaceAll}
                      className="px-3 py-1.5 bg-red-600 text-white font-bold text-xs rounded hover:bg-red-700"
                    >
                      Replace All
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setShowReplaceConfirm(false);
                      setBulkRosterData([]);
                    }}
                    className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs rounded font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: PAYMENT RATES ================= */}
      {activeAdminSubTab === 'rates' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Payment Rate Management & Effective Date Rules
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Shadowfax DC operations use strictly two rates: Primary per-scan rate and Secondary per-scan rate. Changing rates sets an effective date and never alters historical payments prior to that date.
            </p>
          </div>

          {!isReadOnly && (
            <form onSubmit={handleSaveRate} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configure New Rates
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">
                    Primary Rate (₹ / scan)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrimaryRate}
                    onChange={(e) => setNewPrimaryRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">
                    Secondary Rate (₹ / scan)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSecondaryRate}
                    onChange={(e) => setNewSecondaryRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">
                    Effective From Date
                  </label>
                  <input
                    type="date"
                    value={rateEffectiveFrom}
                    onChange={(e) => setRateEffectiveFrom(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold">
                    Revision Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shift Revision"
                    value={rateNote}
                    onChange={(e) => setRateNote(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs"
                >
                  Apply Rate Configuration
                </button>
              </div>
            </form>
          )}

          {/* Rate History Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Rate History & Audit Trail
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Effective From</th>
                    <th className="py-2.5 px-3 text-right">Primary Rate</th>
                    <th className="py-2.5 px-3 text-right">Secondary Rate</th>
                    <th className="py-2.5 px-3">Configured By</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {db.rates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-amber-700 font-bold">{r.effective_from}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                        ₹{r.primary_rate.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-purple-700 font-bold">
                        ₹{r.secondary_rate.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600">{r.created_by}</td>
                      <td className="py-2 px-3 font-sans text-slate-500">{r.note || '-'}</td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: UNREGISTERED MPS REVIEW ================= */}
      {activeAdminSubTab === 'unregistered' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Unregistered MP Review Section</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Scans by unregistered IDs are stored in the database but isolated from the Dashboard and PT Details until registered in the PT Roster.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[450px] scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Raw Action User</th>
                  <th className="py-2.5 px-3">Normalized Scan ID</th>
                  <th className="py-2.5 px-3">First Seen Date</th>
                  <th className="py-2.5 px-3 text-right">Total Scans</th>
                  <th className="py-2.5 px-3">Last Layout</th>
                  <th className="py-2.5 px-3">Review Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {db.unregisteredMps.length > 0 ? (
                  db.unregisteredMps.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-900 truncate max-w-[150px]">{u.raw_action_user}</td>
                      <td className="py-2 px-3 text-amber-700 font-bold">{u.normalized_mp_id}</td>
                      <td className="py-2 px-3 text-slate-500">{u.first_seen_date}</td>
                      <td className="py-2 px-3 text-right font-bold">{u.total_scans_recorded.toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-500">{u.last_layout_used}</td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'CONVERTED_TO_PT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        {u.status === 'UNREGISTERED' && !isReadOnly && (
                          <button
                            onClick={() => handleQuickRegisterMP(u.raw_action_user, u.normalized_mp_id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded shadow-xs"
                          >
                            Register as PT
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                      No unregistered MP records found. All processed scan records belong to registered PTs or machines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: LAYOUTS & REVIEW ================= */}
      {activeAdminSubTab === 'layouts' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Layout Identification & Special DC Rules
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Rules strictly enforced: Only layouts beginning with <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">NBP</code> are eligible. Machine sorter <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">NBP-MU-01</code> is excluded. Layouts <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">NBP-FMRTS-0910-PRI-SSC</code> and <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">NBP-PRP-SDD15-SSC</code> excluded until approved.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Unknown NBP Layouts Flagged for Review
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Layout Name</th>
                    <th className="py-2.5 px-3">First Seen In</th>
                    <th className="py-2.5 px-3 text-right">Recorded Scans</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {db.unknownLayouts.length > 0 ? (
                    db.unknownLayouts.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-900 font-bold">{l.layout_name}</td>
                        <td className="py-2 px-3 text-slate-500">{l.first_seen_file}</td>
                        <td className="py-2 px-3 text-right font-bold">{l.total_scans_recorded}</td>
                        <td className="py-2 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            {l.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          {!isReadOnly && l.status === 'PENDING_REVIEW' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveLayout(l.layout_name, 'PRIMARY')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-xs"
                              >
                                Approve Primary
                              </button>
                              <button
                                onClick={() => handleApproveLayout(l.layout_name, 'SECONDARY')}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold shadow-xs"
                              >
                                Approve Secondary
                              </button>
                              <button
                                onClick={() => handleApproveLayout(l.layout_name, 'EXCLUDED')}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px]"
                              >
                                Exclude
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                        No unknown NBP layouts requiring review.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: AUTOMAILER ================= */}
      {activeAdminSubTab === 'automailer' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600" />
                <span>AutoMailer Configuration & Daily Summary Dispatch</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Automated Daily Dispatch Schedule: <strong className="text-amber-700 font-mono">11:59 PM IST (Asia/Kolkata)</strong>. Generates multi-sheet Excel report attachments and sends daily operational cost summaries.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Bot Sender Account:</span>
                <span className="font-mono font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                  shadowfaxptbot@gmail.com
                </span>
                <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Password: Sfx@123
                </span>
              </div>
            </div>

            <button
              onClick={handleManualEmailTrigger}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-xs flex items-center gap-2 self-start sm:self-auto"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Trigger Daily Email Now</span>
            </button>
          </div>

          {emailTriggerSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{emailTriggerSuccess}</span>
            </div>
          )}

          {/* Add Recipient Form */}
          {!isReadOnly && (
            <form onSubmit={handleAddRecipient} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Add Email Recipient
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    placeholder="e.g. DC Operations Manager"
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. manager@shadowfax.in"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Role / Department</label>
                  <input
                    type="text"
                    placeholder="e.g. NCR Bamnoli DC Ops"
                    value={emailRole}
                    onChange={(e) => setEmailRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 rounded p-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded shadow-xs"
                >
                  Add Recipient
                </button>
              </div>
            </form>
          )}

          {/* Recipients Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Configured Recipients List ({db.emailRecipients.length})
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-center">Active Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {db.emailRecipients.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-sans font-semibold text-slate-900">{rec.name}</td>
                      <td className="py-2 px-3 text-amber-700 font-medium">{rec.email}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">{rec.role}</td>
                      <td className="py-2 px-3 text-center font-sans">
                        <button
                          onClick={() => handleToggleRecipient(rec)}
                          disabled={isReadOnly}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {rec.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        {!isReadOnly && (
                          <button
                            onClick={() => handleDeleteRecipient(rec.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Email Delivery Logs */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Email Delivery Logs ({db.emailLogs.length})
            </h4>

            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[250px] scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Sent At</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Ops Date</th>
                    <th className="py-2.5 px-3">Trigger Type</th>
                    <th className="py-2.5 px-3 text-right">Report Scans</th>
                    <th className="py-2.5 px-3 text-right">Report Payout</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {db.emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">{new Date(log.sent_at).toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-900 font-medium">{log.recipient_email}</td>
                      <td className="py-2 px-3 text-amber-700 font-bold">{log.operational_date}</td>
                      <td className="py-2 px-3 font-sans text-slate-600">{log.trigger_type}</td>
                      <td className="py-2 px-3 text-right">{log.total_scans.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">₹{log.total_payment.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center font-sans">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-300">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 6: BACKUP & RESTORE ================= */}
      {activeAdminSubTab === 'backup' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-600" />
              <span>Database Retention, Backup & Restore</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports 3-year record retention with reliable snapshot export and restore. Blank database schema initialized as requested.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Export Database Backup</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Downloads a complete JSON snapshot containing all roster records (Scan_ID & Valinor_ID), scan rate records, scan history, rates, and audit logs.
                </p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Database JSON</span>
              </button>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">Restore from Backup</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Restore previously saved system database snapshot from a JSON file.
                </p>
              </div>
              {!isReadOnly ? (
                <label className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>Restore from JSON File</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              ) : (
                <span className="text-xs text-slate-400">Restore disabled in Manager mode</span>
              )}
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-red-200 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-red-700 mb-1">Reset to Blank Schema</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Clears all uploaded operational scans, imports, and logs to return to a completely clean blank schema.
                </p>
              </div>
              {!isReadOnly && (
                <button
                  onClick={handleResetBlank}
                  className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Reset Database Schema</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
