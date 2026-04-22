import VoucherEntryPage from '@/components/vouchers/VoucherEntryPage';

export const metadata = { title: 'Bank Receipt Voucher — ERP Finance' };

export default function BankReceiptPage() {
  return <VoucherEntryPage voucherType="BRV" />;
}
