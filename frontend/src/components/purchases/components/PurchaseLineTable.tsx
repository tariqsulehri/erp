'use client';

import { IconArrowDown, IconArrowUp, IconPencil, IconTrash } from '@tabler/icons-react';
import { formatNumber } from '@/lib/app-settings';
import {
  lineActionButtonStyle,
  lineActionGroupStyle,
  tableCellStyle,
  tableHeadStyle,
} from '../PurchaseVoucherStyles';
import type { PurchaseLine } from '../PurchaseVoucherTypes';

interface PurchaseLineTableProps {
  priceColumnLabel?: string;
  lines: PurchaseLine[];
  generalSettings: any;
  money: (value: number) => string;
  onMoveLine: (id: number, direction: -1 | 1) => void;
  onEditLine: (line: PurchaseLine) => void;
  onRemoveLine: (id: number) => void;
}

export function PurchaseLineTable({
  priceColumnLabel = 'Purchase Price',
  lines,
  generalSettings,
  money,
  onMoveLine,
  onEditLine,
  onRemoveLine,
}: PurchaseLineTableProps) {
  return (
    <div style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 110 }} />
          <col />
          <col style={{ width: 70 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 112 }} />
          <col style={{ width: 102 }} />
          <col style={{ width: 102 }} />
          <col style={{ width: 118 }} />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead>
          <tr>
            {['No.', 'Item Code', 'Item Name', 'UOM', 'Quantity', priceColumnLabel, 'Discount', 'Tax', 'Amount', 'Actions'].map((label, index) => (
              <th key={label} style={tableHeadStyle(index >= 4 && index <= 8)}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                Add items using the entry row above.
              </td>
            </tr>
          ) : lines.map((line, index) => (
            <tr key={line.id}>
              <td style={tableCellStyle()}><strong>{index + 1}</strong></td>
              <td style={tableCellStyle()}>{line.itemCode}</td>
              <td style={tableCellStyle()}>{line.itemName}</td>
              <td style={tableCellStyle()}>{line.uomName}</td>
              <td style={tableCellStyle(true)}>{formatNumber(Number(line.quantity), generalSettings)}</td>
              <td style={tableCellStyle(true)}>{money(Number(line.purchasePrice))}</td>
              <td style={tableCellStyle(true)}>{money(Number(line.discountAmount))}</td>
              <td style={tableCellStyle(true)}>{money(Number(line.taxAmount))}</td>
              <td style={tableCellStyle(true)}><strong>{money(line.lineTotal)}</strong></td>
              <td style={tableCellStyle()}>
                <div style={lineActionGroupStyle}>
                  <button type="button" className="btn-ghost" onClick={() => onMoveLine(line.id, -1)} disabled={index === 0} title="Move Line Up" style={lineActionButtonStyle}>
                    <IconArrowUp size={14} />
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onMoveLine(line.id, 1)} disabled={index === lines.length - 1} title="Move Line Down" style={lineActionButtonStyle}>
                    <IconArrowDown size={14} />
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onEditLine(line)} title="Edit Line" style={lineActionButtonStyle}>
                    <IconPencil size={14} />
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onRemoveLine(line.id)} title="Remove Line" style={{ ...lineActionButtonStyle, color: 'var(--color-danger)' }}>
                    <IconTrash size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
