import CashBankVoucherPage from '@/components/vouchers/CashBankVoucherPage';

export const metadata = { title: 'Cash Payment Voucher — ERP Finance' };

export default function CashPaymentPage() {
  return <CashBankVoucherPage voucherType="CPV" />;
}
