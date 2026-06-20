import CashBankVoucherPage from '@/components/vouchers/CashBankVoucherPage';

export const metadata = { title: 'Cash Receipt Voucher — ERP Finance' };

export default function CashReceiptPage() {
  return <CashBankVoucherPage voucherType="CRV" />;
}
