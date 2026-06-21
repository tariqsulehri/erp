'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatMoney, normalizeFormatSettings } from '@/lib/app-settings';
import {
  productsQueryKey,
  useCreateProduct,
  useCreateProductCategory,
  useProductBrands,
  useProductCategories,
  useProductDetail,
  useProductUnitsOfMeasure,
  useSuggestedSku,
  useUpdateProduct,
} from '@/lib/api/products';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  fmtAmt,
  fmtQty,
  LabelInput,
  PRODUCT_TYPE_META,
  PRODUCT_TYPE_OPTIONS,
  SearchableSelect,
  SelectOption,
  STATUS_OPTIONS,
  TabLabel,
  TABS,
  TAX_CATEGORY_OPTIONS,
} from './ProductShared';

export function ProductForm({ editId, onSaved, onCancel }: {
  editId?: string; onSaved: (id: string) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit     = !!editId;
  const [tab, setTab] = useState<TabLabel>('Basic');
  const [error, setError] = useState('');
  const { data: generalSettings } = useGeneralSettings();
  const formatSettings = useMemo(() => normalizeFormatSettings(generalSettings), [generalSettings]);

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

  /* ── Quick-create category panel ── */
  const [showCatCreate,   setShowCatCreate]   = useState(false);
  const [newCatCode,      setNewCatCode]      = useState('');
  const [newCatName,      setNewCatName]      = useState('');
  const [newCatParentId,  setNewCatParentId]  = useState('');
  const [catCreateError,  setCatCreateError]  = useState('');
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
  const { data: rawCategories } = useProductCategories();
  const { data: brands }        = useProductBrands();
  const { data: uoms }          = useProductUnitsOfMeasure();

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
    function flatten(nodes: CatNode[], depth: number): SelectOption[] {
      return nodes.flatMap(n => [
        {
          value: n.id,
          label: '\u00a0\u00a0'.repeat(depth * 2) + (depth > 0 ? '└─\u00a0' : '') + n.code + ' — ' + n.name,
          searchText: `${n.code} ${n.name}`,
        },
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
  const uomOptions = useMemo<SelectOption[]>(
    () => (uoms ?? []).map((u: any) => ({
      value: u.id,
      label: `${u.abbreviation} — ${u.name}`,
      searchText: `${u.abbreviation} ${u.name}`,
    })),
    [uoms],
  );
  const brandOptions = useMemo<SelectOption[]>(() => {
    const tableBrands = (brands ?? []).map((item: any) => ({
      value: item.name,
      label: `${item.code} — ${item.name}`,
      searchText: `${item.code} ${item.name}`,
    }));
    if (brand && !tableBrands.some(option => option.value === brand)) {
      return [{ value: brand, label: brand, searchText: brand }, ...tableBrands];
    }
    return tableBrands;
  }, [brands, brand]);
  const weightUnitOptions = useMemo<SelectOption[]>(
    () => weightUoms.length > 0
      ? weightUoms.map(u => ({ value: u.abbreviation, label: `${u.abbreviation} — ${u.name}`, searchText: `${u.abbreviation} ${u.name}` }))
      : ['kg', 'g', 'lb', 'oz', 't'].map(unit => ({ value: unit, label: unit })),
    [weightUoms],
  );

  /* ── Load for edit ── */
  const { data: existing } = useProductDetail(isEdit ? editId : undefined);

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
  const suggestMut = useSuggestedSku('PRD', !isEdit);
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
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const handleSaved = (product: any) => {
    queryClient.invalidateQueries({ queryKey: productsQueryKey });
    onSaved(product.id);
  };
  const handleSaveError = (error: Error) => setError(error.message);

  /* Quick-create category mutation */
  const createCatMut = useCreateProductCategory();
  const handleCategoryCreated = (cat: any) => {
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      setCategoryId(cat.id);
      setShowCatCreate(false);
      setNewCatCode(''); setNewCatName(''); setNewCatParentId(''); setCatCreateError('');
  };

  function saveNewCategory() {
    setCatCreateError('');
    if (!newCatCode.trim()) { setCatCreateError('Code is required.'); return; }
    if (!newCatName.trim()) { setCatCreateError('Name is required.'); return; }
    createCatMut.mutate({
      code:      newCatCode.trim().toUpperCase(),
      name:      newCatName.trim(),
      parent_id: newCatParentId || undefined,
      sort_order: 0,
      is_active:  true,
    }, { onSuccess: handleCategoryCreated, onError: error => setCatCreateError(error.message) });
  }

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
      updateMut.mutate({ id: editId!, data: payload }, { onSuccess: handleSaved, onError: handleSaveError });
    } else {
      createMut.mutate(payload, { onSuccess: handleSaved, onError: handleSaveError });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const typeMeta  = PRODUCT_TYPE_META[productType] ?? PRODUCT_TYPE_META.Finished;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height))', background: 'var(--color-bg)' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px',
        height: 52, background: 'var(--color-panel-list-head-bg)',
        borderBottom: '2px solid var(--color-panel-header-border)', flexShrink: 0,
      }}>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.26)',
          borderRadius: 'var(--radius)', color: '#fff', fontWeight: 700,
          fontSize: '0.8rem', padding: '4px 12px', cursor: 'pointer',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.20)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back to Products
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-panel-list-fg-muted)', letterSpacing: 0 }}>Inventory</span>
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
          <SearchableSelect
            value={status}
            options={STATUS_OPTIONS}
            onChange={nextStatus => setStatus(nextStatus || 'Active')}
            placeholder="Select Status"
            compact
            width={150}
          />
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
                <SearchableSelect
                  value={brand}
                  options={brandOptions}
                  onChange={setBrand}
                  placeholder="Select Brand"
                />
              </LabelInput>
              <LabelInput label="Model / Part No.">
                <input className="form-input" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. SM-G998B" />
              </LabelInput>
              <LabelInput label="Category">
                <div style={{ display: 'flex', gap: 6 }}>
                  <SearchableSelect
                    value={categoryId}
                    options={categoryOptions}
                    onChange={setCategoryId}
                    placeholder="Select Category"
                  />
                  <button type="button" title="Create new category"
                    onClick={() => { setShowCatCreate(v => !v); setCatCreateError(''); }}
                    style={{
                      flexShrink: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--radius)', border: `1.5px solid ${showCatCreate ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: showCatCreate ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: showCatCreate ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      {showCatCreate
                        ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                        : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                    </svg>
                  </button>
                </div>

                {/* ── Quick-create category panel ── */}
                {showCatCreate && (
                  <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 10, border: '1.5px solid var(--color-info-border)', background: 'var(--color-info-bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: 0 }}>New Category</span>
                    </div>

                    {catCreateError && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-danger-text)', padding: '6px 10px', background: 'var(--color-danger-bg)', borderRadius: 6, border: '1px solid var(--color-danger-border)' }}>
                        {catCreateError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 8 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 3 }}>Code *</label>
                        <input className="form-input" value={newCatCode} onChange={e => setNewCatCode(e.target.value.toUpperCase())}
                          placeholder="ELEC" maxLength={20}
                          style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.8rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 3 }}>Name *</label>
                        <input className="form-input" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                          placeholder="Electronics" maxLength={150} style={{ fontSize: '0.8rem' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 3 }}>Parent Category (optional)</label>
                      <SearchableSelect
                        value={newCatParentId}
                        options={categoryOptions}
                        onChange={setNewCatParentId}
                        placeholder="None (root category)"
                      />
                      <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                        Leave blank to create a top-level parent category.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => { setShowCatCreate(false); setCatCreateError(''); setNewCatCode(''); setNewCatName(''); setNewCatParentId(''); }}
                        style={{ padding: '5px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                        Cancel
                      </button>
                      <button type="button" onClick={saveNewCategory} disabled={createCatMut.isPending}
                        style={{ padding: '5px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, opacity: createCatMut.isPending ? 0.7 : 1 }}>
                        {createCatMut.isPending
                          ? <><div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />Saving…</>
                          : <>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              Create Category
                            </>
                        }
                      </button>
                    </div>
                  </div>
                )}
              </LabelInput>
            </div>

            {/* Row 3: Type, UOM, flags */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 16, alignItems: 'end' }}>
              <LabelInput label="Product Type" required>
                <SearchableSelect
                  value={productType}
                  options={PRODUCT_TYPE_OPTIONS}
                  onChange={nextType => setProductType(nextType || 'Finished')}
                  placeholder="Select Product Type"
                />
              </LabelInput>
              <LabelInput label="Unit of Measure">
                <SearchableSelect
                  value={uomId}
                  options={uomOptions}
                  onChange={setUomId}
                  placeholder="Select Unit"
                />
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
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', letterSpacing: 0 }}>Pricing</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <LabelInput label="Cost Price (Purchase)">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>{formatSettings.currencySymbol}</span>
                    <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                  </div>
                </LabelInput>
                <LabelInput label="Sale Price">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>{formatSettings.currencySymbol}</span>
                    <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={salePrice} onChange={e => setSalePrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                  </div>
                </LabelInput>
                <LabelInput label="Min Sale Price (Floor)">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.875rem' }}>{formatSettings.currencySymbol}</span>
                    <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={minSalePrice} onChange={e => setMinSalePrice(e.target.value)}
                      placeholder="0.00" style={{ paddingLeft: 28, fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                  </div>
                </LabelInput>
              </div>

              {/* Margin indicator */}
              {margin() && (
                <div style={{ margin: '0 18px 18px', padding: '10px 16px', borderRadius: 'var(--radius)', background: 'var(--color-primary-light)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    {[
                      { label: 'Cost',   value: formatMoney(costPrice || 0, generalSettings), color: 'var(--color-text-secondary)' },
                      { label: 'Sale',   value: formatMoney(salePrice || 0, generalSettings), color: 'var(--color-debit)' },
                      { label: 'Profit', value: formatMoney((parseFloat(salePrice)||0) - (parseFloat(costPrice)||0), generalSettings), color: 'var(--color-credit)' },
                      { label: 'Margin', value: `${margin()}%`, color: parseFloat(margin()!) >= 20 ? 'var(--color-credit)' : 'var(--color-warning)' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 2 }}>{item.label}</div>
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
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', letterSpacing: 0 }}>Tax</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <LabelInput label="Tax Category">
                  <SearchableSelect
                    value={taxCategory}
                    options={TAX_CATEGORY_OPTIONS}
                    onChange={nextTax => setTaxCategory(nextTax || 'Standard')}
                    placeholder="Select Tax Category"
                  />
                </LabelInput>
                <LabelInput label="Tax Rate (%)">
                  <input className="form-input" type="number" inputMode="decimal" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)}
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', letterSpacing: 0 }}>Stock Levels</span>
                </div>
                <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  {[
                    { label: 'Opening Stock (Qty)', value: qtyOnHand, set: setQtyOnHand, hint: 'Current on-hand qty' },
                    { label: 'Min Level (Reorder Pt.)', value: minStock, set: setMinStock, hint: 'Trigger reorder below this' },
                    { label: 'Max Level', value: maxStock, set: setMaxStock, hint: 'Maximum stock to hold' },
                    { label: 'Reorder Qty', value: reorderQty, set: setReorderQty, hint: 'Qty to order each time' },
                  ].map(f => (
                    <LabelInput key={f.label} label={f.label}>
                      <input className="form-input" type="number" inputMode="decimal" min="0" step="0.0001" value={f.value} onChange={e => f.set(e.target.value)}
                        placeholder="0" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'right' }} />
                      <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 3 }}>{f.hint}</p>
                    </LabelInput>
                  ))}
                </div>
              </div>

              {/* Stock status preview */}
              {parseFloat(qtyOnHand) >= 0 && (parseFloat(minStock) || parseFloat(maxStock)) ? (
                <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 8 }}>Stock Preview</p>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>On Hand</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)' }}>{fmtQty(qtyOnHand, generalSettings)}</div></div>
                    {minStock && <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Reorder At</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-warning)' }}>{fmtQty(minStock, generalSettings)}</div></div>}
                    {maxStock && <div><div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Max</div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-text)' }}>{fmtQty(maxStock, generalSettings)}</div></div>}
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
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-table-head-text)', letterSpacing: 0 }}>Physical Dimensions</span>
              </div>
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 120px 1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
                <LabelInput label="Weight">
                  <input className="form-input" type="number" inputMode="decimal" min="0" step="0.001" value={weight} onChange={e => setWeight(e.target.value)}
                    placeholder="0.000" style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }} />
                </LabelInput>
                <LabelInput label="Unit">
                  <SearchableSelect
                    value={weightUnit}
                    options={weightUnitOptions}
                    onChange={nextUnit => setWeightUnit(nextUnit || 'kg')}
                    placeholder="Select Unit"
                  />
                </LabelInput>
                {[
                  { label: 'Length (cm)', value: lengthCm, set: setLengthCm },
                  { label: 'Width (cm)',  value: widthCm,  set: setWidthCm  },
                  { label: 'Height (cm)', value: heightCm, set: setHeightCm },
                ].map(f => (
                  <LabelInput key={f.label} label={f.label}>
                    <input className="form-input" type="number" inputMode="decimal" min="0" step="0.01" value={f.value} onChange={e => f.set(e.target.value)}
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
/* ═══════════════════════════════════════════════════════════════════
   PRODUCTS LIST — full-width dense table
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   PAGE ROOT
   ═══════════════════════════════════════════════════════════════════ */
