import { PTRosterEntry } from '../types';

export const ADMIN_CREDENTIALS = {
  id: 'Admin',
  password: 'Sfx@123',
};

export const ADMIN_AUTH_STORAGE_KEY = 'SFX_ADMIN_AUTHENTICATED';
export const PT_AUTH_STORAGE_KEY = 'SFX_LOGGED_IN_PT_SCAN_ID';

/**
 * Checks admin credentials against required ID: Admin and Password: Sfx@123
 */
export function checkAdminAuth(enteredId: string, enteredPass: string): boolean {
  if (!enteredId || !enteredPass) return false;
  const isIdValid = enteredId.trim().toLowerCase() === ADMIN_CREDENTIALS.id.toLowerCase();
  const isPassValid = enteredPass.trim() === ADMIN_CREDENTIALS.password;
  return isIdValid && isPassValid;
}

/**
 * Extracts last 5 digits of Valinor ID as defined by operational requirement:
 * "password is last 5 digit of valinor ID (For example: manish wants to check his own earning
 * then he open separate linked link with username - 7088318203, Password - 16945"
 */
export function extractValinorPassword(valinorId: string): string {
  if (!valinorId) return '';
  const clean = valinorId.trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 5) {
    return digits.slice(-5);
  }
  return clean.slice(-5);
}

/**
 * Authenticates a PT worker using their Scan ID and last 5 digits of Valinor ID
 */
export function verifyPtLogin(
  roster: PTRosterEntry[],
  inputScanId: string,
  inputPass: string
): { success: boolean; pt?: PTRosterEntry; message: string } {
  const cleanScanId = inputScanId.trim();
  const cleanPass = inputPass.trim();

  if (!cleanScanId || !cleanPass) {
    return { success: false, message: 'Please enter both your Scan ID (Username) and Password.' };
  }

  // Find in roster by scan_id or mp_id (case-insensitive)
  const pt = roster.find(
    (r) =>
      (r.scan_id && r.scan_id.trim().toLowerCase() === cleanScanId.toLowerCase()) ||
      (r.mp_id && r.mp_id.trim().toLowerCase() === cleanScanId.toLowerCase())
  );

  if (!pt) {
    return {
      success: false,
      message: `Scan ID "${cleanScanId}" was not found in the DC active roster. Please verify your Scan ID or contact your shift supervisor.`,
    };
  }

  if (pt.status !== 'Active') {
    return {
      success: false,
      message: `Roster profile for "${pt.mp_name}" is currently marked Inactive. Please contact DC Incharge.`,
    };
  }

  const expectedPass = extractValinorPassword(pt.valinor_id);
  const isMatch =
    cleanPass === expectedPass ||
    (pt.valinor_id && cleanPass.toLowerCase() === pt.valinor_id.trim().toLowerCase()) ||
    (pt.valinor_id && pt.valinor_id.trim().endsWith(cleanPass));

  if (!isMatch) {
    return {
      success: false,
      message: `Incorrect password. Please enter the last 5 digits of your Valinor ID (e.g. 16945).`,
    };
  }

  return { success: true, pt, message: 'Login successful' };
}
