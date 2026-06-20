import CashBankVoucherPage from '@/components/vouchers/CashBankVoucherPage';

export const metadata = { title: 'Bank Payment Voucher — ERP Finance' };

export default function BankPaymentPage() {
  return <CashBankVoucherPage voucherType="BPV" />;
}
