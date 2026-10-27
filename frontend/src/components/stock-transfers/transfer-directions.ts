import type { TransferPlaceKind } from '@/lib/api/stock-transfers';

export type TransferDirection = 'WAREHOUSE_TO_BRANCH' | 'BRANCH_TO_BRANCH' | 'WAREHOUSE_TO_WAREHOUSE' | 'BRANCH_TO_WAREHOUSE';

export interface DirectionOption {
  value: TransferDirection;
  from: TransferPlaceKind;
  to: TransferPlaceKind;
  /** Short name, e.g. "Warehouse → Branch". */
  label: string;
  /** One plain sentence about when to use it. */
  description: string;
}

/** The four ways stock can move. Warehouse → Branch is the usual one, so it comes first. */
export const TRANSFER_DIRECTIONS: DirectionOption[] = [
  { value: 'WAREHOUSE_TO_BRANCH', from: 'WAREHOUSE', to: 'BRANCH', label: 'Warehouse → Branch', description: 'Send stock from storage to a shop for selling.' },
  { value: 'BRANCH_TO_BRANCH', from: 'BRANCH', to: 'BRANCH', label: 'Branch → Branch', description: 'Move stock between two shops.' },
  { value: 'WAREHOUSE_TO_WAREHOUSE', from: 'WAREHOUSE', to: 'WAREHOUSE', label: 'Warehouse → Warehouse', description: 'Move stock between two storage places.' },
  { value: 'BRANCH_TO_WAREHOUSE', from: 'BRANCH', to: 'WAREHOUSE', label: 'Branch → Warehouse', description: 'Send stock from a shop back to storage.' },
];

export function directionOf(from: TransferPlaceKind, to: TransferPlaceKind): TransferDirection {
  return `${from}_TO_${to}` as TransferDirection;
}

export function directionOption(value: TransferDirection) {
  return TRANSFER_DIRECTIONS.find(option => option.value === value) ?? TRANSFER_DIRECTIONS[0];
}

/** Directions a user may start: Branch and Warehouse users send only from their own kind of place. */
export function directionsFor(lockedKind?: TransferPlaceKind | null) {
  return lockedKind ? TRANSFER_DIRECTIONS.filter(option => option.from === lockedKind) : TRANSFER_DIRECTIONS;
}
