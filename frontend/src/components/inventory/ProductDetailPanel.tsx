'use client';

import { useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArchive, IconPencil, IconX } from '@tabler/icons-react';
import { formatMoney } from '@/lib/app-settings';
import { productsQueryKey, useArchiveProduct, useProductDetail } from '@/lib/api/products';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { fmtDate, fmtQty, StatusBadge, StockIndicator, TypeBadge } from './ProductShared';

const figureStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 500 };
const sectionTitleStyle: CSSProperties = { margin: 0 };
const mutedStyle: CSSProperties = { color: 'var(--color-text-muted)' };

function DetailRow({ label, value, figure = false }: { label: string; value?: string | null; figure?: boolean }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd style={value ? (figure ? figureStyle : undefined) : mutedStyle}>{value || 'Not Set'}</dd>
    </div>
  );
}

export function ProductDetailPanel({ id, onClose, onEdit }: {
  id: string; onClose: () => void; onEdit: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const { data: p, isLoading, error: loadError, refetch } = useProductDetail(id);
  const { data: generalSettings } = useGeneralSettings();
  const archiveMut = useArchiveProduct();

  const header = (title: string) => (
    <div className="panel-header">
      <h2 className="panel-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
      <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Product Detail" title="Close Product Detail" />
    </div>
  );

  if (isLoading) return (
    <>
      {header('Product Detail')}
      <div className="panel-body"><p className="form-hint" style={{ margin: 0 }} role="status">Loading Product…</p></div>
    </>
  );
  if (loadError) return (
    <>
      {header('Product Detail')}
      <div className="panel-body" style={{ display: 'grid', gap: 8 }}>
        <InlineAlert tone="danger">{friendlyErrorMessage(loadError, 'Could not load this Product. Please try again.')}</InlineAlert>
        <div><Button onClick={() => refetch()}>Try Again</Button></div>
      </div>
    </>
  );
  if (!p) return null;

  const margin     = parseFloat(p.sale_price) > 0
    ? (((parseFloat(p.sale_price) - parseFloat(p.cost_price)) / parseFloat(p.sale_price)) * 100).toFixed(1)
    : null;
  const tags = p.tags ? String(p.tags).split(',').map((t: string) => t.trim()).filter(Boolean) as string[] : [];

  function archive() {
    setArchiveError('');
    archiveMut.mutate({ id: p.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: productsQueryKey });
        onClose();
      },
      onError: (error: Error) => setArchiveError(friendlyErrorMessage(error, 'Could not archive this Product. Please try again.')),
    });
    setShowArchiveConfirm(false);
  }

  return (
    <>
      {header(p.name)}

      <div className="panel-body">
        {archiveError && <InlineAlert tone="danger" onDismiss={() => setArchiveError('')}>{archiveError}</InlineAlert>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <StatusBadge status={p.status} />
          <TypeBadge type={p.product_type} />
        </div>

        <dl className="detail-list" style={{ margin: 0 }}>
          <DetailRow label="SKU" value={p.sku} />
          <DetailRow label="Brand" value={p.brand ? `${p.brand}${p.model ? ` · ${p.model}` : ''}` : null} />
          <DetailRow label="Category" value={p.category ? `${p.category.code} — ${p.category.name}` : null} />
          <DetailRow label="Unit" value={p.uom ? `${p.uom.abbreviation} (${p.uom.name})` : null} />
          <DetailRow label="Barcode" value={p.barcode} />
          <DetailRow label="Tax" value={`${p.tax_category} · ${p.tax_rate}%`} />
        </dl>

        <h3 className="form-section-title" style={sectionTitleStyle}>Prices</h3>
        <dl className="detail-list" style={{ margin: 0 }}>
          <DetailRow label="Cost Price" value={formatMoney(p.cost_price, generalSettings)} figure />
          <DetailRow label="Sale Price" value={formatMoney(p.sale_price, generalSettings)} figure />
          <div className="detail-row">
            <dt>Margin</dt>
            <dd style={margin ? { ...figureStyle, color: parseFloat(margin) >= 20 ? undefined : 'var(--color-warning-text)' } : mutedStyle}>
              {margin ? `${margin}%` : 'Not Set'}
            </dd>
          </div>
        </dl>

        <h3 className="form-section-title" style={sectionTitleStyle}>Stock</h3>
        <dl className="detail-list" style={{ margin: 0 }}>
          <div className="detail-row">
            <dt>On Hand</dt>
            <dd style={figureStyle}>
              <StockIndicator onHand={p.qty_on_hand} minLevel={p.min_stock_level} reorderLevel={p.reorder_level} settings={generalSettings} />
            </dd>
          </div>
          <DetailRow label="Reserved" value={fmtQty(p.qty_reserved, generalSettings)} figure />
          <DetailRow label="Available" value={fmtQty((parseFloat(p.qty_on_hand) || 0) - (parseFloat(p.qty_reserved) || 0), generalSettings)} figure />
          <DetailRow label="Minimum Level" value={p.min_stock_level ? fmtQty(p.min_stock_level, generalSettings) : null} figure />
          <DetailRow label="Reorder Quantity" value={p.reorder_qty ? fmtQty(p.reorder_qty, generalSettings) : null} figure />
        </dl>

        <h3 className="form-section-title" style={sectionTitleStyle}>Record</h3>
        <dl className="detail-list" style={{ margin: 0 }}>
          <DetailRow label="Created" value={fmtDate(p.created_at, generalSettings)} />
          <DetailRow label="Updated" value={fmtDate(p.updated_at, generalSettings)} />
          {p.description && <DetailRow label="Description" value={p.description} />}
          {p.notes && <DetailRow label="Notes" value={p.notes} />}
          {tags.length > 0 && (
            <div className="detail-row">
              <dt>Tags</dt>
              <dd style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {tags.map(tag => <Badge key={tag} variant="neutral">{tag}</Badge>)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="panel-footer">
        {p.status !== 'Discontinued' && (
          <Button variant="danger" icon={<IconArchive size={16} stroke={1.8} />} onClick={() => setShowArchiveConfirm(true)} loading={archiveMut.isPending}>
            Archive
          </Button>
        )}
        <Button variant="primary" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => onEdit(p.id)}>Edit Product</Button>
      </div>

      <ConfirmDialog
        open={showArchiveConfirm}
        variant="danger"
        title="Archive Product?"
        message={`"${p.name}" will be marked Discontinued and hidden from new work. It stays in past records. To use it again, edit it and set Status to Active.`}
        confirmLabel="Archive"
        loading={archiveMut.isPending}
        onConfirm={archive}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </>
  );
}
