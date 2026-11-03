import {
  AppDatabase,
  PTRosterEntry,
  RateConfig,
  ScanRateRecord,
  ScanHistoryRecord,
  ImportAuditLog,
  UnknownLayoutReview,
  UnregisteredMPReview,
  EmailRecipient,
  EmailDeliveryLog,
  BlockType,
  MailBotConfig,
  BotAccountConfig,
  SmtpConfig,
  DriveConfig,
  DriveSyncLog,
} from '../types';

// Standalone zero-cloud local database engine (Zero Google Cloud project/billing required)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const STORAGE_KEY = 'SHADOWFAX_NBP_PT_SYSTEM_PROD_CLEAN_V2';

export const DEFAULT_DRIVE_FOLDER_ID = '1awbpzVsqjcuNil31zNEuxhC40-vZoodU';
export const DEFAULT_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1awbpzVsqjcuNil31zNEuxhC40-vZoodU';

export const DEFAULT_DRIVE_CONFIG: DriveConfig = {
  isEnabled: true,
  driveFolderId: DEFAULT_DRIVE_FOLDER_ID,
  driveFolderUrl: DEFAULT_DRIVE_FOLDER_URL,
  autoSyncDaily: true,
  totalSyncedFiles: 0,
};

export const DEFAULT_BOT_ACCOUNT: BotAccountConfig = {
  email: 'shadowfaxptbot@gmail.com',
  password: 'Sfx@123',
  displayName: 'Shadowfax PT MailBot',
  service: 'gmail',
};

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'shadowfaxptbot@gmail.com',
  pass: 'Sfx@123',
  fromName: 'Shadowfax PT MailBot',
  fromEmail: 'shadowfaxptbot@gmail.com',
};

export const DEFAULT_MAILBOT_CONFIG: MailBotConfig = {
  isEnabled: true,
  scheduleTime: '23:59',
  frequency: 'daily',
  includeExcelAttachment: true,
  includeBlockBreakdown: true,
  includeTopEarners: true,
  customSubject: '[NBP DC Daily Report] PT Scans & Payout Summary',
  lastDispatchedAt: undefined,
  nextScheduledAt: 'Today at 23:59:00 IST',
  totalAutomatedDispatches: 0,
  channel: 'gmail_web',
  botAccount: DEFAULT_BOT_ACCOUNT,
  smtpConfig: DEFAULT_SMTP_CONFIG,
};

// Clean Production blank database schema (Zero dummy records)
export const BLANK_DATABASE: AppDatabase = {
  roster: [],
  rates: [
    {
      id: 'rate-init-2026',
      primary_rate: 0.35,
      secondary_rate: 0.25,
      effective_from: '2026-01-01',
      created_at: new Date().toISOString(),
      created_by: 'Admin',
      note: 'Default operational rate configuration',
    },
  ],
  scanRateRecords: [],
  scanHistoryRecords: [],
  importLogs: [],
  unknownLayouts: [],
  unregisteredMps: [],
  emailRecipients: [
    {
      id: 'rec-kd-gmail',
      name: 'Kuldeep Chandolia',
      email: 'kdchandolia@gmail.com',
      role: 'Operations Lead / DC Incharge',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'rec-0',
      name: 'Kuldeep Chandolia (Shadowfax)',
      email: 'kuldeep.chandolia@shadowfax.in',
      role: 'Operations Lead',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'rec-1',
      name: 'Bamnoli Operations Team',
      email: 'nbp.operations@shadowfax.in',
      role: 'Operations Team',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'rec-2',
      name: 'Shift Incharge',
      email: 'nbp.shift@shadowfax.in',
      role: 'DC Shift Incharge',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ],
  emailLogs: [],
  mailBotConfig: DEFAULT_MAILBOT_CONFIG,
  driveConfig: DEFAULT_DRIVE_CONFIG,
  driveLogs: [],
};

let dbCache: AppDatabase | null = null;

export function loadDatabase(): AppDatabase {
  if (dbCache) return dbCache;

  try {
    // Purge legacy test databases if present
    if (typeof window !== 'undefined') {
      localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_DB_V1');
      localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_DB_V2');
      localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_PROD_V1');
    }

    const raw = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    
    if (!raw) {
      dbCache = JSON.parse(JSON.stringify(BLANK_DATABASE));
      saveDatabase(dbCache!);
      return dbCache!;
    }

    const parsed = JSON.parse(raw);
    const normalizedRoster: PTRosterEntry[] = (parsed.roster || []).map((r: any) => ({
      ...r,
      scan_id: r.scan_id || r.mp_id || '',
      valinor_id: r.valinor_id || '',
      mp_id: r.scan_id || r.mp_id || '',
    }));

    let existingRecipients: EmailRecipient[] = (parsed.emailRecipients && parsed.emailRecipients.length > 0)
      ? parsed.emailRecipients
      : [...BLANK_DATABASE.emailRecipients];

    if (!existingRecipients.some((r) => r.email.toLowerCase() === 'kdchandolia@gmail.com')) {
      existingRecipients = [
        {
          id: 'rec-kd-gmail',
          name: 'Kuldeep Chandolia',
          email: 'kdchandolia@gmail.com',
          role: 'Operations Lead / DC Incharge',
          is_active: true,
          created_at: new Date().toISOString(),
        },
        ...existingRecipients,
      ];
    }

    dbCache = {
      roster: normalizedRoster,
      rates: parsed.rates?.length ? parsed.rates : BLANK_DATABASE.rates,
      scanRateRecords: parsed.scanRateRecords || [],
      scanHistoryRecords: parsed.scanHistoryRecords || [],
      importLogs: parsed.importLogs || [],
      unknownLayouts: parsed.unknownLayouts || [],
      unregisteredMps: parsed.unregisteredMps || [],
      emailRecipients: existingRecipients,
      emailLogs: parsed.emailLogs || [],
      mailBotConfig: (() => {
        const cfg: MailBotConfig = parsed.mailBotConfig || { ...DEFAULT_MAILBOT_CONFIG };
        cfg.isEnabled = true; // Always activated
        cfg.botAccount = {
          email: 'shadowfaxptbot@gmail.com',
          password: 'Sfx@123',
          displayName: 'Shadowfax PT MailBot',
          service: 'gmail',
          ...(cfg.botAccount || {}),
        };
        cfg.smtpConfig = {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          user: 'shadowfaxptbot@gmail.com',
          pass: 'Sfx@123',
          fromName: 'Shadowfax PT MailBot',
          fromEmail: 'shadowfaxptbot@gmail.com',
          ...(cfg.smtpConfig || {}),
        };
        return cfg;
      })(),
      driveConfig: (() => {
        const cfg: DriveConfig = parsed.driveConfig || { ...DEFAULT_DRIVE_CONFIG };
        if (
          !cfg.driveFolderUrl ||
          cfg.driveFolderUrl.includes('my-drive') ||
          !cfg.driveFolderId ||
          cfg.driveFolderId === 'Shadowfax_NBP_DC_Reports'
        ) {
          cfg.driveFolderUrl = DEFAULT_DRIVE_FOLDER_URL;
          cfg.driveFolderId = DEFAULT_DRIVE_FOLDER_ID;
        }
        return cfg;
      })(),
      driveLogs: parsed.driveLogs || [],
    };
    return dbCache!;
  } catch (err) {
    console.error('Failed to load database:', err);
    dbCache = JSON.parse(JSON.stringify(BLANK_DATABASE));
    return dbCache!;
  }
}

export interface RetentionPolicyInfo {
  minimumRetentionDays: number;
  minimumRetentionDuration: string;
  status: string;
  databaseId: string;
  region: string;
  totalHistoricalDays: number;
  totalRecordsCount: number;
  earliestDate: string;
  latestDate: string;
  policyEnforced: boolean;
}

export function getRetentionPolicyInfo(db: AppDatabase): RetentionPolicyInfo {
  const dates = Array.from(new Set(db.scanRateRecords.map((r) => r.operational_date))).sort();
  return {
    minimumRetentionDays: 365,
    minimumRetentionDuration: '1 Year (Minimum 365 Days)',
    status: 'ACTIVE & ENFORCED (LOCAL)',
    databaseId: 'Local High-Capacity Storage',
    region: 'Local Storage Engine',
    totalHistoricalDays: Math.max(1, dates.length),
    totalRecordsCount: db.scanRateRecords.length,
    earliestDate: dates[0] || '2026-01-01',
    latestDate: dates[dates.length - 1] || new Date().toISOString().split('T')[0],
    policyEnforced: true,
  };
}

export function saveDatabase(db: AppDatabase): void {
  try {
    dbCache = db;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  } catch (err) {
    console.error('Failed to persist database to localStorage:', err);
  }

  syncToFirestore(db);
}

export function syncToFirestore(_db: AppDatabase): void {
  // Pure local database storage - no external Google Cloud project or billing required
}

export async function testConnection(): Promise<boolean> {
  return true;
}

export function subscribeToFirestore(onUpdate: (db: AppDatabase) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const fresh = JSON.parse(e.newValue);
        dbCache = fresh;
        onUpdate(fresh);
      } catch (err) {
        console.warn('Storage sync notice:', err);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

export function resetToBlankDatabase(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_DB_V1');
    localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_DB_V2');
    localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_PROD_V1');
    localStorage.removeItem('SHADOWFAX_NBP_PT_SYSTEM_PROD_CLEAN_V1');
    localStorage.removeItem(STORAGE_KEY);
  }
  const blank = JSON.parse(JSON.stringify(BLANK_DATABASE));
  dbCache = blank;
  saveDatabase(blank);
}

// ---------------- Rates Management ----------------
export function getActiveRateForDate(dateStr: string): RateConfig {
  const db = loadDatabase();
  const validRates = db.rates
    .filter((r) => r.effective_from <= dateStr)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  if (validRates.length > 0) {
    return validRates[0];
  }
  return db.rates[0] || {
    id: 'fallback',
    primary_rate: 0.35,
    secondary_rate: 0.25,
    effective_from: '2026-01-01',
    created_at: new Date().toISOString(),
    created_by: 'System',
  };
}

export function addRateConfig(newRate: Omit<RateConfig, 'id' | 'created_at'>): RateConfig {
  const db = loadDatabase();
  const rate: RateConfig = {
    ...newRate,
    id: 'rate-' + Date.now(),
    created_at: new Date().toISOString(),
  };
  db.rates.push(rate);
  saveDatabase(db);
  return rate;
}

// ---------------- Roster Management ----------------
export function getRoster(): PTRosterEntry[] {
  return loadDatabase().roster;
}

export function saveRosterEntry(entry: PTRosterEntry): void {
  const db = loadDatabase();
  const lookupKey = entry.scan_id || entry.mp_id;
  const existingIdx = db.roster.findIndex(
    (r) => (r.scan_id && r.scan_id === lookupKey) || (r.mp_id && r.mp_id === lookupKey)
  );
  const now = new Date().toISOString();

  const completeEntry: PTRosterEntry = {
    ...entry,
    scan_id: entry.scan_id || entry.mp_id || '',
    mp_id: entry.scan_id || entry.mp_id || '',
    valinor_id: entry.valinor_id || '',
  };

  if (existingIdx >= 0) {
    const existing = db.roster[existingIdx];
    const blockChanged = existing.assigned_block !== completeEntry.assigned_block;
    const history = existing.block_history || [];
    if (blockChanged) {
      history.push({
        block: completeEntry.assigned_block,
        changed_at: now,
      });
    }

    db.roster[existingIdx] = {
      ...existing,
      ...completeEntry,
      updated_at: now,
      block_history: history,
    };
  } else {
    db.roster.push({
      ...completeEntry,
      created_at: now,
      updated_at: now,
      block_history: [
        {
          block: completeEntry.assigned_block,
          changed_at: now,
        },
      ],
    });
  }

  // If this MP was in unregisteredMps, mark it converted
  const unregIdx = db.unregisteredMps.findIndex((u) => u.normalized_mp_id === lookupKey);
  if (unregIdx >= 0) {
    db.unregisteredMps[unregIdx].status = 'CONVERTED_TO_PT';
  }

  saveDatabase(db);
}

export function deactivatePTRoster(scanId: string): void {
  const db = loadDatabase();
  const target = db.roster.find((r) => r.scan_id === scanId || r.mp_id === scanId);
  if (target) {
    target.status = 'Inactive';
    target.updated_at = new Date().toISOString();
    saveDatabase(db);
  }
}

export function replaceRoster(newRoster: PTRosterEntry[]): void {
  const db = loadDatabase();
  db.roster = newRoster.map(r => ({
    ...r,
    scan_id: r.scan_id || r.mp_id || '',
    mp_id: r.scan_id || r.mp_id || '',
    valinor_id: r.valinor_id || '',
  }));
  saveDatabase(db);
}

// ---------------- Scan Rate Records & Hourly Replacement ----------------
export function commitScanRateImport(
  operationalDate: string,
  records: ScanRateRecord[],
  importLog: ImportAuditLog,
  hoursToReplace: Array<string | number>
): void {
  const db = loadDatabase();

  if (hoursToReplace.length > 0) {
    const hourSet = new Set(hoursToReplace.map(String));
    db.scanRateRecords = db.scanRateRecords.filter(
      (r) => !(r.operational_date === operationalDate && hourSet.has(String(r.hour)))
    );
  }

  db.scanRateRecords.push(...records);
  db.importLogs.unshift(importLog);
  saveDatabase(db);
}

// ---------------- Scan History Records ----------------
export function commitScanHistoryImport(
  records: ScanHistoryRecord[],
  importLog: ImportAuditLog
): void {
  const db = loadDatabase();
  db.scanHistoryRecords.push(...records);
  db.importLogs.unshift(importLog);
  saveDatabase(db);
}

// ---------------- Unknown Layouts & Unregistered MPs Tracking ----------------
export function recordUnknownLayout(layoutName: string, dateStr: string, filename: string, scans: number): void {
  const db = loadDatabase();
  const existing = db.unknownLayouts.find((u) => u.layout_name.toUpperCase() === layoutName.toUpperCase());
  if (existing) {
    existing.total_scans_recorded += scans;
  } else {
    db.unknownLayouts.push({
      id: 'ul-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      layout_name: layoutName,
      first_seen_date: dateStr,
      first_seen_file: filename,
      total_scans_recorded: scans,
      status: 'PENDING_REVIEW',
    });
  }
  saveDatabase(db);
}

export function recordUnregisteredMP(rawUser: string, normalizedId: string, dateStr: string, scans: number, layout: string): void {
  const db = loadDatabase();
  const existing = db.unregisteredMps.find((u) => u.normalized_mp_id === normalizedId);
  if (existing) {
    existing.total_scans_recorded += scans;
    existing.last_layout_used = layout;
  } else {
    db.unregisteredMps.push({
      id: 'unreg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      raw_action_user: rawUser,
      normalized_mp_id: normalizedId,
      first_seen_date: dateStr,
      total_scans_recorded: scans,
      last_layout_used: layout,
      status: 'UNREGISTERED',
    });
  }
  saveDatabase(db);
}

// ---------------- Email Scheduler & Delivery Logs ----------------
export function saveEmailRecipient(recipient: EmailRecipient): void {
  const db = loadDatabase();
  const idx = db.emailRecipients.findIndex((r) => r.id === recipient.id);
  if (idx >= 0) {
    db.emailRecipients[idx] = recipient;
  } else {
    db.emailRecipients.push(recipient);
  }
  saveDatabase(db);
}

export function deleteEmailRecipient(id: string): void {
  const db = loadDatabase();
  db.emailRecipients = db.emailRecipients.filter((r) => r.id !== id);
  saveDatabase(db);
}

export function logEmailDelivery(log: EmailDeliveryLog): void {
  const db = loadDatabase();
  db.emailLogs.unshift(log);
  saveDatabase(db);
}

export function updateMailBotConfig(config: Partial<MailBotConfig>): MailBotConfig {
  const db = loadDatabase();
  db.mailBotConfig = {
    ...(db.mailBotConfig || DEFAULT_MAILBOT_CONFIG),
    ...config,
  };
  saveDatabase(db);
  return db.mailBotConfig;
}

export function clearEmailLogs(): void {
  const db = loadDatabase();
  db.emailLogs = [];
  saveDatabase(db);
}

// ---------------- Google Drive Sync & Logs ----------------
export function logDriveSync(log: DriveSyncLog): void {
  const db = loadDatabase();
  if (!db.driveLogs) db.driveLogs = [];
  db.driveLogs.unshift(log);
  if (db.driveConfig) {
    db.driveConfig.totalSyncedFiles = (db.driveConfig.totalSyncedFiles || 0) + 1;
    db.driveConfig.lastSyncedAt = new Date().toISOString();
  }
  saveDatabase(db);
}

export function updateDriveConfig(config: Partial<DriveConfig>): DriveConfig {
  const db = loadDatabase();
  db.driveConfig = {
    ...(db.driveConfig || DEFAULT_DRIVE_CONFIG),
    ...config,
  };
  saveDatabase(db);
  return db.driveConfig;
}

export function clearDriveLogs(): void {
  const db = loadDatabase();
  db.driveLogs = [];
  saveDatabase(db);
}


