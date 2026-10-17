import type { formatNumber } from '@/lib/app-settings';

export type PurchasePrintSettings = Parameters<typeof formatNumber>[1];

export interface PurchasePrintProps {
  invoice: any;
  company: any;
  generalSettings: PurchasePrintSettings;
  money: (value: number) => string;
}
