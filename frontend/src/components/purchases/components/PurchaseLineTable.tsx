'use client';

import { IconArrowDown, IconArrowUp, IconPencil, IconTrash } from '@tabler/icons-react';
import { formatNumber } from '@/lib/app-settings';
import { Button } from '@/components/ui/Button';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { LinesTable } from '@/components/documents';
import type { PurchaseLine } from '../PurchaseVoucherTypes';

interface PurchaseLineTableProps {
  priceColumnLabel?: string;
  lines: PurchaseLine[];
  generalSettings: any;
  money: (value: number) => string;
  onMoveLine: (id: number, direction: -1 | 1) => void;
  onEditLine: (line: PurchaseLine) => void;
  onRemoveLine: (id: number) => void;
  editingLineId?: number | null;
}

const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;

export function PurchaseLineTable({
  priceColumnLabel = 'Purchase Price',
  lines,
  generalSettings,
  money,
  onMoveLine,
  onEditLine,
  onRemoveLine,
  editingLineId = null,
}: PurchaseLineTableProps) {
  return (
    <LinesTable>
      <colgroup>
        <col style={{ width: 52 }} />
        <col />
        <col style={{ width: 72 }} />
        <col style={{ width: 96 }} />
        <col style={{ width: 112 }} />
        <col style={{ width: 100 }} />
        <col style={{ width: 100 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 132 }} />
      </colgroup>
      <thead>
        <tr>
          <th className="num">No.</th>
          <th>Item</th>
          <th>Unit</th>
          <th className="num">Quantity</th>
          <th className="num">{priceColumnLabel}</th>
          <th className="num">Discount</th>
          <th className="num">Tax</th>
          <th className="num">Amount</th>
          <th><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 ? (
          <TableMessageRow colSpan={9} title="No Items Added" description="Choose an Item and Quantity above, then press Enter or select Add." />
        ) : lines.map((line, index) => (
          <tr key={line.id} className={editingLineId === line.id ? 'is-selected' : undefined}>
            <td className="num cell-muted">{index + 1}</td>
            <td className="cell-strong" title={`${line.itemCode} - ${line.itemName}`}>{line.itemCode} - {line.itemName}</td>
            <td className={line.uomName ? undefined : 'cell-muted'}>{line.uomName || 'Not Set'}</td>
            <td className="num">{formatNumber(Number(line.quantity), generalSettings)}</td>
            <td className="num">{money(Number(line.purchasePrice))}</td>
            <td className="num">{money(Number(line.discountAmount))}</td>
            <td className="num">{money(Number(line.taxAmount))}</td>
            <td className="num cell-strong">{money(line.lineTotal)}</td>
            <td className="cell-actions">
              <span className="row-actions">
                <Button variant="ghost" size="sm" icon={<IconArrowUp {...iconProps} />} onClick={() => onMoveLine(line.id, -1)} disabled={index === 0} aria-label={`Move Line ${index + 1} Up`} title="Move Line Up" />
                <Button variant="ghost" size="sm" icon={<IconArrowDown {...iconProps} />} onClick={() => onMoveLine(line.id, 1)} disabled={index === lines.length - 1} aria-label={`Move Line ${index + 1} Down`} title="Move Line Down" />
                <Button variant="ghost" size="sm" icon={<IconPencil {...iconProps} />} onClick={() => onEditLine(line)} aria-label={`Edit Line ${index + 1}`} title="Edit Line" />
                <Button variant="ghost" size="sm" icon={<IconTrash {...iconProps} />} onClick={() => onRemoveLine(line.id)} aria-label={`Remove Line ${index + 1}`} title="Remove Line" />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </LinesTable>
  );
}
