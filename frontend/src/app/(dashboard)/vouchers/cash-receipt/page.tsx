import CashBankVoucherPage from '@/components/vouchers/CashBankVoucherPage';

export const metadata = { title: 'Cash Receipt Voucher — BizTrack' };

export default function CashReceiptPage() {
  return <CashBankVoucherPage voucherType="CRV" />;
}
