import StockAdjustmentPage from '@/components/stock-adjustments/StockAdjustmentPage';

export const metadata = { title: 'Opening Stock — BizTrack' };

export default function OpeningStockRoute() {
  return <StockAdjustmentPage documentKind="Opening Stock" />;
}
