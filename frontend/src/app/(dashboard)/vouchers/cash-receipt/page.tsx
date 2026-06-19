import VoucherEntryPage from '@/components/vouchers/VoucherEntryPage';

export const metadata = { title: 'Cash Receipt Voucher — ERP Finance' };

export default function CashReceiptPage() {
  return <VoucherEntryPage voucherType="CRV" />;
}
