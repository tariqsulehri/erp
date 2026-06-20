export const ACCOUNT_CODE_LENGTH = 10;
export const ACCOUNT_CODE_PATTERN = /^\d{10}$/;

export const CUSTOMER_ACCOUNT_CODE_PREFIX = '0103';
export const SUPPLIER_ACCOUNT_CODE_PREFIX = '0201';

export const CUSTOMER_ACCOUNT_CODE_START = '0103010001';
export const CUSTOMER_ACCOUNT_CODE_END = '0103999999';
export const SUPPLIER_ACCOUNT_CODE_START = '0201010001';
export const SUPPLIER_ACCOUNT_CODE_END = '0201999999';

export const PARTY_ACCOUNT_SUBGROUP_MIN = 1;
export const PARTY_ACCOUNT_SUBGROUP_MAX = 99;
export const POSTING_ACCOUNT_MIN = 1;
export const POSTING_ACCOUNT_MAX = 9999;

export const ACCOUNT_LEVEL_LABELS: Record<number, string> = {
  1: 'Main Category',
  2: 'Group',
  3: 'Sub-Group',
  4: 'Posting Account',
};

export function isValidAccountCode(code: string): boolean {
  return ACCOUNT_CODE_PATTERN.test(code);
}

export function formatAccountCodeNumber(value: number): string {
  return String(value).padStart(ACCOUNT_CODE_LENGTH, '0');
}

export function buildPostingAccountCode(prefix: string, subgroup: number, posting: number): string {
  return `${prefix}${String(subgroup).padStart(2, '0')}${String(posting).padStart(4, '0')}`;
}

export function getAccountLevel(code: string): number {
  if (!isValidAccountCode(code)) return 0;

  const group = code.slice(2, 4);
  const subGroup = code.slice(4, 6);
  const posting = code.slice(6, 10);

  if (group === '00' && subGroup === '00' && posting === '0000') return 1;
  if (subGroup === '00' && posting === '0000') return 2;
  if (posting === '0000') return 3;
  return 4;
}

export function getAccountLevelLabel(code: string): string {
  return ACCOUNT_LEVEL_LABELS[getAccountLevel(code)] ?? 'Invalid Code';
}

export function isHeaderAccountCode(code: string): boolean {
  return isValidAccountCode(code) && code.slice(6, 10) === '0000';
}

export function isTopLevelAccountCode(code: string): boolean {
  return getAccountLevel(code) === 1;
}

export function getParentAccountCode(code: string): string | null {
  if (!isValidAccountCode(code)) return null;

  const level = getAccountLevel(code);
  if (level === 1) return null;
  if (level === 2) return `${code.slice(0, 2)}00000000`;
  if (level === 3) return `${code.slice(0, 4)}000000`;
  return `${code.slice(0, 6)}0000`;
}

export function getChildCodeRange(parentCode: string, isPosting = false): {
  rangeStart: number;
  rangeEnd: number;
  step: number;
} | null {
  if (!isValidAccountCode(parentCode)) return null;

  const level = getAccountLevel(parentCode);
  if (level === 1 && !isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 2)}01000000`),
      rangeEnd: Number(`${parentCode.slice(0, 2)}99000000`) + 1,
      step: 1000000,
    };
  }

  if (level === 2 && !isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 4)}010000`),
      rangeEnd: Number(`${parentCode.slice(0, 4)}990000`) + 1,
      step: 10000,
    };
  }

  if (level === 3 && isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 6)}0001`),
      rangeEnd: Number(`${parentCode.slice(0, 6)}9999`) + 1,
      step: 1,
    };
  }

  return null;
}

export function getDescendantCodeRange(parentCode: string): {
  rangeStart: number;
  rangeEnd: number;
} | null {
  if (!isValidAccountCode(parentCode)) return null;

  const level = getAccountLevel(parentCode);
  if (level === 1) {
    return {
      rangeStart: Number(parentCode),
      rangeEnd: Number(`${String(Number(parentCode.slice(0, 2)) + 1).padStart(2, '0')}00000000`),
    };
  }
  if (level === 2) {
    return {
      rangeStart: Number(parentCode),
      rangeEnd: Number(parentCode) + 1000000,
    };
  }
  if (level === 3) {
    return {
      rangeStart: Number(parentCode),
      rangeEnd: Number(parentCode) + 10000,
    };
  }
  return null;
}

function eightDigitToTenDigit(code: string): string {
  if (code >= '13000001' && code <= '13999999') {
    const offset = Number(code) - 13000000;
    const subgroup = Math.floor((offset - 1) / POSTING_ACCOUNT_MAX) + 1;
    const posting = ((offset - 1) % POSTING_ACCOUNT_MAX) + 1;
    if (subgroup <= PARTY_ACCOUNT_SUBGROUP_MAX) {
      return buildPostingAccountCode(CUSTOMER_ACCOUNT_CODE_PREFIX, subgroup, posting);
    }
  }

  if (code >= '21000001' && code <= '21999999') {
    const offset = Number(code) - 21000000;
    const subgroup = Math.floor((offset - 1) / POSTING_ACCOUNT_MAX) + 1;
    const posting = ((offset - 1) % POSTING_ACCOUNT_MAX) + 1;
    if (subgroup <= PARTY_ACCOUNT_SUBGROUP_MAX) {
      return buildPostingAccountCode(SUPPLIER_ACCOUNT_CODE_PREFIX, subgroup, posting);
    }
  }

  const mainCategory = code.slice(0, 1).padStart(2, '0');
  const group = code.slice(1, 2).padStart(2, '0');
  const subGroup = `${code.slice(2, 3)}0`;
  const posting = `${code.slice(3, 4)}${code.slice(6, 8)}`.padStart(4, '0');
  return `${mainCategory}${group}${subGroup}${posting}`;
}

export function toCurrentAccountCode(code: string, isPosting: boolean): string {
  const clean = code.trim();
  if (isValidAccountCode(clean)) return clean;

  if (/^\d{8}$/.test(clean)) {
    return eightDigitToTenDigit(clean);
  }

  if (/^\d{7}$/.test(clean)) {
    return eightDigitToTenDigit(`${clean.slice(0, 2)}0${clean.slice(2)}`);
  }

  if (/^\d{6}$/.test(clean)) {
    const eightDigit = isPosting || !clean.endsWith('0')
      ? `${clean.slice(0, 5)}00${clean.slice(5)}`
      : `${clean}00`;
    return eightDigitToTenDigit(eightDigit);
  }

  if (/^\d{4}$/.test(clean)) {
    const eightDigit = isPosting || !clean.endsWith('0')
      ? `${clean.slice(0, 3)}0000${clean.slice(3)}`
      : `${clean}0000`;
    return eightDigitToTenDigit(eightDigit);
  }

  return clean;
}
