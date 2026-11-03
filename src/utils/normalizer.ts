/**
 * Normalizer utility for Shadowfax PT System (Site: NBP)
 */

export function normalizeMpId(rawUser: string | number | null | undefined): string {
  if (rawUser === null || rawUser === undefined) return '';
  let str = String(rawUser).trim();
  
  // If Excel parsed a large number with trailing decimals like 968893.0
  if (str.endsWith('.0') && !isNaN(Number(str))) {
    str = str.slice(0, -2);
  }

  // Remove email domain or facility suffixes like @OneNCR_DC, @shadowfax.in, etc.
  if (str.includes('@')) {
    str = str.split('@')[0].trim();
  }

  // Remove trailing periods or special punctuation
  str = str.replace(/[.,;]+$/, '').trim();

  return str;
}

export function isMachineSorter(actionUser: string | number | null | undefined, layoutName: string = ''): boolean {
  const user = String(actionUser || '').toLowerCase().trim();
  const layout = String(layoutName || '').toUpperCase().trim();

  if (user === 'bamnoli_dc_muvro_sorter' || user.includes('muvro') || user.includes('sorter')) {
    return true;
  }
  if (layout === 'NBP-MU-01' || layout.includes('MU-01') || layout.includes('MUVRO')) {
    return true;
  }
  return false;
}
