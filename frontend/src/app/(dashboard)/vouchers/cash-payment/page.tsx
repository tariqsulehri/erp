import VoucherEntryPage from '@/components/vouchers/VoucherEntryPage';

export const metadata = { title: 'Cash Payment Voucher — ERP Finance' };

export default function CashPaymentPage() {
  return <VoucherEntryPage voucherType="CPV" />;
}
