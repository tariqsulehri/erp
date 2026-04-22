import VoucherEntryPage from '@/components/vouchers/VoucherEntryPage';

export const metadata = { title: 'Journal Voucher — ERP Finance' };

export default function JournalVoucherPage() {
  return <VoucherEntryPage voucherType="JV" />;
}
