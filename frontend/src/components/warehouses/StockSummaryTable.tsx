import { formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import type { WarehouseStockRow } from '@/lib/api/warehouses';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

/** Item stock held by one Warehouse or one Branch (one row per item and Location). */
export function StockSummaryTable({ placeLabel, rows, loading, notSaved = false, isFiltered, settings }: {
  placeLabel: 'Warehouse' | 'Branch';
  rows: WarehouseStockRow[];
  loading: boolean;
  /** True while a new Warehouse has not been saved yet. */
  notSaved?: boolean;
  isFiltered: boolean;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1000 }}>
      <thead>
        <tr>
          <th style={{ width: 130 }}>Item Code</th>
          <th>Item Name</th>
          <th style={{ width: 170 }}>Location</th>
          <th className="num" style={{ width: 120 }}>Stock On Hand</th>
          <th className="num" style={{ width: 110 }}>Reserved</th>
          <th className="num" style={{ width: 110 }}>Available</th>
          <th className="num" style={{ width: 130 }}>Average Cost</th>
          <th className="num" style={{ width: 140 }}>Stock Value</th>
        </tr>
      </thead>
      <tbody>
        {loading && <TableMessageRow colSpan={8} title="Loading Stock Summary…" loading />}
        {!loading && rows.length === 0 && (
          notSaved
            ? <TableMessageRow colSpan={8} title="No Stock Yet" description={`Save the ${placeLabel} first. Stock appears here after it is received into this ${placeLabel}.`} />
            : isFiltered
              ? <TableMessageRow colSpan={8} title="No Stock Matches" description={`Change or clear the search text to see all stock in this ${placeLabel}.`} />
              : <TableMessageRow colSpan={8} title={`No Stock In This ${placeLabel}`} description={placeLabel === 'Branch' ? 'Stock appears here after a transfer, sale return, or adjustment is posted to this Branch.' : 'Stock appears here after a purchase, transfer, or adjustment is posted to this Warehouse.'} />
        )}
        {!loading && rows.map(row => (
          <tr key={row.id}>
            <td className="cell-strong">{row.sku || row.item_code}</td>
            <td>{row.item_name}</td>
            <td className={row.location_name ? undefined : 'cell-muted'}>{row.location_name ? `${row.location_code ?? ''} - ${row.location_name}` : 'Not Set'}</td>
            <td className="num">{formatNumber(row.stock_on_hand, settings)}</td>
            <td className="num">{formatNumber(row.reserved_stock, settings)}</td>
            <td className="num">{formatNumber(row.available_stock, settings)}</td>
            <td className="num">{formatMoney(row.average_cost, settings)}</td>
            <td className="num">{formatMoney(row.total_stock_value, settings)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
