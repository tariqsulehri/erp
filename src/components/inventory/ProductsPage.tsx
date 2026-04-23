'use client';

/**
 * ProductsPage — full professional inventory products CRUD.
 *
 * 3-mode layout (same pattern as VoucherEntryPage):
 *   LIST   → full-width dense table, all filters/sorts
 *   FORM   → full work-area create/edit form, tabbed
 *   DETAIL → 58/42 split: table left, product card right
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── constants ──────────────────────────────────────────────────── */
const PRODUCT_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  Finished:     { label: 'Finished Good',   color: '#1d4ed8', bg: '#dbeafe' },
  RawMaterial:  { label: 'Raw Material',    color: '#059669', bg: '#d1fae5' },
  SemiFinished: { label: 'Semi-Finished',   color: '#7c3aed', bg: '#ede9fe' },
  Service:      { label: 'Service',         color: '#0891b2', bg: '#cffafe' },
  Consumable:   { label: 'Consumable',      color: '#d97706', bg: '#fef3c7' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Active:       { label: 'Active',       color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  Inactive:     { label: 'Inactive',     color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  Discontinued: { label: 'Discontinued', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
};

const TAX_CATS   = ['Standard', 'Zero-Rated', 'Exempt'] as const;
const PROD_TYPES = ['Finished', 'RawMaterial', 'SemiFinished', 'Service', 'Consumable'] as const;
const STATUSES   = ['Active', 'Inactive', 'Discontinued'] as const;
const TABS       = ['Basic', 'Pricing & Tax', 'Stock Control', 'Physical & Notes'] as const;

type TabLabel = typeof TABS[number];
type PageMode = 'list' | 'form' | 'detail';

/* ── helpers ────────────────────────────────────────────────────── */
const fmtAmt = (n: string | number | undefined) => {
  const v = Number(n ?? 0);
  return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtQty = (n: string | number | undefined) => {
  const v = Number(n ?? 0);
  return v % 1 === 0 ? v.toLocaleString() : v.toLocaleString('en-PK', { maximumFractionDigits: 3 });
};
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

/* ── shared mini components ─────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Active;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const m = PRODUCT_TYPE_META[type] ?? PRODUCT_TYPE_META.Finished;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function StockIndicator({ onHand, minLevel }: { onHand: string; minLevel?: string }) {
  const qty = parseFloat(onHand) || 0;
  const min = minLevel ? parseFloat(minLevel) : null;
  const isLow = min !== null && qty < min;
  const isOut = qty <= 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem',
        color: isOut ? 'var(--color-danger)' : isLow ? 'var(--color-warning)' : 'var(--color-text)',
      }}>
        {fmtQty(qty)}
      </span>
      {isOut && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#fff', background: 'var(--color-danger)', padding: '1px 5px', borderRadius: 3 }}>OUT</span>}
      {!isOut && isLow && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: 3, border: '1px solid #fcd34d' }}>LOW</span>}
    </div>
  );
}

function LabelInput({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700,
        color: 'var(--color-text-secondary)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUCT FORM — full work area (create + edit)
   ═══════════════════════════════════════════════════════════════════ */
function ProductForm({ editId, onSaved, onCancel }: {
  editId?: string; onSaved: (id: string) => void; onCancel: () => void;
}) {
  const utils      = trpc.useUtils();
  const isEdit     = !!editId;
  const [tab, setTab] = useState<TabLabel>('Basic');
  const [error, setError] = useState('');

  /* ── Form state ── */
  const [sku,          setSku]          = useState('');
  const [skuLoading,   setSkuLoading]   = useState(false);
  const [barcode,      setBarcode]      = useState('');
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [brand,        setBrand]        = useState('');
  const [model,        setModel]        = useState('');
  const [categoryId,   setCategoryId]   = useState('');
  const [uomId,        setUomId]        = useState('');
  const [productType,  setProductType]  = useState('Finished');
  const [status,       setStatus]       = useState('Active');
  const [isSellable,   setIsSellable]   = useState(true);
  const [isPurchasable,setIsPurchasable]= useState(true);
  const [costPrice,    setCostPrice]    = useState('');
  const [salePrice,    setSalePrice]    = useState('');
  const [minSalePrice, setMinSalePrice] = useState('');
  const [taxCategory,  setTaxCategory]  = useState('Standard');
  const [taxRate,      setTaxRate]      = useState('0');
  const [qtyOnHand,    setQtyOnHand]    = useState('0');
  const [minStock,     setMinStock]     = useState('');
  const [maxStock,     setMaxStock]     = useState('');
  const [reorderQty,   setReorderQty]   = useState('');
  const [trackInv,     setTrackInv]     = useState(true);
  const [weight,       setWeight]       = useState('');
  const [weightUnit,   setWeightUnit]   = useState('kg');
  const [lengthCm,     setLengthCm]     = useState('');
  const [widthCm,      setWidthCm]      = useState('');
  const [heightCm,     setHeightCm]     = useState('');
  const [imageUrl,     setImageUrl]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [tags,         setTags]         = useState('');

  /* ── Reference data ── */
  const { data: rawCategories } = trpc.products.listCategories.useQuery();
  const { data: uoms }          = trpc.products.listUom.useQuery();

  /* Build indented category options for selectors */
  const categoryOptions = useMemo(() => {
    if (!rawCategories) return [];
    interface CatNode { id: string; code: string; name: string; parent_id: string | null; children: CatNode[] }
    const all = rawCategories as Array<{ id: string; code: string; name: string; parent_id?: string | null }>;
    const map = new Map<string, CatNode>();
    all.forEach(c => map.set(c.id, { ...c, parent_id: c.parent_id ?? null, children: [] }));
    const roots: CatNode[] = [];
    map.forEach(node => {
      if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id)!.children.push(node);
      else roots.push(node);
    });
    roots.sort((a, b) => a.name.localeCompare(b.name));
    function flatten(nodes: CatNode[], depth: number): Array<{ id: string; label: string }> {
      return nodes.flatMap(n => [
        { id: n.id, label: '\u00a0\u00a0'.repeat(depth * 2) + (depth > 0 ? '└─\u00a0' : '') + n.code + ' — ' + n.name },
        ...flatten(n.children, depth + 1),
      ]);
    }
    return flatten(roots, 0);
  }, [rawCategories]);

  /* Weight UOMs for the weight-unit selector */
  const weightUoms = useMemo(
    () => (uoms as Array<{ id: string; abbreviation: string; name: string; uom_type: string }> ?? [])
      .filter(u => u.uom_type === 'Weight'),
    [uoms],
  );

  /* ── Load for edit ── */
  const { data: existing } = trpc.products.getById.useQuery(
    { id: editId! }, { enabled: isEdit }
  );

  useEffect(() => {
    if (!existing) return;
    setSku(existing.sku);
    setBarcode(existing.barcode ?? '');
    setName(existing.name);
    setDescription(existing.description ?? '');
    setBrand(existing.brand ?? '');
    setModel(existing.model ?? '');
    setCategoryId(existing.category_id ?? '');
    setUomId(existing.uom_id ?? '');
    setProductType(existing.product_type);
    setStatus(existing.status);
    setIsSellable(existing.is_sellable);
    setIsPurchasable(existing.is_purchasable);
    setCostPrice(existing.cost_price ?? '0');
    setSalePrice(existing.sale_price ?? '0');
    setMinSalePrice(existing.min_sale_price ?? '');
    setTaxCategory(existing.tax_category);
    setTaxRate(existing.tax_rate ?? '0');
    setQtyOnHand(existing.qty_on_hand ?? '0');
    setMinStock(existing.min_stock_level ?? '');
    setMaxStock(existing.max_stock_level ?? '');
    setReorderQty(existing.reorder_qty ?? '');
    setTrackInv(existing.track_inventory);
    setWeight(existing.weight ?? '');
    setWeightUnit(existing.weight_unit ?? 'kg');
    setLengthCm(existing.length_cm ?? '');
    setWidthCm(existing.width_cm ?? '');
    setHeightCm(existing.height_cm ?? '');
    setImageUrl(existing.image_url ?? '');
    setNotes(existing.notes ?? '');
    setTags(existing.tags ?? '');
  }, [existing]);

  /* Auto-suggest SKU on create */
  const suggestMut = trpc.products.suggestSku.useQuery({ prefix: 'PRD' }, { enabled: !isEdit });
  useEffect(() => {
    if (!isEdit && suggestMut.data?.sku && !sku) setSku(suggestMut.data.sku);
  }, [suggestMut.data, isEdit, sku]);

  /* Computed */
  const margin = () => {
    const c = parseFloat(costPrice) || 0;
    const s = parseFloat(salePrice) || 0;
    if (s <= 0) return null;   // avoid division by zero; cost can be 0
    return (((s - c) / s) * 100).toFixed(1);
  };

  /* Mutations */
  const createMut = trpc.products.create.useMutation({
    onSuccess: p => { utils.products.list.invalidate(); onSaved(p.id); },
    onError:   e => { setError(e.message); },
  });
  const updateMut = trpc.products.update.useMutation({
    onSuccess: p => { utils.products.list.invalidate(); onSaved(p.id); },
    onError:   e => { setError(e.message); },
  });

  function save() {
    setError('');
    if (!sku.trim())  { setError('SKU is required.'); setTab('Basic'); return; }
    if (!name.trim()) { setError('Product name is required.'); setTab('Basic'); return; }

    const payload = {
      sku: sku.trim().toUpperCase(),
      barcode:      barcode     || undefined,
      name:         name.trim(),
      description:  description || undefined,
      brand:        brand       || undefined,
      model:        model       || undefined,
      category_id:  categoryId  || undefined,
      uom_id:       uomId       || undefined,
      product_type: productType as any,
      status:       status      as any,
      is_sellable:  isSellable,
      is_purchasable: isPurchasable,
      cost_price:     parseFloat(costPrice)    || 0,
      sale_price:     parseFloat(salePrice)    || 0,
      min_sale_price: parseFloat(minSalePrice) || undefined,
      tax_category:   taxCategory as any,
      tax_rate:       parseFloat(taxRate)      || 0,
      qty_on_hand:    parseFloat(qtyOnHand)    || 0,
      min_stock_level:parseFloat(minStock)     || undefined,
      max_stock_level:parseFloat(maxStock)     || undefined,
      reorder_qty:    parseFloat(reorderQty)   || undefined,
      track_inventory: trackInv,
      weight:         parseFloat(weight)       || undefined,
      weight_unit:    weightUnit               || undefined,
      length_cm:      parseFloat(lengthCm)     || undefined,
      width_cm:       parseFloat(widthCm)      || undefined,
      height_cm:      parseFloat(heightCm)     || undefined,
      image_url:      imageUrl || undefined,
      notes:          notes    || undefined,
      tags:           tags     || undefined,
    };

    if (isEdit) {
      updateMut.mutate({ id: editId!, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const typeMeta  = PRODUCT_TYPE_META[productType] ?? PRODUCT_TYPE_META.Finished;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height))', background: 'var(--color-bg)' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px',
        height: 52, background: '#1e3a5f',
        borderBottom: '2px solid #0f2044', flexShrink: 0,
      }}>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 'var(--radius)', color: '#fff', fontWeight: 700,
          fontSize: '0.8rem', padding: '4px 12px', cursor: 'pointer',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Products
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8ba3c7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>INVENTORY</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>›</span>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Products</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>›</span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'rgba(255,255,255,0.80)' }}>
            {isEdit ? `Edit: ${existing?.name ?? '…'}` : 'New Product'}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status selector in header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.60)', fontWeight: 600 }}>Status:</span>
          <select value={status} onChange={e => setStatus(e.target.value)}
            style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', height: 30,
              borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer',
            }}>
            {STATUSES.map(s => <option key={s} value={s} style={{ background: '#1e3a5f' }}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--color-surface)',
        borderBottom: '2px solid var(--color-border)',
        padding: '0 24px',
        gap: 0, flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer',
            background: 'transparent', fontWeight: tab === t ? 700 : 500,
            fontSize: '0.8125rem',
            color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
            borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: -2, transition: 'all var(--transition)',
            whiteSpace: 'nowrap',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ─────── TAB: BASIC ─────── */}
        {tab === 'Basic' && (
          <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Row 1: SKU, Barcode, Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 200px 1fr', gap: 16 }}>
              <LabelInput label="SKU" required>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input className="form-input" value={sku} onChange={e => setSku(e.target.value.toUpperCase())}
                    placeholder="PRD-0001" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
                </div>
              </LabelInput>
              <LabelInput label="Barcode / EAN">
                <input className="form-input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="e.g. 8901234567890" />
              </LabelInput>
              <LabelInput label="Product Name" required>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full product name…" />
              </LabelInput>
            </div>

            {/* Row 2: Brand, Model, Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <LabelInput label="Brand">
                <input className="form-input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Samsung" />
              </LabelInput>
              <LabelInput label="Model / Part No.">
                <input className="form-input" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. SM-G998B" />
              </LabelInput>
              <LabelInput label="Category">
                <select className="form-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">— Select Category —</option>
                  {categoryOptions.map(opt => (
                    <option key={opt.id} value={opt.id}
                      style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </LabelInput>
            </div>

            {/* Row 3: Type, UOM, flags */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 16, alignItems: 'end' }}>
              <LabelInput label="Product Type" required>
                <select className="form-select" value={productType} onChange={e => setProductType(e.target.value)}>
                  {PROD_TYPES.map(t => <option key={t} value={t}>{PRODUCT_TYPE_META[t].label}</option>)}
                </select>
              </LabelInput>
              <LabelInput label="Unit of Measure">
                <select className="form-select" value={uomId} onChange={e => setUomId(e.target.value)}>
                  <option value="">— Select UOM —</option>
                  {(uoms ?? []).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.abbreviation} — {u.name}</option>
                  ))}
                </select>
              </LabelInput>
              <LabelInput label="Sellable">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                  <input type="checkbox" checked={isSellable} onChange={e => setIsSellable(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Sellable</span>
                </div>
              </LabelInput>
              <LabelInput label="Purchasable">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
                  <input type="checkbox" checked={isPurchasable} onChange={e => setIsPurchasable(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Purchasable</span>
                </div>
              </LabelInput>
            </div>

            {/* Description */}
            <LabelInput label="Description">
              <textarea className="form-input" rows={3} value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detailed description of the product…"
                style={{ resize: 'vertical', lineHeight: 1.6 }} />
            </LabelInput>

            {/* Image URL */}
            <LabelInput label="Product Image URL">
              <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="https://example.com/images/product.jpg" />
            </LabelInput>
          </div>
        )}

        {/* ─────── TAB: PRICING & TAX ─────── */}
        {tab === 'Pricing & Tax' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Pricing section */}
            <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', background: 'var(--color-table-head-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pricing</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <LabelInput label="Cost Price (Purchase)">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>₨</span>
                    <input className="form-input" value={costPrice} onChange={e => setCostPrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                  </div>
                </LabelInput>
                <LabelInput label="Sale Price">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>₨</span>
                    <input className="form-input" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                  </div>
                </LabelInput>
                <LabelInput label="Min Sale Price (Floor)">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>₨</span>
                    <input className="form-input" value={minSalePrice} onChange={e => setMinSalePrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                  </div>
                </LabelInput>
              </div>

              {/* Margin indicator */}
              {margin() && (
                <div style={{ margin: '0 18px 18px', padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--color-primary-light)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    {[
                      { label: 'Cost',   value: `₨ ${fmtAmt(costPrice)}`, color: 'var(--color-text-secondary)' },
                      { label: 'Sale',   value: `₨ ${fmtAmt(salePrice)}`, color: 'var(--color-debit)' },
                      { label: 'Profit', value: `₨ ${fmtAmt((parseFloat(salePrice)||0) - (parseFloat(costPrice)||0))}`, color: 'var(--color-credit)' },
                      { label: 'Margin', value: `${margin()}%`, color: parseFloat(margin()!) >= 20 ? 'var(--color-credit)' : 'var(--color-warning)' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9375rem', color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tax section */}
            <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', background: 'var(--color-table-head-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tax</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <LabelInput label="Tax Category">
                  <select className="form-select" value={taxCategory} onChange={e => setTaxCategory(e.target.value)}>
                    {TAX_CATS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </LabelInput>
                <LabelInput label="Tax Rate (%)">
                  <input className="form-input" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                    placeholder="e.g. 17" style={{ fontFamily: 'var(--font-mono)' }}
                    disabled={taxCategory !== 'Standard'} />
                </LabelInput>
              </div>
            </div>
          </div>
        )}

        {/* ─────── TAB: STOCK CONTROL ─────── */}
        {tab === 'Stock Control' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--color-info-bg)', borderRadius: 'var(--radius)', border: '1.5px solid var(--color-info-border)' }}>
              <input type="checkbox" checked={trackInv} onChange={e => setTrackInv(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-info-text)' }}>
                Track inventory for this product
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                (disable for services or non-stocked items)
              </span>
            </div>

            <div style={{ opacity: trackInv ? 1 : 0.4, pointerEvents: trackInv ? 'auto' : 'none' }}>
              <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 18px', background: 'var(--color-table-head-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Stock Levels</span>
                </div>
                <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Opening Stock (Qty)', value: qtyOnHand, set: setQtyOnHand, hint: 'Current on-hand qty' },
                    { label: 'Min Level (Reorder Pt.)', value: minStock, set: setMinStock, hint: 'Trigger reorder below this' },
                    { label: 'Max Level', value: maxStock, set: setMaxStock, hint: 'Maximum stock to hold' },
                    { label: 'Reorder Qty', value: reorderQty, set: setReorderQty, hint: 'Qty to order each time' },
                  ].map(f => (
                    <LabelInput key={f.label} label={f.label}>
                      <input className="form-input" value={f.value} onChange={e => f.set(e.target.value)}
                        placeholder="0" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                      <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 3 }}>{f.hint}</p>
                    </LabelInput>
                  ))}
                </div>
              </div>

              {/* Stock status preview */}
              {parseFloat(qtyOnHand) >= 0 && (parseFloat(minStock) || parseFloat(maxStock)) ? (
                <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Stock Preview</p>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>On Hand</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)' }}>{fmtQty(qtyOnHand)}</div></div>
                    {minStock && <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Reorder At</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-warning)' }}>{fmtQty(minStock)}</div></div>}
                    {maxStock && <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Max</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)' }}>{fmtQty(maxStock)}</div></div>}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* ─────── TAB: PHYSICAL & NOTES ─────── */}
        {tab === 'Physical & Notes' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Dimensions */}
            <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', background: 'var(--color-table-head-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Physical Dimensions</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 120px 1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
                <LabelInput label="Weight">
                  <input className="form-input" value={weight} onChange={e => setWeight(e.target.value)}
                    placeholder="0.000" style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                </LabelInput>
                <LabelInput label="Unit">
                  <select className="form-select" value={weightUnit} onChange={e => setWeightUnit(e.target.value)}>
                    {weightUoms.length > 0
                      ? weightUoms.map(u => <option key={u.id} value={u.abbreviation}>{u.abbreviation} — {u.name}</option>)
                      : ['kg','g','lb','oz','t'].map(u => <option key={u} value={u}>{u}</option>)
                    }
                  </select>
                </LabelInput>
                {[
                  { label: 'Length (cm)', value: lengthCm, set: setLengthCm },
                  { label: 'Width (cm)',  value: widthCm,  set: setWidthCm  },
                  { label: 'Height (cm)', value: heightCm, set: setHeightCm },
                ].map(f => (
                  <LabelInput key={f.label} label={f.label}>
                    <input className="form-input" value={f.value} onChange={e => f.set(e.target.value)}
                      placeholder="0.00" style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                  </LabelInput>
                ))}
              </div>
            </div>

            {/* Tags & Notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              <LabelInput label="Tags (comma-separated)">
                <input className="form-input" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="e.g. electronics, mobile, imported" />
              </LabelInput>
              <div /> {/* spacer */}
            </div>
            <LabelInput label="Internal Notes">
              <textarea className="form-input" rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes visible to staff only…" style={{ resize: 'vertical' }} />
            </LabelInput>
          </div>
        )}
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div style={{ padding: '8px 24px', flexShrink: 0, background: 'var(--color-danger-bg)', borderTop: '1.5px solid var(--color-danger-border)' }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-danger-text)', fontWeight: 600 }}>⚠ {error}</p>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 24px',
        background: 'var(--color-panel-footer-bg)', borderTop: '1.5px solid var(--color-panel-footer-border)',
        flexShrink: 0,
      }}>
        <button className="btn btn-primary" disabled={isPending} onClick={save}
          style={{ minWidth: 150 }}>
          {isPending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />{isEdit ? 'Saving…' : 'Creating…'}</>
            : <>{isEdit
                ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v13a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Changes</>
                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg> Create Product</>
              }</>}
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <div style={{ flex: 1 }} />
        {TABS.filter(t => t !== tab).map(t => (
          <button key={t} className="btn btn-ghost btn-sm" onClick={() => setTab(t)}
            style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {t} →
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DETAIL PANEL — right slide-in
   ═══════════════════════════════════════════════════════════════════ */
function DetailPanel({ id, onClose, onEdit }: {
  id: string; onClose: () => void; onEdit: (id: string) => void;
}) {
  const utils = trpc.useUtils();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const { data: p, isLoading } = trpc.products.getById.useQuery({ id });
  const archiveMut = trpc.products.archive.useMutation({
    onSuccess: () => { utils.products.list.invalidate(); onClose(); },
  });

  if (isLoading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading…
    </div>
  );
  if (!p) return null;

  const typeMeta   = PRODUCT_TYPE_META[p.product_type] ?? PRODUCT_TYPE_META.Finished;
  const margin     = parseFloat(p.sale_price) > 0
    ? (((parseFloat(p.sale_price) - parseFloat(p.cost_price)) / parseFloat(p.sale_price)) * 100).toFixed(1)
    : null;
  const isLowStock = p.min_stock_level && parseFloat(p.qty_on_hand) < parseFloat(p.min_stock_level);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '3px solid var(--color-primary)' }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px', background: 'var(--color-table-head-bg)',
        borderBottom: '2px solid var(--color-panel-header-border)',
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.875rem', color: '#e2eaf8', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 4 }}>{p.sku}</span>
            <StatusBadge status={p.status} />
            <TypeBadge   type={p.product_type} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff', margin: '0 0 2px', lineHeight: 1.3 }}>{p.name}</p>
          {p.brand && <p style={{ fontSize: '0.75rem', color: '#8ba3c7', margin: 0 }}>{p.brand}{p.model ? ` · ${p.model}` : ''}</p>}
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 8px', color: '#fff', flexShrink: 0, marginLeft: 8 }}>×</button>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* KPI row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0, borderBottom: '1.5px solid var(--color-border)',
        }}>
          {[
            { label: 'Cost Price',  value: `₨ ${fmtAmt(p.cost_price)}`,  color: 'var(--color-text)' },
            { label: 'Sale Price',  value: `₨ ${fmtAmt(p.sale_price)}`,  color: 'var(--color-debit)' },
            { label: 'Margin',      value: margin ? `${margin}%` : '—',   color: margin && parseFloat(margin) >= 20 ? 'var(--color-credit)' : 'var(--color-warning)' },
          ].map((k, i) => (
            <div key={k.label} style={{
              padding: '12px 14px',
              borderRight: i < 2 ? '1px solid var(--color-border)' : 'none',
              background: 'var(--color-table-row-even)',
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Stock row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0, borderBottom: '1.5px solid var(--color-border)',
        }}>
          {[
            { label: 'On Hand',   value: fmtQty(p.qty_on_hand),     color: isLowStock ? 'var(--color-warning)' : 'var(--color-text)' },
            { label: 'Reserved',  value: fmtQty(p.qty_reserved),    color: 'var(--color-text-muted)' },
            { label: 'Available', value: fmtQty((parseFloat(p.qty_on_hand)||0) - (parseFloat(p.qty_reserved)||0)), color: 'var(--color-text)' },
          ].map((k, i) => (
            <div key={k.label} style={{ padding: '10px 14px', borderRight: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Details rows */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Category',   value: p.category ? `${p.category.code} — ${p.category.name}` : '—' },
            { label: 'UOM',        value: p.uom       ? `${p.uom.abbreviation} (${p.uom.name})` : '—' },
            { label: 'Barcode',    value: p.barcode   ?? '—' },
            { label: 'Tax',        value: `${p.tax_category} · ${p.tax_rate}%` },
            { label: 'Min Level',  value: p.min_stock_level ? fmtQty(p.min_stock_level) : '—' },
            { label: 'Reorder Qty',value: p.reorder_qty     ? fmtQty(p.reorder_qty)     : '—' },
            { label: 'Created',    value: fmtDate(p.created_at) },
            { label: 'Updated',    value: fmtDate(p.updated_at) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', minWidth: 100, flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}

          {/* Description / Notes */}
          {p.description && (
            <div style={{ paddingTop: 4 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Description</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{p.description}</p>
            </div>
          )}
          {p.notes && (
            <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--color-table-row-even)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Notes</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>{p.notes}</p>
            </div>
          )}
          {p.tags && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              {p.tags.split(',').filter(t => t.trim()).map(tag => (
                <span key={tag} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)' }}>
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px', borderTop: '1.5px solid var(--color-panel-footer-border)',
        background: 'var(--color-panel-footer-bg)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <button className="btn btn-primary btn-sm" onClick={() => onEdit(p.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Product
        </button>
        {p.status !== 'Discontinued' && (
          <button className="btn btn-sm"
            style={{ marginLeft: 'auto', background: 'var(--color-danger-bg)', border: '1.5px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}
            onClick={() => setShowArchiveConfirm(true)}
          >Archive</button>
        )}
      </div>

      {/* Archive confirm modal */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '28px 32px', width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Archive Product?</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{p.name}</p>
            <p style={{ margin: '0 0 24px', fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              This product will be marked <strong>Discontinued</strong> and hidden from active use. It will remain in historical records. You can reactivate it later by editing the status.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowArchiveConfirm(false)} style={{ minWidth: 80 }}>Cancel</button>
              <button
                disabled={archiveMut.isPending}
                onClick={() => { archiveMut.mutate({ id: p.id }); setShowArchiveConfirm(false); }}
                style={{ padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', background: '#d97706', color: '#fff', minWidth: 100 }}>
                {archiveMut.isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS LIST — full-width dense table
   ═══════════════════════════════════════════════════════════════════ */
function ProductList({ selectedId, onSelect, onNew, onEdit, detailOpen }: {
  selectedId: string | null; onSelect: (id: string) => void;
  onNew: () => void; onEdit: (id: string) => void; detailOpen: boolean;
}) {
  const [search,   setSearch]   = useState('');
  const [catFlt,   setCatFlt]   = useState('');
  const [typeFlt,  setTypeFlt]  = useState('');
  const [statusFlt,setStatusFlt]= useState('Active');
  const [lowStock, setLowStock] = useState(false);
  const [sortBy,   setSortBy]   = useState('name');
  const [sortDir,  setSortDir]  = useState<'ASC'|'DESC'>('ASC');
  const [page,     setPage]     = useState(1);
  const LIMIT = 60;

  const { data: categories } = trpc.products.listCategories.useQuery();
  const { data, isLoading }  = trpc.products.list.useQuery({
    page, limit: LIMIT,
    search:       search    || undefined,
    category_id:  catFlt    || undefined,
    product_type: typeFlt   as any || undefined,
    status:       statusFlt as any || undefined,
    low_stock:    lowStock  || undefined,
    sort_by:      sortBy    as any,
    sort_dir:     sortDir,
  }, { placeholderData: prev => prev });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortDir('ASC'); }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'ASC' ? ' ↑' : ' ↓') : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '8px 16px',
        background: 'var(--color-surface)',
        borderBottom: '1.5px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-heading)' }}>Products</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-border-subtle)', padding: '2px 8px', borderRadius: 10 }}>
          {total} item{total !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Filters */}
        <input className="form-input" placeholder="Search SKU, name, brand…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 10px', height: 32, width: 200 }}
        />
        <select className="form-select" value={catFlt} onChange={e => { setCatFlt(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 150 }}>
          <option value="">All Categories</option>
          {(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="form-select" value={typeFlt} onChange={e => { setTypeFlt(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 130 }}>
          <option value="">All Types</option>
          {PROD_TYPES.map(t => <option key={t} value={t}>{PRODUCT_TYPE_META[t].label}</option>)}
        </select>
        <select className="form-select" value={statusFlt} onChange={e => { setStatusFlt(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 110 }}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: lowStock ? 'var(--color-warning)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={lowStock} onChange={e => { setLowStock(e.target.checked); setPage(1); }}
            style={{ accentColor: 'var(--color-warning)', width: 14, height: 14 }} />
          Low Stock Only
        </label>

        <button className="btn btn-primary btn-sm" onClick={onNew} style={{ whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          New Product
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 38 }} />
            <col style={{ width: detailOpen ? 90  : 110  }} />
            <col style={{ width: detailOpen ? 200 : 280  }} />
            <col style={{ width: detailOpen ? 90  : 120  }} />
            <col style={{ width: detailOpen ? 90  : 110  }} />
            <col style={{ width: detailOpen ? 105 : 130  }} />
            <col style={{ width: detailOpen ? 105 : 130  }} />
            <col style={{ width: detailOpen ? 80  : 100  }} />
            <col style={{ width: 76 }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ background: 'var(--color-table-head-bg)', borderBottom: '2px solid var(--color-panel-header-border)' }}>
              {[
                { col: '',           label: '#',          sortable: false, align: 'left'   },
                { col: 'sku',        label: 'SKU',        sortable: true,  align: 'left'   },
                { col: 'name',       label: 'Product Name', sortable: true, align: 'left'  },
                { col: '',           label: 'Type',       sortable: false, align: 'left'   },
                { col: '',           label: 'Category',   sortable: false, align: 'left'   },
                { col: 'sale_price', label: 'Sale Price', sortable: true,  align: 'right'  },
                { col: 'qty_on_hand',label: 'Stock',      sortable: true,  align: 'right'  },
                { col: '',           label: 'Status',     sortable: false, align: 'center' },
                { col: '',           label: 'Actions',    sortable: false, align: 'center' },
              ].map(h => (
                <th key={h.label} onClick={() => h.sortable && toggleSort(h.col)}
                  style={{
                    padding: '7px 10px', textAlign: h.align as any,
                    fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.07em', color: 'var(--color-table-head-text)',
                    cursor: h.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}>
                  {h.label}{h.sortable ? sortIcon(h.col) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Loading products…
                </div>
              </td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, fontSize: '0.9375rem' }}>No products found</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>Click <strong>New Product</strong> to add your first item to inventory.</p>
                <button className="btn btn-primary btn-sm" onClick={onNew}>+ New Product</button>
              </td></tr>
            )}
            {rows.map((p: any, i: number) => {
              const active = selectedId === p.id;
              return (
                <tr key={p.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: active ? 'var(--color-table-row-selected)' : i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)',
                    cursor: 'pointer', transition: 'background var(--transition)',
                    outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-table-row-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)'; }}
                  onClick={() => onSelect(p.id)}
                >
                  <td style={TD}><span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{(page-1)*LIMIT + i+1}</span></td>
                  <td style={TD}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.775rem', color: 'var(--color-primary)' }}>{p.sku}</span>
                  </td>
                  <td style={{ ...TD, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      {(p.brand || p.barcode) && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {p.brand}{p.brand && p.barcode ? ' · ' : ''}{p.barcode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={TD}><TypeBadge type={p.product_type} /></td>
                  <td style={{ ...TD, color: 'var(--color-text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.category?.name ?? '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-debit)' }}>
                    {fmtAmt(p.sale_price)}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <StockIndicator onHand={p.qty_on_hand} minLevel={p.min_stock_level} />
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}><StatusBadge status={p.status} /></td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button className="btn btn-sm" style={{ padding: '2px 10px', fontSize: '0.7rem', background: 'var(--color-primary-light)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}
                      onClick={e => { e.stopPropagation(); onEdit(p.id); }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        padding: '6px 16px',
        background: 'var(--color-panel-footer-bg)',
        borderTop: '1.5px solid var(--color-panel-footer-border)',
        flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)',
      }}>
        <span>Page {page} of {pages} · {total} product{total !== 1 ? 's' : ''}</span>
        <button disabled={page === 1} onClick={() => setPage(p => p-1)} style={PG_BTN}>‹ Prev</button>
        <button disabled={page >= pages} onClick={() => setPage(p => p+1)} style={PG_BTN}>Next ›</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE ROOT
   ═══════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const [mode,       setMode]       = useState<PageMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId,     setEditId]     = useState<string | undefined>(undefined);

  function openNew()               { setEditId(undefined); setSelectedId(null); setMode('form'); }
  function openEdit(id: string)    { setEditId(id);        setSelectedId(null); setMode('form'); }
  function openDetail(id: string)  { setSelectedId(id);    setMode('detail'); }
  function backToList()            { setMode('list'); }
  function handleSaved(id: string) { setSelectedId(id); setMode('detail'); }

  return (
    <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* FORM MODE — full work area */}
      {mode === 'form' && (
        <ProductForm
          editId={editId}
          onSaved={handleSaved}
          onCancel={backToList}
        />
      )}

      {/* LIST + DETAIL modes */}
      {mode !== 'form' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            flex: mode === 'detail' ? '0 0 58%' : '1',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            borderRight: mode === 'detail' ? '1.5px solid var(--color-border)' : 'none',
            transition: 'flex 0.18s ease',
          }}>
            <ProductList
              selectedId={selectedId}
              onSelect={openDetail}
              onNew={openNew}
              onEdit={openEdit}
              detailOpen={mode === 'detail'}
            />
          </div>

          {mode === 'detail' && selectedId && (
            <div style={{ flex: '0 0 42%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <DetailPanel
                id={selectedId}
                onClose={() => { setSelectedId(null); setMode('list'); }}
                onEdit={openEdit}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TD: React.CSSProperties  = { padding: '5px 10px', verticalAlign: 'middle' };
const PG_BTN: React.CSSProperties = {
  padding: '3px 12px', borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)',
};
