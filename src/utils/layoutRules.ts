import { ProcessType } from '../types';

/**
 * Layout identification and classification rules for Shadowfax NCR Bamnoli DC (Site: NBP)
 */

export interface LayoutClassificationResult {
  isEligible: boolean;
  isMachine: boolean;
  isExcluded: boolean;
  isUnknown: boolean;
  processType: ProcessType;
  reason: string;
}

// Layouts specifically excluded until explicitly approved
export const EXCLUDED_PENDING_APPROVAL_LAYOUTS = [
  'NBP-FMRTS-0910-PRI-SSC',
  'NBP-PRP-SDD15-SSC',
];

// Clean layout string (remove extra trailing dots or spaces)
export function sanitizeLayoutName(rawLayout: string | null | undefined): string {
  if (!rawLayout) return '';
  let str = String(rawLayout).trim();
  return str;
}

export function classifyLayout(
  rawLayoutName: string | null | undefined,
  actionUser: string | number | null | undefined = '',
  customPrimaryLayouts: string[] = [],
  customSecondaryLayouts: string[] = []
): LayoutClassificationResult {
  const layout = sanitizeLayoutName(rawLayoutName);
  const layoutUpper = layout.toUpperCase();

  // 1. Check machine sorter first
  if (layoutUpper === 'NBP-MU-01' || layoutUpper.includes('MU-01') || layoutUpper.includes('MUVRO') ||
      String(actionUser || '').toLowerCase().includes('muvro_sorter')) {
    return {
      isEligible: false,
      isMachine: true,
      isExcluded: true,
      isUnknown: false,
      processType: 'MACHINE_SORTER',
      reason: 'Machine Sorter Layout (NBP-MU-01 / Muvro). Excluded from PT payments.',
    };
  }

  // 2. Check if layout begins with "NBP"
  if (!layoutUpper.startsWith('NBP')) {
    return {
      isEligible: false,
      isMachine: false,
      isExcluded: true,
      isUnknown: false,
      processType: 'UNKNOWN',
      reason: 'Ignored non-NBP layout. Only layouts beginning with NBP are eligible.',
    };
  }

  // 3. Check explicitly excluded layouts pending approval
  if (EXCLUDED_PENDING_APPROVAL_LAYOUTS.some(ex => layoutUpper === ex.toUpperCase())) {
    return {
      isEligible: false,
      isMachine: false,
      isExcluded: true,
      isUnknown: false,
      processType: 'EXCLUDED',
      reason: `Layout excluded pending explicit approval (${layout}).`,
    };
  }

  // 4. Check custom configured approved mappings if any
  if (customPrimaryLayouts.some(l => l.toUpperCase() === layoutUpper)) {
    return {
      isEligible: true,
      isMachine: false,
      isExcluded: false,
      isUnknown: false,
      processType: 'PRIMARY',
      reason: 'Configured Primary Layout.',
    };
  }

  if (customSecondaryLayouts.some(l => l.toUpperCase() === layoutUpper)) {
    return {
      isEligible: true,
      isMachine: false,
      isExcluded: false,
      isUnknown: false,
      processType: 'SECONDARY',
      reason: 'Configured Secondary Layout.',
    };
  }

  // 5. Standard Primary Layout Rules:
  // Layouts with PRI, PRIMARY, or Primary receiving (e.g. NBP-INTRA-A-SSC which is Block A Primary infeed)
  if (
    layoutUpper.includes('PRI') ||
    layoutUpper.startsWith('NBP-INTRA-A-SSC') ||
    layoutUpper.includes('INBOUND') ||
    layoutUpper.includes('RECEIVE')
  ) {
    return {
      isEligible: true,
      isMachine: false,
      isExcluded: false,
      isUnknown: false,
      processType: 'PRIMARY',
      reason: 'Classified as Primary Process layout.',
    };
  }

  // 6. Standard Secondary Layout Rules:
  // e.g., NBP-INTRA-D-SSC, NBP-ZON-D-SSC, NBP-AIR-DCDC
  if (
    layoutUpper.startsWith('NBP-INTRA-D-SSC') ||
    layoutUpper.startsWith('NBP-ZON-D-SSC') ||
    layoutUpper.startsWith('NBP-AIR-DCDC') ||
    layoutUpper.includes('SEC') ||
    layoutUpper.includes('MANIFEST') ||
    layoutUpper.includes('OUTBOUND') ||
    layoutUpper.includes('BAG')
  ) {
    return {
      isEligible: true,
      isMachine: false,
      isExcluded: false,
      isUnknown: false,
      processType: 'SECONDARY',
      reason: layoutUpper.includes('AIR-DCDC') 
        ? 'AIR DCDC Secondary layout logic.'
        : 'Classified as Secondary Process layout.',
    };
  }

  // 7. Unknown NBP Layout - NEVER silently classify! Must record for Admin review.
  return {
    isEligible: false,
    isMachine: false,
    isExcluded: false,
    isUnknown: true,
    processType: 'UNKNOWN',
    reason: `Unknown NBP layout (${layout}). Flagged for Admin review.`,
  };
}

export function classifyScanHistoryStatus(status: string | null | undefined): ProcessType {
  if (!status) return 'UNKNOWN';
  const s = String(status).toUpperCase().trim();
  
  if (s === 'RECEIVED_AT_DC' || s.includes('RECEIVED')) {
    return 'PRIMARY';
  }
  
  if (
    s === 'IN_MANIFEST' ||
    s === 'IN_DCH_MANIFEST' ||
    s === 'IN_HDC_MANIFEST' ||
    s.includes('MANIFEST')
  ) {
    return 'SECONDARY';
  }

  return 'UNKNOWN';
}
