import * as XLSX from 'xlsx';
import { AppDatabase, RateConfig, EmailRecipient, SmtpConfig, WebhookConfig } from '../types';
import {
  calculateDashboardSummary,
  calculateAllBlocksMetrics,
  calculateTopEarners,
  PTPerformanceStats,
} from './calculator';
import { generateDailyExcelReport } from './excelExport';

export const DEFAULT_BOT_SENDER_EMAIL = 'shadowfaxptbot@gmail.com';
export const DEFAULT_BOT_SENDER_PASSWORD = 'Sfx@123';
export const DEFAULT_BOT_SENDER_NAME = 'Shadowfax PT MailBot';

export interface EmailPayload {
  to: string[];
  from: string;
  fromEmail: string;
  subject: string;
  htmlBody: string;
  plainText: string;
  attachmentName: string;
  attachmentBase64: string;
}

/**
 * Builds the complete email payload including Excel attachment base64
 */
export function buildDailyEmailPayload(
  db: AppDatabase,
  operationalDate: string,
  currentRate: RateConfig,
  customSubject?: string
): EmailPayload {
  const activeRecipients = db.emailRecipients.filter((r) => r.is_active);
  const toList = activeRecipients.map((r) => r.email);

  const botConfig = db.mailBotConfig?.botAccount || {
    email: DEFAULT_BOT_SENDER_EMAIL,
    password: DEFAULT_BOT_SENDER_PASSWORD,
    displayName: DEFAULT_BOT_SENDER_NAME,
  };
  const fromEmail = botConfig.email || DEFAULT_BOT_SENDER_EMAIL;
  const fromName = botConfig.displayName || DEFAULT_BOT_SENDER_NAME;
  const from = `${fromName} <${fromEmail}>`;

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

  const subject = `${customSubject || '[NBP DC Daily Report] PT Scans & Payout Summary'} — ${operationalDate}`;

  // Generate Excel workbook
  const wb = generateDailyExcelReport(db, operationalDate);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const attachmentName = `NBP_DC_PT_Daily_Report_${operationalDate}.xlsx`;

  // HTML Body
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; border-bottom: 4px solid #f59e0b; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .badge { display: inline-block; background: #f59e0b; color: #000000; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
    .content { padding: 24px; }
    .intro { font-size: 13px; color: #334155; line-height: 1.6; margin-bottom: 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .kpi-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-val { font-size: 20px; font-weight: 800; color: #0f172a; font-family: monospace; }
    .kpi-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; color: #1e293b; font-family: monospace; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 11px; color: #64748b; line-height: 1.5; }
    .attachment-notice { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Shadowfax NCR Bamnoli DC (Site: NBP)</h1>
      <p>Automated Daily PT Scans & Payout Audit Report • Operational Date: <strong>${operationalDate}</strong></p>
      <div class="badge">SITE CODE: NBP</div>
    </div>
    <div class="content">
      <div class="attachment-notice">
        📎 Multi-sheet Excel workbook attached: <strong>${attachmentName}</strong> (Dashboard, PT Details, Hourly Scans, and Block Workload).
      </div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 20px;">
        📁 <strong>Google Drive Storage:</strong> All daily reports and snapshots are stored in <a href="https://drive.google.com/drive/folders/1awbpzVsqjcuNil31zNEuxhC40-vZoodU" style="color: #15803d; font-weight: 700; text-decoration: underline;" target="_blank">Folder 1awbpzVsqjcuNil31zNEuxhC40-vZoodU</a>.
      </div>
      <p class="intro">
        Dear Leadership & Operations Team,<br><br>
        Here is the daily PT operational summary for <strong>${operationalDate}</strong>. All scan figures are matched against verified active roster members; machine sorter (NBP-MU-01) and unmapped layouts are strictly isolated.
      </p>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">Total Active PT Scans</div>
          <div class="kpi-val">${summary.totalCombinedScans.toLocaleString()}</div>
          <div class="kpi-sub">Primary: ${summary.totalPrimaryScans.toLocaleString()} | Secondary: ${summary.totalSecondaryScans.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Total PT Payout</div>
          <div class="kpi-val" style="color: #b45309;">₹${summary.totalCombinedCost.toLocaleString()}</div>
          <div class="kpi-sub">Primary: ₹${summary.totalPrimaryCost.toLocaleString()} | Secondary: ₹${summary.totalSecondaryCost.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Active PT Count</div>
          <div class="kpi-val" style="color: #4338ca;">${Math.max(summary.totalPrimaryPTs, summary.totalSecondaryPTs)} PTs</div>
          <div class="kpi-sub">Average Scans/PT: ${summary.totalPrimaryPTs > 0 ? Math.round(summary.totalCombinedScans / Math.max(1, summary.totalPrimaryPTs)) : 0}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Active Rates Applied</div>
          <div class="kpi-val" style="font-size: 15px; padding-top: 4px;">Pri: ₹${currentRate.primary_rate.toFixed(2)} | Sec: ₹${currentRate.secondary_rate.toFixed(2)}</div>
          <div class="kpi-sub">Effective from: ${currentRate.effective_from}</div>
        </div>
      </div>

      <div class="section-title">DC Block-Wise Performance Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Primary Scans</th>
            <th>Secondary Scans</th>
            <th>Total Scans</th>
            <th>Share</th>
            <th>Block Payout</th>
          </tr>
        </thead>
        <tbody>
          ${blockMetrics
            .map(
              (b) => `
            <tr>
              <td style="font-weight: 700;">Block ${b.block}</td>
              <td>${b.primaryScans.toLocaleString()}</td>
              <td>${b.secondaryScans.toLocaleString()}</td>
              <td style="font-weight: 700;">${b.totalScans.toLocaleString()}</td>
              <td style="color: #b45309;">${b.scanSharePercentage}%</td>
              <td style="font-weight: 700;">₹${b.totalCost.toLocaleString()}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>

      <div class="section-title">Top 5 Performing PTs (Ranked by Earnings)</div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Scan ID</th>
            <th>MP Name</th>
            <th>Block</th>
            <th>Total Scans</th>
            <th>Total Payout</th>
          </tr>
        </thead>
        <tbody>
          ${
            topEarners.length > 0
              ? topEarners
                  .map(
                    (pt: PTPerformanceStats, idx: number) => `
            <tr>
              <td style="font-weight: 700; color: #b45309;">#${idx + 1}</td>
              <td style="font-weight: 700;">${pt.scan_id}</td>
              <td style="font-family: sans-serif;">${pt.mp_name}</td>
              <td>${pt.assigned_block}</td>
              <td>${pt.todayTotalScans.toLocaleString()}</td>
              <td style="font-weight: 700; color: #047857;">₹${pt.todayTotalEarnings.toLocaleString()}</td>
            </tr>`
                  )
                  .join('')
              : `<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No roster PT scan activity recorded for this date</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <div class="footer">
      Automated MailBot • Shadowfax NCR Bamnoli DC (Site: NBP)<br>
      Sender: <strong>Shadowfax PT MailBot &lt;shadowfaxptbot@gmail.com&gt;</strong><br>
      Confidential operational dispatch for internal leadership review only.
    </div>
  </div>
</body>
</html>
  `.trim();

  // Plain Text Version
  const plainText = `
SHADOWFAX NCR BAMNOLI DC (SITE: NBP)
Automated Daily PT Scans & Payout Audit Report
Operational Date: ${operationalDate}
Sender: Shadowfax PT MailBot <shadowfaxptbot@gmail.com>
--------------------------------------------------

EXECUTIVE SUMMARY:
- Total PT Scans: ${summary.totalCombinedScans.toLocaleString()} (Primary: ${summary.totalPrimaryScans.toLocaleString()}, Secondary: ${summary.totalSecondaryScans.toLocaleString()})
- Total DC Payout: ₹${summary.totalCombinedCost.toLocaleString()} (Primary: ₹${summary.totalPrimaryCost.toLocaleString()}, Secondary: ₹${summary.totalSecondaryCost.toLocaleString()})
- Active PT Count: ${Math.max(summary.totalPrimaryPTs, summary.totalSecondaryPTs)} PTs
- Applicable Rates: Primary @ ₹${currentRate.primary_rate.toFixed(2)}, Secondary @ ₹${currentRate.secondary_rate.toFixed(2)}

BLOCK-WISE BREAKDOWN:
${blockMetrics.map((b) => `Block ${b.block}: ${b.totalScans.toLocaleString()} scans (${b.scanSharePercentage}%) - Payout: ₹${b.totalCost.toLocaleString()}`).join('\n')}

TOP PERFORMING PTS:
${topEarners.map((pt, i) => `#${i + 1} | Scan ID: ${pt.scan_id} | ${pt.mp_name} (${pt.assigned_block}) | Scans: ${pt.todayTotalScans.toLocaleString()} | Earnings: ₹${pt.todayTotalEarnings.toLocaleString()}`).join('\n')}

--------------------------------------------------
Sender Account: shadowfaxptbot@gmail.com
Multi-sheet Excel audit workbook attached: ${attachmentName}
Google Drive Archive: https://drive.google.com/drive/folders/1awbpzVsqjcuNil31zNEuxhC40-vZoodU
Automated dispatch by Shadowfax PT MailBot.
  `.trim();

  return {
    to: toList,
    from,
    fromEmail,
    subject,
    htmlBody,
    plainText,
    attachmentName,
    attachmentBase64: wbout,
  };
}

/**
 * Builds a dedicated verification test payload to prove MailBot is active and working
 */
export function buildVerificationTestPayload(
  db: AppDatabase,
  operationalDate: string,
  currentRate: RateConfig,
  targetEmail: string = 'kdchandolia@gmail.com'
): EmailPayload {
  const base = buildDailyEmailPayload(
    db,
    operationalDate,
    currentRate,
    `[MailBot Verification Test] Shadowfax NBP DC PT Operations Report — System Active & Operational`
  );

  const subject = `[MailBot Verification Test] Shadowfax NBP DC Daily PT Report — System Active & Operational (${operationalDate})`;
  const plainText = `
[MAILBOT VERIFICATION TEST DISPATCH]
Bot Sender: Shadowfax PT MailBot <shadowfaxptbot@gmail.com>
Recipient: ${targetEmail}
Status: ACTIVE, ONLINE & FUNCTIONAL
Operational Date: ${operationalDate}
Database: Local Storage (1-Year Minimum Data Retention Active)
--------------------------------------------------
This is an automated verification test transmission confirming that the Shadowfax NCR Bamnoli DC PT MailBot is actively running and ready to dispatch daily shift reports with multi-tab Excel workbooks.

${base.plainText}
  `.trim();

  return {
    ...base,
    to: [targetEmail, 'kuldeep.chandolia@shadowfax.in'],
    subject,
    plainText,
  };
}

/**
 * Generates an RFC 822 .eml MIME file with the Excel attachment embedded
 */
export function generateEmlFile(payload: EmailPayload): string {
  const boundary = `boundary_${Date.now()}_nbp_mailbot`;
  const toHeaders = payload.to.join(', ');

  const emlLines = [
    `From: ${payload.from || 'Shadowfax PT MailBot <shadowfaxptbot@gmail.com>'}`,
    `To: ${toHeaders}`,
    `Subject: ${payload.subject}`,
    `X-Mailer: Shadowfax NBP MailBot (shadowfaxptbot@gmail.com)`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    payload.htmlBody,
    ``,
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${payload.attachmentName}"`,
    `Content-Disposition: attachment; filename="${payload.attachmentName}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    // Break base64 into 76-character lines as per MIME standard
    payload.attachmentBase64.replace(/(.{76})/g, '$1\r\n'),
    ``,
    `--${boundary}--`,
  ];

  return emlLines.join('\r\n');
}

/**
 * Downloads the .eml file directly to the user's computer.
 * Double-clicking this .eml opens Microsoft Outlook, Apple Mail, or Thunderbird
 * with the email completely filled out and the Excel file already attached!
 */
export function downloadEmlPackage(payload: EmailPayload): void {
  const emlContent = generateEmlFile(payload);
  const blob = new Blob([emlContent], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.subject.replace(/[^a-zA-Z0-9_-]/g, '_')}.eml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the attached Excel spreadsheet directly
 */
export function downloadExcelAttachment(payload: EmailPayload): void {
  // Convert base64 back to binary
  const byteCharacters = atob(payload.attachmentBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = payload.attachmentName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1-Click Launch in Gmail Web:
 * 1. Downloads the Excel report to user's computer
 * 2. Opens Gmail compose with To, Subject, and summary text pre-filled
 */
export function launchGmailWebCompose(payload: EmailPayload): void {
  // Step 1: Auto-download the attachment so the user has it ready
  downloadExcelAttachment(payload);

  // Step 2: Open Gmail Web Compose
  const toList = payload.to.join(',');
  const encodedTo = encodeURIComponent(toList);
  const encodedSubject = encodeURIComponent(payload.subject);
  const encodedBody = encodeURIComponent(
    `${payload.plainText}\n\n[Note: The official Excel report "${payload.attachmentName}" was automatically downloaded to your computer. Please attach it above before sending.]`
  );

  const authUserParam = payload.fromEmail ? `&authuser=${encodeURIComponent(payload.fromEmail)}` : '';
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${authUserParam}&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
  const link = document.createElement('a');
  link.href = gmailUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 1-Click Verification Test Dispatch:
 * Triggers instant Excel download and launches Gmail Compose pre-addressed to kdchandolia@gmail.com
 */
export function launchVerificationTestDispatch(payload: EmailPayload): void {
  // Step 1: Auto-download the Excel report
  downloadExcelAttachment(payload);

  // Step 2: Open Gmail Web Compose
  const toList = payload.to.join(',');
  const encodedTo = encodeURIComponent(toList);
  const encodedSubject = encodeURIComponent(payload.subject);
  const encodedBody = encodeURIComponent(
    `${payload.plainText}\n\n[Verification Notice: MailBot test report "${payload.attachmentName}" was automatically downloaded to your downloads folder. Please attach it before sending if required.]`
  );

  const authUserParam = payload.fromEmail ? `&authuser=${encodeURIComponent(payload.fromEmail)}` : '';
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${authUserParam}&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
  const link = document.createElement('a');
  link.href = gmailUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Launches native system mailto client
 */
export function launchMailtoClient(payload: EmailPayload): void {
  downloadExcelAttachment(payload);
  const toList = payload.to.join(',');
  const mailtoUrl = `mailto:${encodeURIComponent(toList)}?subject=${encodeURIComponent(
    payload.subject
  )}&body=${encodeURIComponent(payload.plainText)}`;
  window.location.href = mailtoUrl;
}

/**
 * Dispatches the email through a Google Apps Script Webhook or custom HTTP webhook
 */
export async function sendViaWebhook(
  webhookUrl: string,
  payload: EmailPayload
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // avoiding CORS preflight in Google Apps Script
      },
      body: JSON.stringify({
        from: payload.from,
        fromEmail: payload.fromEmail,
        to: payload.to.join(','),
        subject: payload.subject,
        plainText: payload.plainText,
        htmlBody: payload.htmlBody,
        attachmentName: payload.attachmentName,
        attachmentBase64: payload.attachmentBase64,
      }),
    });

    if (response.ok) {
      return { success: true, message: 'Delivered successfully via Google Apps Script Webhook (from shadowfaxptbot@gmail.com).' };
    } else {
      const errTxt = await response.text();
      return {
        success: false,
        message: `Webhook returned HTTP ${response.status}: ${errTxt.slice(0, 100)}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Webhook: ${err.message || String(err)}`,
    };
  }
}

/**
 * Ready-to-deploy Google Apps Script for the user's Shadowfax Google Workspace
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `
/**
 * Shadowfax NBP MailBot — Google Apps Script Email Relay
 * Configured Bot Account: shadowfaxptbot@gmail.com (Password: Sfx@123)
 * 1. Open https://script.google.com
 * 2. Create new project and paste this code
 * 3. Click "Deploy" > "New deployment" > Select type: "Web app"
 * 4. Execute as: "Me" | Who has access: "Anyone"
 * 5. Copy the Web app URL and paste it into MailBot Settings!
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var attachments = [];
    
    if (data.attachmentBase64 && data.attachmentName) {
      var decoded = Utilities.base64Decode(data.attachmentBase64);
      var blob = Utilities.newBlob(
        decoded, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        data.attachmentName
      );
      attachments.push(blob);
    }
    
    GmailApp.sendEmail(data.to, data.subject, data.plainText, {
      name: 'Shadowfax PT MailBot',
      htmlBody: data.htmlBody,
      attachments: attachments
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Email delivered via shadowfaxptbot@gmail.com' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`.trim();
