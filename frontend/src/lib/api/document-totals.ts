/** Grand totals returned by the Purchase, Purchase Return, Sale and Sale Return list endpoints. */
export interface DocumentListTotals {
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
}
