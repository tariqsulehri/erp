import VoucherEntryPage from '@/components/vouchers/VoucherEntryPage';

export const metadata = { title: 'Bank Payment Voucher — ERP Finance' };

export default function BankPaymentPage() {
  return <VoucherEntryPage voucherType="BPV" />;
}
