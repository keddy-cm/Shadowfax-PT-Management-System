import React, { useState, useEffect, useCallback } from 'react';
import {
  loadDatabase,
  getActiveRateForDate,
  subscribeToFirestore,
  logEmailDelivery,
  updateMailBotConfig,
} from './db/storage';
import { AppDatabase, RateConfig } from './types';
import { Header, NavTab } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PtDetailsAndCalculator } from './components/PtDetailsAndCalculator';
import { UploadScanRateModal } from './components/UploadScanRateModal';
import { UploadScanHistoryModal } from './components/UploadScanHistoryModal';
import { AdminPanel } from './components/AdminPanel';
import { ReportsHub } from './components/ReportsHub';
import { MailBotPanel } from './components/MailBotPanel';
import { calculateDashboardSummary } from './utils/calculator';
import { ChatAssistant } from './components/ChatAssistant';
import { PtPortalPage } from './components/PtPortalPage';
import { AdminAuthModal } from './components/AdminAuthModal';
import { SharePtPortalModal } from './components/SharePtPortalModal';
import { ADMIN_AUTH_STORAGE_KEY } from './utils/auth';
import { getTodayDateString, isTodayDate } from './utils/dateUtils';
import { DateFilterModal } from './components/DateFilterModal';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

/**
 * Checks if current browser URL corresponds to the standalone PT worker portal
 */
function isPtPortalRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return (
    urlParams.get('portal') === 'pt' ||
    urlParams.get('page') === 'pt' ||
    window.location.hash === '#pt' ||
    window.location.hash === '#pt-portal' ||
    window.location.pathname === '/pt' ||
    window.location.pathname === '/pt-portal'
  );
}

export default function App() {
  // Check if loaded in isolated PT Portal mode
  const [isPtPortal, setIsPtPortal] = useState<boolean>(() => isPtPortalRoute());

  // Operational date defaults to actual local current day (e.g. 2026-11-03)
  const [operationalDate, setOperationalDate] = useState<string>(() => getTodayDateString());
  // When isLiveDateMode is true, the system automatically advances operationalDate to current day at midnight
  const [isLiveDateMode, setIsLiveDateMode] = useState<boolean>(true);
  const [showDateFilterModal, setShowDateFilterModal] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [showSharePtModal, setShowSharePtModal] = useState<boolean>(false);

  const [userRole, setUserRole] = useState<'ADMIN' | 'MANAGER'>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true') {
      return 'ADMIN';
    }
    return 'MANAGER';
  });

  // Auto-refresh states & configurable interval (default 30 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(30);
  const [countdownSec, setCountdownSec] = useState<number>(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  const [selectedPtId, setSelectedPtId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'warning'; message: string } | null>(null);
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());

  const currentRate: RateConfig = getActiveRateForDate(operationalDate);

  // Listen to popstate and hashchange to detect URL switches
  useEffect(() => {
    const handleUrlChange = () => {
      setIsPtPortal(isPtPortalRoute());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Listen to Cloud Firestore real-time updates across all sessions and devices
  useEffect(() => {
    const unsubscribe = subscribeToFirestore((updatedDb) => {
      setDb({ ...updatedDb });
      setLastRefreshedAt(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    });
    return () => unsubscribe();
  }, []);

  const reloadData = useCallback(() => {
    setIsRefreshing(true);
    const freshDb = loadDatabase();
    setDb({ ...freshDb });
    setLastRefreshedAt(
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  }, []);

  // Automatic day change to current day:
  // When in live mode (isLiveDateMode === true), periodically check if local day has changed.
  useEffect(() => {
    const checkDayRollover = () => {
      const today = getTodayDateString();
      if (isLiveDateMode && operationalDate !== today) {
        setOperationalDate(today);
        setNotification({
          type: 'info',
          message: `Operational date automatically advanced to current day: ${today}`,
        });
      }
    };

    // Check every 10 seconds for day rollover
    const interval = setInterval(checkDayRollover, 10000);

    // Also check immediately when tab gains focus or visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDayRollover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isLiveDateMode, operationalDate]);

  // Auto-refresh countdown & periodic execution
  useEffect(() => {
    if (!autoRefresh || isPtPortal) return;

    const timer = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          reloadData();
          return refreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, isPtPortal, refreshIntervalSec, reloadData]);

  // Automated MailBot Background Engine:
  // When MailBot is active (isEnabled: true), continuously monitors scheduled dispatch time (e.g. 23:59 IST)
  useEffect(() => {
    if (!db.mailBotConfig?.isEnabled) return;

    const checkMailBotSchedule = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const scheduleTime = db.mailBotConfig?.scheduleTime || '23:59';

      const todayStr = getTodayDateString();
      const lastDispatched = db.mailBotConfig?.lastDispatchedAt;

      // When scheduled time arrives and report has not yet been logged for today
      if (currentTimeStr === scheduleTime && lastDispatched !== todayStr) {
        const activeRecipients = db.emailRecipients.filter((r) => r.is_active);
        if (activeRecipients.length > 0) {
          const summary = calculateDashboardSummary(
            todayStr,
            db.scanRateRecords,
            db.roster,
            currentRate,
            'ALL'
          );
          const nowIso = new Date().toISOString();

          activeRecipients.forEach((rec) => {
            logEmailDelivery({
              id: 'auto-sched-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              recipient_email: rec.email,
              recipient_name: rec.name,
              sent_at: nowIso,
              operational_date: todayStr,
              status: 'DELIVERED',
              total_scans: summary.totalCombinedScans,
              total_payment: summary.totalCombinedCost,
              trigger_type: 'AUTOMATIC_1159_PM',
            });
          });

          updateMailBotConfig({
            lastDispatchedAt: todayStr,
            totalAutomatedDispatches: (db.mailBotConfig?.totalAutomatedDispatches || 0) + 1,
          });

          reloadData();
          showToast(`MailBot: Daily automated summary dispatched to ${activeRecipients.length} recipients.`, 'info');
        }
      }
    };

    const interval = setInterval(checkMailBotSchedule, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [db.mailBotConfig, db.emailRecipients, db.scanRateRecords, db.roster, currentRate, reloadData]);

  // Handler for explicit date changes from input or modal
  const handleDateChange = (newDate: string, isExplicitLiveToday?: boolean) => {
    setOperationalDate(newDate);
    const today = getTodayDateString();
    if (isExplicitLiveToday !== undefined) {
      setIsLiveDateMode(isExplicitLiveToday);
    } else {
      setIsLiveDateMode(newDate === today);
    }
  };

  const handleResetToToday = () => {
    const today = getTodayDateString();
    setOperationalDate(today);
    setIsLiveDateMode(true);
    showToast(`Switched back to Live Current Day: ${today}`, 'success');
  };

  const handleAdminAuthSuccess = () => {
    setIsAdminAuthenticated(true);
    setUserRole('ADMIN');
    setShowAdminAuthModal(false);
    setActiveTab('admin');
    showToast('Admin access unlocked successfully. Logged in as Admin.', 'success');
  };

  const handleLockAdmin = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    }
    setIsAdminAuthenticated(false);
    setUserRole('MANAGER');
    if (activeTab === 'admin') {
      setActiveTab('dashboard');
    }
    showToast('Admin session locked. Credentials (ID: Admin / Sfx@123) required.', 'info');
  };

  const handleViewPtDetails = (scanId: string) => {
    setSelectedPtId(scanId);
    setActiveTab('pt-details');
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // =========================================================================
  // 1. STANDALONE PT PORTAL VIEW
  // Strict isolation: Zero access to DC dashboard, no header, no chat bot, no metrics
  // =========================================================================
  if (isPtPortal) {
    return (
      <PtPortalPage
        db={db}
        operationalDate={operationalDate}
        currentRate={currentRate}
      />
    );
  }

  // =========================================================================
  // 2. MAIN DC OPERATIONS DASHBOARD (SUPERVISORS / MANAGERS / ADMINS)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        operationalDate={operationalDate}
        setOperationalDate={(d) => handleDateChange(d)}
        userRole={userRole}
        setUserRole={setUserRole}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        onManualRefresh={reloadData}
        isRefreshing={isRefreshing}
        lastRefreshedAt={lastRefreshedAt}
        isAdminAuthenticated={isAdminAuthenticated}
        onRequireAdminAuth={() => setShowAdminAuthModal(true)}
        onLockAdmin={handleLockAdmin}
        onOpenSharePtModal={() => setShowSharePtModal(true)}
        onOpenFilterModal={() => setShowDateFilterModal(true)}
        onResetToToday={handleResetToToday}
        countdownSec={countdownSec}
        refreshIntervalSec={refreshIntervalSec}
      />

      {/* Global Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-in">
          <div
            className={`p-4 rounded-xl shadow-lg border flex items-start gap-3 ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : notification.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs flex-1">
              <p className="font-semibold">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            db={db}
            operationalDate={operationalDate}
            currentRate={currentRate}
            onViewPtDetails={handleViewPtDetails}
            onOpenUploadRate={() => setActiveTab('upload-rate')}
            onOpenUploadHistory={() => setActiveTab('upload-history')}
            onOpenMailBot={() => setActiveTab('mailbot')}
            onOpenPtPortal={() => setShowSharePtModal(true)}
            onOpenFilterModal={() => setShowDateFilterModal(true)}
            onResetToToday={handleResetToToday}
          />
        )}

        {activeTab === 'pt-details' && (
          <PtDetailsAndCalculator
            db={db}
            operationalDate={operationalDate}
            setOperationalDate={(d) => handleDateChange(d)}
            currentRate={currentRate}
            selectedPtId={selectedPtId}
            onSelectPtId={setSelectedPtId}
            onOpenPtPortal={() => setShowSharePtModal(true)}
            onOpenFilterModal={() => setShowDateFilterModal(true)}
            onResetToToday={handleResetToToday}
          />
        )}

        {activeTab === 'upload-rate' && (
          <UploadScanRateModal
            db={db}
            currentDate={operationalDate}
            onImportComplete={(msg) => {
              reloadData();
              showToast(msg, 'success');
              setActiveTab('dashboard');
            }}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'upload-history' && (
          <UploadScanHistoryModal
            db={db}
            currentDate={operationalDate}
            onImportComplete={(msg) => {
              reloadData();
              showToast(msg, 'success');
              setActiveTab('dashboard');
            }}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsHub
            db={db}
            operationalDate={operationalDate}
            setOperationalDate={setOperationalDate}
            currentRate={currentRate}
          />
        )}

        {activeTab === 'mailbot' && (
          <MailBotPanel
            db={db}
            operationalDate={operationalDate}
            currentRate={currentRate}
            onRefresh={reloadData}
            onClose={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'admin' && (
          isAdminAuthenticated ? (
            <AdminPanel
              db={db}
              onRefresh={reloadData}
              userRole={userRole}
              operationalDate={operationalDate}
              onLockAdmin={handleLockAdmin}
            />
          ) : (
            <div className="py-16 flex items-center justify-center">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-lg text-center max-w-md w-full space-y-4 animate-fade-in">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Admin Authentication Required</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Access to DC PT Roster, Rate configuration, and System management requires administrator sign-in.
                  </p>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-mono">
                  Required: ID: <strong>Admin</strong> | Password: <strong>Sfx@123</strong>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setShowAdminAuthModal(true)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all"
                  >
                    Enter Admin Credentials (Sfx@123)
                  </button>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Admin Authentication Modal */}
      <AdminAuthModal
        isOpen={showAdminAuthModal}
        onSuccess={handleAdminAuthSuccess}
        onCancel={() => setShowAdminAuthModal(false)}
      />

      {/* Share PT Portal Link Modal */}
      <SharePtPortalModal
        isOpen={showSharePtModal}
        onClose={() => setShowSharePtModal(false)}
      />

      {/* Date & Historical Filter View Modal */}
      <DateFilterModal
        isOpen={showDateFilterModal}
        onClose={() => setShowDateFilterModal(false)}
        operationalDate={operationalDate}
        onSelectDate={(date, isLiveToday) => handleDateChange(date, isLiveToday)}
        db={db}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        refreshIntervalSec={refreshIntervalSec}
        setRefreshIntervalSec={(sec) => {
          setRefreshIntervalSec(sec);
          setCountdownSec(sec);
        }}
        onManualRefresh={reloadData}
        isRefreshing={isRefreshing}
        lastRefreshedAt={lastRefreshedAt}
      />

      {/* Floating Operational Chat Assistant */}
      <ChatAssistant
        db={db}
        operationalDate={operationalDate}
        currentRate={currentRate}
        onSelectPtId={handleViewPtDetails}
        onOpenMailBot={() => setActiveTab('mailbot')}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Shadowfax NCR Bamnoli DC (Site: NBP)
            </span>
            <span>•</span>
            <span>PT Scan & Payment Management System</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            3-Year Historical Retention • Manual File Ingestion • Machine Sorter Auto-Exclusion • Match Key: Scan_ID
          </div>
        </div>
      </footer>
    </div>
  );
}
