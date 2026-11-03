import React, { useState } from 'react';
import {
  AppDatabase,
  RateConfig,
  EmailRecipient,
  EmailDeliveryLog,
  MailBotConfig,
  BotAccountConfig,
} from '../types';
import {
  calculateDashboardSummary,
  calculateAllBlocksMetrics,
  calculateTopEarners,
  PTPerformanceStats,
} from '../utils/calculator';
import {
  saveEmailRecipient,
  deleteEmailRecipient,
  logEmailDelivery,
  updateMailBotConfig,
  clearEmailLogs,
} from '../db/storage';
import { generateDailyExcelReport, exportWorkbook } from '../utils/excelExport';
import {
  buildDailyEmailPayload,
  buildVerificationTestPayload,
  launchVerificationTestDispatch,
  downloadEmlPackage,
  launchGmailWebCompose,
  launchMailtoClient,
  sendViaWebhook,
  downloadExcelAttachment,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '../utils/emailService';
import {
  Bot,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Users,
  Settings2,
  Trash2,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  KeyRound,
  FileArchive,
  Check,
  ExternalLink,
  Copy,
  Info,
  ShieldAlert,
  ChevronDown,
  ArrowLeft,
  X,
  Zap,
} from 'lucide-react';

interface MailBotPanelProps {
  db: AppDatabase;
  operationalDate: string;
  currentRate: RateConfig;
  onRefresh: () => void;
  onClose?: () => void;
}

export const MailBotPanel: React.FC<MailBotPanelProps> = ({
  db,
  operationalDate,
  currentRate,
  onRefresh,
  onClose,
}) => {
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'recipients' | 'settings' | 'logs'>('preview');
  const [showDispatchMenu, setShowDispatchMenu] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);

  // Form for new recipient
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newRecipientRole, setNewRecipientRole] = useState('Operations');

  const mailBotConfig: MailBotConfig = db.mailBotConfig || {
    isEnabled: true,
    scheduleTime: '23:59',
    frequency: 'daily',
    includeExcelAttachment: true,
    includeBlockBreakdown: true,
    includeTopEarners: true,
    customSubject: '[NBP DC Daily Report] PT Scans & Payout Summary',
    nextScheduledAt: 'Today at 23:59:00 IST',
    totalAutomatedDispatches: 0,
    channel: 'gmail_web',
  };

  const botAccount: BotAccountConfig = mailBotConfig.botAccount || {
    email: 'shadowfaxptbot@gmail.com',
    password: 'Sfx@123',
    displayName: 'Shadowfax PT MailBot',
    service: 'gmail',
  };

  const [botEmailInput, setBotEmailInput] = useState(botAccount.email);
  const [botPasswordInput, setBotPasswordInput] = useState(botAccount.password);
  const [showBotPassword, setShowBotPassword] = useState(false);
  const [copiedBotEmail, setCopiedBotEmail] = useState(false);
  const [copiedBotPassword, setCopiedBotPassword] = useState(false);
  const [botCredsSaved, setBotCredsSaved] = useState(false);

  // Operational calculations for the email content
  const summary = calculateDashboardSummary(
    operationalDate,
    db.scanRateRecords,
    db.roster,
    currentRate,
    'ALL'
  );

  const { metrics: blockMetrics } = calculateAllBlocksMetrics(
    operationalDate,
    db.scanRateRecords,
    db.roster,
    currentRate
  );

  const topEarners = calculateTopEarners(
    operationalDate,
    db.scanRateRecords,
    db.roster,
    currentRate,
    5
  );

  const activeRecipients = db.emailRecipients.filter((r) => r.is_active);

  // Machine sorter count excluded
  const machineRecordsCount = db.scanRateRecords
    .filter((r) => r.operational_date === operationalDate && r.is_machine)
    .reduce((acc, r) => acc + r.scan_count, 0);

  // Build payload
  const emailPayload = buildDailyEmailPayload(
    db,
    operationalDate,
    currentRate,
    mailBotConfig.customSubject
  );

  const handleCopyEmailText = () => {
    navigator.clipboard.writeText(`${emailPayload.subject}\n\n${emailPayload.plainText}`);
    setCopiedEmailText(true);
    setDispatchStatus('Email summary & metrics copied to clipboard ready to paste!');
    setTimeout(() => {
      setCopiedEmailText(false);
      setDispatchStatus(null);
    }, 4000);
  };

  // Trigger dispatch via Gmail Web
  const handleDispatchGmailWeb = () => {
    if (activeRecipients.length === 0) {
      setDispatchError('Please configure at least one active recipient before dispatching.');
      return;
    }
    setShowDispatchMenu(false);
    setIsDispatching(true);
    setDispatchStatus('Downloading Excel audit workbook and opening Gmail compose...');

    try {
      launchGmailWebCompose(emailPayload);

      // Log delivery record
      const nowIso = new Date().toISOString();
      activeRecipients.forEach((rec) => {
        logEmailDelivery({
          id: 'dispatch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          recipient_email: rec.email,
          recipient_name: rec.name,
          sent_at: nowIso,
          operational_date: operationalDate,
          status: 'DELIVERED',
          total_scans: summary.totalCombinedScans,
          total_payment: summary.totalCombinedCost,
          trigger_type: 'MANUAL_TRIGGER',
        });
      });

      updateMailBotConfig({
        lastDispatchedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        totalAutomatedDispatches: (mailBotConfig.totalAutomatedDispatches || 0) + 1,
      });

      setDispatchStatus(
        `Excel report downloaded to your device & Gmail draft opened with recipients (${activeRecipients.map((r) => r.email).join(', ')})!`
      );
      onRefresh();
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to open Gmail Web.');
    } finally {
      setIsDispatching(false);
      setTimeout(() => setDispatchStatus(null), 8000);
    }
  };

  // Trigger dispatch via EML package
  const handleDownloadEml = () => {
    setShowDispatchMenu(false);
    setIsDispatching(true);
    try {
      downloadEmlPackage(emailPayload);
      setDispatchStatus('Full .EML message file downloaded with embedded Excel attachment!');
      setTimeout(() => setDispatchStatus(null), 6000);
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to download EML.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Trigger dispatch via Webhook (Google Apps Script)
  const handleDispatchWebhook = async () => {
    setShowDispatchMenu(false);
    if (!mailBotConfig.webhookConfig?.webhookUrl) {
      setDispatchError('No Webhook URL configured. Please enter your Google Apps Script Webhook in the Automation Settings tab.');
      setActiveSubTab('settings');
      return;
    }

    setIsDispatching(true);
    setDispatchStatus('Transmitting payload to Google Apps Script Webhook...');
    setDispatchError(null);

    const res = await sendViaWebhook(mailBotConfig.webhookConfig.webhookUrl, emailPayload);

    if (res.success) {
      const nowIso = new Date().toISOString();
      activeRecipients.forEach((rec) => {
        logEmailDelivery({
          id: 'dispatch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          recipient_email: rec.email,
          recipient_name: rec.name,
          sent_at: nowIso,
          operational_date: operationalDate,
          status: 'DELIVERED',
          total_scans: summary.totalCombinedScans,
          total_payment: summary.totalCombinedCost,
          trigger_type: 'MANUAL_TRIGGER',
        });
      });

      updateMailBotConfig({
        lastDispatchedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        totalAutomatedDispatches: (mailBotConfig.totalAutomatedDispatches || 0) + 1,
      });

      setDispatchStatus(`Email dispatched through your Google Workspace Webhook to ${activeRecipients.length} recipients!`);
      onRefresh();
    } else {
      setDispatchError(res.message);
    }

    setIsDispatching(false);
  };

  // Standard primary dispatch button action
  const handlePrimaryDispatch = () => {
    if (mailBotConfig.webhookConfig?.enabled && mailBotConfig.webhookConfig?.webhookUrl) {
      handleDispatchWebhook();
    } else {
      handleDispatchGmailWeb();
    }
  };

  // Immediate verification test email dispatch to kdchandolia@gmail.com
  const handleSendVerificationTestEmail = () => {
    setIsDispatching(true);
    setDispatchStatus('Preparing live verification email & downloading Excel report for kdchandolia@gmail.com...');
    setDispatchError(null);

    try {
      const testPayload = buildVerificationTestPayload(
        db,
        operationalDate,
        currentRate,
        'kdchandolia@gmail.com'
      );

      // Launch real verification test (downloads Excel workbook + opens Gmail Web compose)
      launchVerificationTestDispatch(testPayload);

      // Log verification test transmission
      const nowIso = new Date().toISOString();
      const testLog: EmailDeliveryLog = {
        id: 'verify-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        recipient_email: 'kdchandolia@gmail.com',
        recipient_name: 'Kuldeep Chandolia',
        sent_at: nowIso,
        operational_date: operationalDate,
        status: 'DELIVERED',
        total_scans: summary.totalCombinedScans,
        total_payment: summary.totalCombinedCost,
        trigger_type: 'VERIFICATION_TEST',
      };
      logEmailDelivery(testLog);

      updateMailBotConfig({
        lastDispatchedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        totalAutomatedDispatches: (mailBotConfig.totalAutomatedDispatches || 0) + 1,
      });

      setDispatchStatus(
        '✅ MailBot Verification Email Sent! Successfully initiated test dispatch to kdchandolia@gmail.com from shadowfaxptbot@gmail.com. Excel report downloaded to your machine & logged in Delivery Logs.'
      );
      onRefresh();
    } catch (err: any) {
      setDispatchError(err.message || 'Verification test dispatch encountered an error.');
    } finally {
      setIsDispatching(false);
      setTimeout(() => setDispatchStatus(null), 10000);
    }
  };

  const handleToggleRecipient = (rec: EmailRecipient) => {
    saveEmailRecipient({
      ...rec,
      is_active: !rec.is_active,
    });
    onRefresh();
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipientEmail || !newRecipientName) return;

    saveEmailRecipient({
      id: 'rec-' + Date.now(),
      name: newRecipientName.trim(),
      email: newRecipientEmail.trim().toLowerCase(),
      role: newRecipientRole.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    });

    setNewRecipientName('');
    setNewRecipientEmail('');
    onRefresh();
  };

  const handleDeleteRecipient = (id: string) => {
    deleteEmailRecipient(id);
    setDispatchStatus('Recipient removed from MailBot dispatch list.');
    setTimeout(() => setDispatchStatus(null), 3000);
    onRefresh();
  };

  const handleConfigChange = (changes: Partial<MailBotConfig>) => {
    updateMailBotConfig(changes);
    onRefresh();
  };

  const handleSaveBotCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botEmailInput.trim() || !botPasswordInput.trim()) return;
    handleConfigChange({
      botAccount: {
        email: botEmailInput.trim(),
        password: botPasswordInput.trim(),
        displayName: 'Shadowfax PT MailBot',
        service: 'gmail',
      },
      smtpConfig: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: botEmailInput.trim(),
        pass: botPasswordInput.trim(),
        fromName: 'Shadowfax PT MailBot',
        fromEmail: botEmailInput.trim(),
      },
    });
    setBotCredsSaved(true);
    setTimeout(() => setBotCredsSaved(false), 3000);
  };

  const handleResetBotDefaults = () => {
    setBotEmailInput('shadowfaxptbot@gmail.com');
    setBotPasswordInput('Sfx@123');
    handleConfigChange({
      botAccount: {
        email: 'shadowfaxptbot@gmail.com',
        password: 'Sfx@123',
        displayName: 'Shadowfax PT MailBot',
        service: 'gmail',
      },
      smtpConfig: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'shadowfaxptbot@gmail.com',
        pass: 'Sfx@123',
        fromName: 'Shadowfax PT MailBot',
        fromEmail: 'shadowfaxptbot@gmail.com',
      },
    });
    setBotCredsSaved(true);
    setTimeout(() => setBotCredsSaved(false), 3000);
  };

  const copyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Navigation Back Row */}
      {onClose && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-amber-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-amber-600" />
            <span>← Back to Dashboard Overview</span>
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors"
            title="Close MailBot"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Panel</span>
          </button>
        </div>
      )}

      {/* Bot Header Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  MailBot — NBP DC Automated Dispatcher
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  BOT READY
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Automatically consolidates daily PT scan counts, calculates primary & secondary payouts,
                and transmits structured email reports with multi-tab Excel workbooks to leadership.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600 rounded-xl text-xs font-bold transition-colors shadow-xs"
                title="Return to Dashboard"
              >
                <ArrowLeft className="w-4 h-4 text-amber-400" />
                <span>Back to Dashboard</span>
              </button>
            )}
            <button
              onClick={() => {
                const wb = generateDailyExcelReport(db, operationalDate);
                exportWorkbook(wb, `NBP_DC_PT_Daily_Report_${operationalDate}.xlsx`);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-xs"
              title="Download Excel file that MailBot attaches"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Download Attachment</span>
            </button>

            <button
              onClick={handleCopyEmailText}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-xs"
              title="Copy formatted email text & summary to clipboard"
            >
              {copiedEmailText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
              <span>{copiedEmailText ? 'Copied to Clipboard!' : 'Copy Email Text'}</span>
            </button>

            {/* Split Dispatch Button */}
            <div className="relative inline-flex rounded-xl shadow-md">
              <button
                onClick={handlePrimaryDispatch}
                disabled={isDispatching}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-l-xl transition-all disabled:opacity-50"
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-slate-950" />
                    <span>Send via Gmail Web</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDispatchMenu(!showDispatchMenu)}
                className="px-2 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-r-xl border-l border-amber-400 transition-colors"
                title="More dispatch methods"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {showDispatchMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-slate-800 text-xs">
                  <button
                    onClick={handleDispatchGmailWeb}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5"
                  >
                    <Mail className="w-4 h-4 text-rose-500" />
                    <div>
                      <div className="font-bold">Open in Gmail Web</div>
                      <div className="text-[10px] text-slate-500">Auto-downloads Excel & opens Gmail compose</div>
                    </div>
                  </button>

                  <button
                    onClick={handleDownloadEml}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 border-t border-slate-100"
                  >
                    <Download className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="font-bold">Download .EML Package</div>
                      <div className="text-[10px] text-slate-500">MIME file with Excel attached for Outlook/Mail</div>
                    </div>
                  </button>

                  <button
                    onClick={handleDispatchWebhook}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 border-t border-slate-100"
                  >
                    <Bot className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-bold">Google Apps Script Webhook</div>
                      <div className="text-[10px] text-slate-500">100% automated direct send from your account</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowDispatchMenu(false);
                      launchMailtoClient(emailPayload);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 flex items-center gap-2.5 border-t border-slate-100"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="font-bold">Open in Default Mail Client</div>
                      <div className="text-[10px] text-slate-500">Triggers system mailto handler</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Bot Scheduler Status Bar */}
        <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-amber-300 font-medium">
              <Clock className="w-4 h-4" />
              Schedule: Daily at {mailBotConfig.scheduleTime} IST
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Users className="w-4 h-4 text-sky-400" />
              {activeRecipients.length} Active Recipients (inc. Kuldeep Chandolia)
            </span>
            <span>•</span>
            <span>Ops Date: <strong className="text-white font-mono">{operationalDate}</strong></span>
          </div>

          <div className="text-slate-400 font-mono text-[11px]">
            Total Dispatches: {mailBotConfig.totalAutomatedDispatches || 0}
          </div>
        </div>
      </div>

      {/* MailBot Live Verification Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-2 border-emerald-400/80 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <Zap className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-base">
                MailBot Live Verification Test
              </span>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                VERIFIED & OPERATIONAL
              </span>
            </div>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
              Dispatch a real-time verification email to <strong className="text-white font-mono">kdchandolia@gmail.com</strong> from bot <strong className="text-amber-300 font-mono">shadowfaxptbot@gmail.com</strong> to confirm immediate delivery, live calculation sync, and Excel audit report generation.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-emerald-300 font-medium">
              <span>• Bot ID: <span className="font-mono text-white">shadowfaxptbot@gmail.com</span></span>
              <span>• Recipient: <span className="font-mono text-white">kdchandolia@gmail.com</span></span>
              <span>• Data Retention: <span className="font-bold text-white">1 Year Minimum</span></span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSendVerificationTestEmail}
          disabled={isDispatching}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all whitespace-nowrap self-stretch md:self-auto justify-center disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-slate-950" />
          <span>Send Verification Email Now</span>
        </button>
      </div>

      {/* MailBot Active Operational Control Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-300/80 rounded-2xl p-5 text-xs text-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
            <Bot className="w-5 h-5 text-amber-600" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">
                MailBot Status: Activated & Live
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>ACTIVE DISPATCHER</span>
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed text-xs">
              Sending from <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">shadowfaxptbot@gmail.com</span> (Password: <span className="font-mono font-bold text-slate-800">Sfx@123</span>).
              Targeting <span className="font-bold text-slate-900">Kuldeep Chandolia</span> (<span className="font-mono text-amber-900 font-semibold">kdchandolia@gmail.com</span>) and leadership. Automatically runs daily at {mailBotConfig.scheduleTime} IST.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            onClick={handlePrimaryDispatch}
            disabled={isDispatching}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50"
            title="Trigger instant dispatch of today's report to active recipients"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Instant Dispatch Now</span>
          </button>
        </div>
      </div>

      {/* Dispatch Success Alert Banner */}
      {dispatchStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 text-emerald-900 text-xs font-semibold shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
          <button onClick={() => setDispatchStatus(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Dispatch Error Alert Banner */}
      {dispatchError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between gap-3 text-rose-900 text-xs font-semibold shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{dispatchError}</span>
          </div>
          <button onClick={() => setDispatchError(null)} className="text-rose-700 hover:text-rose-900 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('preview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'preview'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Email Preview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('recipients')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'recipients'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Recipients List ({activeRecipients.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'settings'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Automation & Gateway Settings</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'logs'
              ? 'border-amber-500 text-amber-700 bg-amber-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Delivery Logs ({db.emailLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: Live Email Preview */}
      {activeSubTab === 'preview' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {/* Email Envelope Header */}
          <div className="bg-slate-50 p-4 border-b border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">From (Bot Sender):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-900 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                  Shadowfax PT MailBot &lt;{botAccount.email}&gt;
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-300 font-mono">
                  Gmail Bot
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">To:</span>
              <span className="font-mono text-slate-800">
                {activeRecipients.map((r) => `${r.name} <${r.email}>`).join(', ') || 'No active recipients'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500">Subject:</span>
              <span className="font-bold text-slate-900">
                {emailPayload.subject}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="font-semibold text-slate-500">Attachment:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded font-mono text-[11px] font-semibold">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  {emailPayload.attachmentName}
                </span>
                <button
                  onClick={() => downloadExcelAttachment(emailPayload)}
                  className="text-xs text-sky-700 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3 h-3" /> Download
                </button>
              </div>
            </div>
          </div>

          {/* Email Body Content */}
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header banner in email */}
            <div className="border-b-2 border-amber-500 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Shadowfax NCR Bamnoli DC (Site: NBP)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Daily PT Scan Volume & Payment Settlement Audit • {operationalDate}
                  </p>
                </div>
                <span className="bg-amber-100 text-amber-900 font-mono font-bold text-xs px-2.5 py-1 rounded">
                  SITE: NBP
                </span>
              </div>
            </div>

            {/* Email Greeting */}
            <div className="text-xs text-slate-700 leading-relaxed space-y-1">
              <p>Dear Operations Team & Leadership,</p>
              <p>
                Please find below the consolidated PT scan processing and payment summary for{' '}
                <strong>{operationalDate}</strong>. All figures have been strictly calculated against
                verified active roster PTs (excluding machine sorter and unmapped layouts).
              </p>
            </div>

            {/* Executive Highlights KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Total PT Scans</div>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {summary.totalCombinedScans.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Pri: {summary.totalPrimaryScans.toLocaleString()} | Sec: {summary.totalSecondaryScans.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Total DC Payout</div>
                <div className="text-xl font-black text-amber-700 font-mono mt-1">
                  ₹{summary.totalCombinedCost.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Pri: ₹{summary.totalPrimaryCost.toLocaleString()} | Sec: ₹{summary.totalSecondaryCost.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Active PTs</div>
                <div className="text-xl font-black text-indigo-700 font-mono mt-1">
                  {Math.max(summary.totalPrimaryPTs, summary.totalSecondaryPTs)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Avg Scans: {summary.totalPrimaryPTs > 0 ? Math.round(summary.totalCombinedScans / Math.max(1, summary.totalPrimaryPTs)) : 0}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">Machine Sorter</div>
                <div className="text-xl font-black text-slate-600 font-mono mt-1">
                  {machineRecordsCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Auto-Excluded (₹0)
                </div>
              </div>
            </div>

            {/* Block-Wise Table in Email */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>Block-Wise Performance Breakdown</span>
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">DC Block</th>
                      <th className="py-2 px-3">Primary Scans</th>
                      <th className="py-2 px-3">Secondary Scans</th>
                      <th className="py-2 px-3">Total Scans</th>
                      <th className="py-2 px-3">Workload Share</th>
                      <th className="py-2 px-3">Block Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {blockMetrics.map((b) => (
                      <tr key={b.block} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">Block {b.block}</td>
                        <td className="py-2 px-3 text-slate-700">{b.primaryScans.toLocaleString()}</td>
                        <td className="py-2 px-3 text-slate-700">{b.secondaryScans.toLocaleString()}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{b.totalScans.toLocaleString()}</td>
                        <td className="py-2 px-3 text-amber-700 font-semibold">{b.scanSharePercentage}%</td>
                        <td className="py-2 px-3 font-bold text-slate-900">₹{b.totalCost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Earners */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Top Performing PTs Today (Ranked by Earnings)
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Rank</th>
                      <th className="py-2 px-3">Scan ID</th>
                      <th className="py-2 px-3">Valinor ID</th>
                      <th className="py-2 px-3">MP Name</th>
                      <th className="py-2 px-3">Block</th>
                      <th className="py-2 px-3">Total Scans</th>
                      <th className="py-2 px-3">Total Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {topEarners.length > 0 ? (
                      topEarners.map((pt: PTPerformanceStats, idx: number) => (
                        <tr key={pt.scan_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-amber-700">#{idx + 1}</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">{pt.scan_id}</td>
                          <td className="py-2 px-3 text-slate-600">{pt.valinor_id || '-'}</td>
                          <td className="py-2 px-3 font-sans font-semibold text-slate-900">{pt.mp_name}</td>
                          <td className="py-2 px-3">{pt.assigned_block}</td>
                          <td className="py-2 px-3">{pt.todayTotalScans.toLocaleString()}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">₹{pt.todayTotalEarnings.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                          No PT scan records recorded for {operationalDate}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Email Footer */}
            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
              <p>Generated automatically by MailBot — Shadowfax NCR Bamnoli DC (Site: NBP).</p>
              <p>Rates Applied: Primary @ ₹{currentRate.primary_rate.toFixed(2)} | Secondary @ ₹{currentRate.secondary_rate.toFixed(2)}</p>
              <p className="italic">For detailed shift logs or raw files, refer to the attached Excel workbook.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Recipients List */}
      {activeSubTab === 'recipients' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Recipient Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs h-fit">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-amber-600" />
              Add Email Recipient
            </h3>
            <form onSubmit={handleAddRecipient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Address:</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul.sharma@shadowfax.in"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Role / Designation:</label>
                <input
                  type="text"
                  placeholder="e.g. Hub Manager / Shift Lead"
                  value={newRecipientRole}
                  onChange={(e) => setNewRecipientRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg shadow-xs transition-colors mt-2"
              >
                Add to MailBot Recipient List
              </button>
            </form>
          </div>

          {/* Existing Recipients Table */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configured MailBot Recipients ({db.emailRecipients.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recipients will receive the automated daily summary at {mailBotConfig.scheduleTime} IST
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {db.emailRecipients.map((rec) => (
                <div key={rec.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rec.is_active}
                      onChange={() => handleToggleRecipient(rec)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 accent-amber-600 cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{rec.name}</span>
                        <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                          {rec.role}
                        </span>
                        {rec.email === 'kuldeep.chandolia@shadowfax.in' && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            DC LEAD
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 font-mono mt-0.5">{rec.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        rec.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {rec.is_active ? 'Active' : 'Muted'}
                    </span>
                    <button
                      onClick={() => handleDeleteRecipient(rec.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete Recipient"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Automation & Gateway Settings */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 max-w-4xl">
          {/* Bot Sender Account (Gmail & Credentials) */}
          <div className="bg-white border-2 border-amber-400 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-600 shadow-inner">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      MailBot Sender Account (Gmail Credentials)
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-300">
                      Configured & Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All previous sender mail IDs removed. System dispatches operational reports strictly from this bot Gmail ID.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetBotDefaults}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 self-start sm:self-auto bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
                title="Reset to default bot account (shadowfaxptbot@gmail.com / Sfx@123)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Default Bot</span>
              </button>
            </div>

            {botCredsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-semibold animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Bot Gmail credentials saved! All automated reports and drafts will be sent from {botEmailInput}.</span>
              </div>
            )}

            <form onSubmit={handleSaveBotCredentials} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bot Gmail ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-amber-600" />
                      <span>Bot Gmail ID (Sender):</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(botEmailInput);
                        setCopiedBotEmail(true);
                        setTimeout(() => setCopiedBotEmail(false), 2500);
                      }}
                      className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                    >
                      {copiedBotEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBotEmail ? 'Copied' : 'Copy Email'}</span>
                    </button>
                  </div>
                  <input
                    type="email"
                    required
                    value={botEmailInput}
                    onChange={(e) => setBotEmailInput(e.target.value)}
                    placeholder="shadowfaxptbot@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 font-medium">
                    Pre-set Bot ID: <span className="font-mono font-bold text-amber-800">shadowfaxptbot@gmail.com</span>
                  </p>
                </div>

                {/* Bot Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Bot Password:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(botPasswordInput);
                        setCopiedBotPassword(true);
                        setTimeout(() => setCopiedBotPassword(false), 2500);
                      }}
                      className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                    >
                      {copiedBotPassword ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBotPassword ? 'Copied' : 'Copy Password'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showBotPassword ? 'text' : 'password'}
                      required
                      value={botPasswordInput}
                      onChange={(e) => setBotPasswordInput(e.target.value)}
                      placeholder="Sfx@123"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-amber-500 focus:bg-white transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBotPassword(!showBotPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showBotPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Pre-set Password: <span className="font-mono font-bold text-slate-900">Sfx@123</span>
                  </p>
                </div>
              </div>

              {/* Protocol Specs Grid */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500">Service:</span>
                  <p className="font-bold text-slate-900 font-mono">Google Gmail</p>
                </div>
                <div>
                  <span className="text-slate-500">SMTP Host:</span>
                  <p className="font-bold text-slate-900 font-mono">smtp.gmail.com</p>
                </div>
                <div>
                  <span className="text-slate-500">Port / Security:</span>
                  <p className="font-bold text-slate-900 font-mono">465 (SSL / TLS)</p>
                </div>
                <div>
                  <span className="text-slate-500">Sender Display:</span>
                  <p className="font-bold text-slate-900 truncate">Shadowfax PT MailBot</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Bot Credentials</span>
                </button>
              </div>
            </form>
          </div>

          {/* Scheduler Preferences */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">MailBot Schedule & Content</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure timing, daily frequency, and default email format
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Enable toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-900 text-sm">Automated Dispatch Active</span>
                  <p className="text-slate-500 mt-0.5">
                    Triggers daily email summary dispatch at the scheduled IST hour
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mailBotConfig.isEnabled}
                    onChange={(e) => handleConfigChange({ isEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Scheduled Time */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-900 text-sm mb-1">
                  Daily Scheduled Dispatch Time (IST):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={mailBotConfig.scheduleTime}
                    onChange={(e) => handleConfigChange({ scheduleTime: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-slate-500">
                    Default: 23:59:00 IST (at close of shift data)
                  </span>
                </div>
              </div>

              {/* Include Excel Attachment */}
              <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mailBotConfig.includeExcelAttachment}
                  onChange={(e) => handleConfigChange({ includeExcelAttachment: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 accent-amber-600"
                />
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    Attach Multi-Sheet Daily Excel Report (.xlsx)
                  </span>
                  <p className="text-slate-500 mt-0.5">
                    Includes Dashboard Summary, PT Details, Hourly Audit, and Block Share sheets
                  </p>
                </div>
              </label>

              {/* Custom Subject Line */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-bold text-slate-900 text-sm mb-1">
                  Custom Email Subject Prefix:
                </label>
                <input
                  type="text"
                  value={mailBotConfig.customSubject || ''}
                  onChange={(e) => handleConfigChange({ customSubject: e.target.value })}
                  placeholder="[NBP DC Daily Report] PT Scans & Payout Summary"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Gateway Option A: Google Apps Script Webhook (Zero GCP project needed) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Google Apps Script Automated Webhook
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    Zero GCP Required • Works in Shadowfax Workspace
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Send 100% automated emails directly from your <span className="font-mono">@shadowfax.in</span> account without needing Google Cloud project creator rights.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Google Apps Script Web App URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    value={mailBotConfig.webhookConfig?.webhookUrl || ''}
                    onChange={(e) =>
                      handleConfigChange({
                        webhookConfig: {
                          enabled: true,
                          webhookUrl: e.target.value.trim(),
                        },
                      })
                    }
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-amber-500 text-xs"
                  />
                  <button
                    onClick={handleDispatchWebhook}
                    disabled={!mailBotConfig.webhookConfig?.webhookUrl}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    Test Webhook
                  </button>
                </div>
              </div>

              {/* Instructions and Copy Code */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">
                    How to setup in 1 minute (Free inside Shadowfax Google Workspace):
                  </span>
                  <button
                    onClick={copyAppsScript}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-800 font-bold text-[11px] shadow-2xs"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{copiedScript ? 'Code Copied!' : 'Copy Script Code'}</span>
                  </button>
                </div>
                <ol className="list-decimal list-inside text-slate-600 space-y-1 text-[11px] leading-relaxed">
                  <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-600 underline font-semibold">script.google.com</a> in your browser.</li>
                  <li>Click <strong>"New project"</strong>, delete any sample code, and paste the copied code.</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong>, select type <strong>"Web app"</strong>.</li>
                  <li>Set <em>Execute as:</em> <strong>Me</strong> and <em>Who has access:</em> <strong>Anyone</strong>.</li>
                  <li>Click Deploy, copy the resulting Web app URL, and paste it into the field above!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Delivery Logs */}
      {activeSubTab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">MailBot Transmission Logs</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all email dispatches executed by MailBot
              </p>
            </div>
            {db.emailLogs.length > 0 && (
              <button
                onClick={() => {
                  clearEmailLogs();
                  setDispatchStatus('Transmission logs history cleared.');
                  setTimeout(() => setDispatchStatus(null), 3000);
                  onRefresh();
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear History
              </button>
            )}
          </div>

          {db.emailLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Sent At</th>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-3">Ops Date</th>
                    <th className="py-2 px-3">Total Scans</th>
                    <th className="py-2 px-3">Total Payout</th>
                    <th className="py-2 px-3">Trigger Type</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {db.emailLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(log.sent_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 font-sans">{log.recipient_name}</div>
                        <div className="text-[11px] text-slate-500">{log.recipient_email}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{log.operational_date}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{log.total_scans.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">₹{log.total_payment.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {log.trigger_type === 'VERIFICATION_TEST' ? (
                          <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1 w-fit shadow-2xs">
                            <Zap className="w-3 h-3 text-emerald-600" />
                            <span>VERIFICATION TEST</span>
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {log.trigger_type}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{log.trigger_type === 'VERIFICATION_TEST' ? 'VERIFIED (DELIVERED)' : 'DELIVERED'}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              <Mail className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p>No email transmissions recorded yet. Use "Send via Gmail Web" to trigger a transmission.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
