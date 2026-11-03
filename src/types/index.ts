export type BlockType = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PTRosterEntry {
  scan_id: string; // Identifier in scan files, e.g. "968893" or "7827746889"
  valinor_id: string; // Valinor ERP Employee / MP identifier, e.g. "VAL9688"
  mp_name: string;
  assigned_block: BlockType;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
  mp_id?: string; // alias for scan_id
  original_raw_id?: string;
  block_history?: Array<{
    block: BlockType;
    changed_at: string;
    changed_by?: string;
  }>;
}

export type ProcessType = 'PRIMARY' | 'SECONDARY' | 'MACHINE_SORTER' | 'UNKNOWN' | 'EXCLUDED';

export interface RateConfig {
  id: string;
  primary_rate: number; // e.g. 0.35
  secondary_rate: number; // e.g. 0.25
  effective_from: string; // YYYY-MM-DD
  effective_to?: string; // YYYY-MM-DD or null for current
  created_at: string;
  created_by: string;
  note?: string;
}

export interface ScanRateRecord {
  id: string;
  import_id: string;
  operational_date: string; // YYYY-MM-DD
  action_user: string; // raw action_user from file, e.g. "968893@OneNCR_DC" or "7827746889"
  normalized_mp_id: string; // normalized scan_id, e.g. "968893"
  valinor_id?: string;
  layout_name: string;
  hour: number | string; // e.g. 0, 1, 2
  scan_count: number;
  process_type: ProcessType;
  is_machine: boolean;
  is_registered: boolean;
  assigned_block?: BlockType; // roster-assigned block
  primary_rate_applied: number;
  secondary_rate_applied: number;
  primary_earnings: number;
  secondary_earnings: number;
  total_earnings: number;
  created_at: string;
}

export interface ScanHistoryRecord {
  id: string;
  import_id: string;
  operational_date: string; // YYYY-MM-DD
  raw_data: Record<string, any>;
  awb_or_shipment_id?: string;
  action_user?: string;
  normalized_mp_id?: string;
  valinor_id?: string;
  layout_name?: string;
  status?: string; // e.g. RECEIVED_AT_DC, IN_MANIFEST, etc.
  process_type?: ProcessType;
  hour?: number | string;
  event_timestamp?: string;
  is_registered?: boolean;
  created_at: string;
}

export interface ImportAuditLog {
  id: string;
  file_type: 'SCAN_RATE' | 'SCAN_HISTORY' | 'PT_ROSTER';
  filename: string;
  operational_date: string;
  uploaded_at: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  machine_sorter_rows: number;
  unknown_layout_rows: number;
  unregistered_mp_rows: number;
  replacement_mode: boolean;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  error_summary?: string;
}

export interface UnknownLayoutReview {
  id: string;
  layout_name: string;
  first_seen_date: string;
  first_seen_file: string;
  total_scans_recorded: number;
  status: 'PENDING_REVIEW' | 'APPROVED_PRIMARY' | 'APPROVED_SECONDARY' | 'EXCLUDED';
  approved_at?: string;
}

export interface UnregisteredMPReview {
  id: string;
  raw_action_user: string;
  normalized_mp_id: string;
  first_seen_date: string;
  total_scans_recorded: number;
  last_layout_used: string;
  status: 'UNREGISTERED' | 'CONVERTED_TO_PT';
}

export interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailDeliveryLog {
  id: string;
  recipient_email: string;
  recipient_name: string;
  sent_at: string;
  operational_date: string;
  status: 'DELIVERED' | 'FAILED' | 'RETRYING';
  error_message?: string;
  total_scans: number;
  total_payment: number;
  trigger_type: 'AUTOMATIC_1159_PM' | 'MANUAL_TRIGGER' | 'VERIFICATION_TEST';
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail?: string;
}

export interface WebhookConfig {
  webhookUrl: string;
  enabled: boolean;
}

export interface BotAccountConfig {
  email: string;
  password: string;
  displayName: string;
  service: string;
}

export interface MailBotConfig {
  isEnabled: boolean;
  scheduleTime: string; // "23:59"
  frequency: 'daily' | 'hourly_shift' | 'manual';
  includeExcelAttachment: boolean;
  includeBlockBreakdown: boolean;
  includeTopEarners: boolean;
  customSubject?: string;
  lastDispatchedAt?: string;
  nextScheduledAt?: string;
  totalAutomatedDispatches: number;
  channel?: 'gmail_web' | 'smtp' | 'webhook' | 'eml_package';
  botAccount?: BotAccountConfig;
  smtpConfig?: SmtpConfig;
  webhookConfig?: WebhookConfig;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  type?: 'general' | 'query_result' | 'pt_profile' | 'alert' | 'email_draft';
  dataPayload?: any;
}

export interface DriveSyncLog {
  id: string;
  synced_at: string;
  operational_date: string;
  file_name: string;
  folder_name: string;
  drive_file_id?: string;
  drive_url?: string;
  status: 'SUCCESS' | 'FAILED' | 'DOWNLOADED';
  error_message?: string;
  total_records: number;
  total_payment: number;
}

export interface DriveConfig {
  isEnabled: boolean;
  driveFolderId?: string;
  driveFolderUrl?: string;
  webhookUrl?: string;
  autoSyncDaily: boolean;
  lastSyncedAt?: string;
  totalSyncedFiles: number;
}

export interface AppDatabase {
  roster: PTRosterEntry[];
  rates: RateConfig[];
  scanRateRecords: ScanRateRecord[];
  scanHistoryRecords: ScanHistoryRecord[];
  importLogs: ImportAuditLog[];
  unknownLayouts: UnknownLayoutReview[];
  unregisteredMps: UnregisteredMPReview[];
  emailRecipients: EmailRecipient[];
  emailLogs: EmailDeliveryLog[];
  mailBotConfig?: MailBotConfig;
  driveConfig?: DriveConfig;
  driveLogs?: DriveSyncLog[];
}


