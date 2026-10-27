'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft, IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { formatMoney, normalizeFormatSettings } from '@/lib/app-settings';
import {
  productsQueryKey,
  useCreateProduct,
  useCreateProductCategory,
  useProductBrands,
  useProductCategories,
  useProductColors,
  useProductDetail,
  useProductOrigins,
  useProductSizes,
  useProductTypes,
  useProductUnitsOfMeasure,
  useSuggestedSku,
  useUpdateProduct,
} from '@/lib/api/products';
import { useGeneralSettings } from '@/lib/api/settings';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, NumericField, SelectField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  fmtQty,
  PRODUCT_TYPE_OPTIONS,
  SelectOption,
  STATUS_OPTIONS,
  TAX_CATEGORY_OPTIONS,
} from './ProductShared';

const summaryLabelStyle: CSSProperties = { display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' };
const summaryValueStyle: CSSProperties = { fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' };

/** Read-only figures under a form section (margin, stock preview). */
function SummaryRow({ items }: { items: Array<{ label: string; value: string; tone?: 'warning' }> }) {
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-subtle)' }}>
      {items.map(item => (
        <div key={item.label}>
          <span style={summaryLabelStyle}>{item.label}</span>
          <span style={{ ...summaryValueStyle, color: item.tone === 'warning' ? 'var(--color-warning-text)' : summaryValueStyle.color }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ProductForm({ editId, onSaved, onCancel }: {
  editId?: string; onSaved: (id: string) => void; onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit     = !!editId;
  const [error, setError] = useState('');
  const { data: generalSettings } = useGeneralSettings();
  const formatSettings = useMemo(() => normalizeFormatSettings(generalSettings), [generalSettings]);

  /* ── Form state ── */
  const [sku,          setSku]          = useState('');
  const [barcode,      setBarcode]      = useState('');
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [brand,        setBrand]        = useState('');
  const [brandId,      setBrandId]      = useState('');
  const [productTypeId, setProductTypeId] = useState('');
  const [itemSizeId,   setItemSizeId]   = useState('');
  const [colorId,      setColorId]      = useState('');
  const [originId,     setOriginId]     = useState('');
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
  const { data: productTypesList } = useProductTypes();
  const { data: sizesList }     = useProductSizes();
  const { data: colorsList }    = useProductColors();
  const { data: originsList }   = useProductOrigins();
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
      const parent = node.parent_id ? map.get(node.parent_id) : undefined;
      if (parent) parent.children.push(node);
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
    return (brands ?? []).map((item: any) => ({
      value: item.id,
      label: `${item.code} — ${item.name}`,
      searchText: `${item.code} ${item.name}`,
    }));
  }, [brands]);

  const productTypeRecordOptions = useMemo<SelectOption[]>(() => {
    return (productTypesList ?? []).map((pt: any) => ({
      value: pt.id,
      label: `${pt.code} — ${pt.name}`,
      searchText: `${pt.code} ${pt.name}`,
    }));
  }, [productTypesList]);

  const sizeOptions = useMemo<SelectOption[]>(() => {
    return (sizesList ?? []).map((s: any) => ({
      value: s.id,
      label: `${s.code} — ${s.name}`,
      searchText: `${s.code} ${s.name}`,
    }));
  }, [sizesList]);

  const colorOptions = useMemo<SelectOption[]>(() => {
    return (colorsList ?? []).map((c: any) => ({
      value: c.id,
      label: `${c.code} — ${c.name}${c.hex_code || c.hexCode ? ` (${c.hex_code || c.hexCode})` : ''}`,
      searchText: `${c.code} ${c.name} ${c.hex_code || c.hexCode || ''}`,
    }));
  }, [colorsList]);

  const originOptions = useMemo<SelectOption[]>(() => {
    return (originsList ?? []).map((o: any) => ({
      value: o.id,
      label: `${o.code} — ${o.name}`,
      searchText: `${o.code} ${o.name}`,
    }));
  }, [originsList]);

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
    setBrandId(existing.brand_id ?? existing.brand_record?.id ?? '');
    setProductTypeId(existing.product_type_id ?? existing.product_type_record?.id ?? '');
    setItemSizeId(existing.item_size_id ?? existing.size_record?.id ?? '');
    setColorId(existing.color_id ?? existing.color_record?.id ?? '');
    setOriginId(existing.origin_id ?? existing.origin_record?.id ?? '');
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
    if (!newCatCode.trim()) { setCatCreateError('Enter a Category Code.'); return; }
    if (!newCatName.trim()) { setCatCreateError('Enter a Category Name.'); return; }
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
    if (!sku.trim())  { setError('Enter the SKU.'); return; }
    if (!name.trim()) { setError('Enter a Product Name.'); return; }

    const payload = {
      sku: sku.trim().toUpperCase(),
      barcode:      barcode     || undefined,
      name:         name.trim(),
      description:  description || undefined,
      brand:        brand       || undefined,
      brand_id:     brandId     || undefined,
      product_type_id: productTypeId || undefined,
      item_size_id: itemSizeId  || undefined,
      color_id:     colorId     || undefined,
      origin_id:    originId    || undefined,
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

    if (isEdit && editId) {
      updateMut.mutate({ id: editId, data: payload }, { onSuccess: handleSaved, onError: handleSaveError });
    } else {
      createMut.mutate(payload, { onSuccess: handleSaved, onError: handleSaveError });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  const currencySymbol = formatSettings.currencySymbol;
  const marginValue = margin();

  function closeCategoryCreate() {
    setShowCatCreate(false);
    setCatCreateError('');
    setNewCatCode('');
    setNewCatName('');
    setNewCatParentId('');
  }

  const stockLevelFields = [
    { label: 'Opening Stock Quantity', value: qtyOnHand, set: setQtyOnHand, hint: 'Quantity on hand now.' },
    { label: 'Minimum Level', value: minStock, set: setMinStock, hint: 'Order again when stock falls below this.' },
    { label: 'Maximum Level', value: maxStock, set: setMaxStock, hint: 'Most stock to hold.' },
    { label: 'Reorder Quantity', value: reorderQty, set: setReorderQty, hint: 'Quantity to order each time.' },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        title={isEdit ? `Edit Product ${existing?.name ?? ''}`.trim() : 'New Product'}
        description="A Product is an item you buy, sell, or keep in stock. SKU and Product Name are required."
        help={(
          <>
            <p>Enter the product details, prices, tax, and stock levels, then click Save Product.</p>
            <p>The SKU is the code you use for this product.</p>
            <p>Turn off Track Stock For This Product for services and items you do not keep in stock.</p>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={onCancel}>Back To List</Button>
            <Button variant="primary" icon={<IconCheck size={16} stroke={1.8} />} onClick={save} loading={isPending}>
              {isEdit ? 'Save Changes' : 'Save Product'}
            </Button>
          </>
        )}
      />

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      <section className="panel" style={{ overflow: 'auto' }}>
        <div className="panel-body">

          {/* ─────── BASIC DETAILS ─────── */}
          <div className="form-section">
            <h2 className="form-section-title">Basic Details</h2>
            <div className="form-grid">
              <TextField label="SKU" required value={sku} onChange={value => setSku(value.toUpperCase())} placeholder="PRD-0001" />
              <TextField label="Barcode Or EAN" value={barcode} onChange={setBarcode} placeholder="For example 8901234567890" />
              <div className="span-2">
                <TextField label="Product Name" required value={name} onChange={setName} placeholder="Full product name" />
              </div>

              <FieldLabel label="Brand">
                <SearchableSelect value={brandId} options={brandOptions} onChange={setBrandId} placeholder="Select Brand" />
              </FieldLabel>
              <TextField label="Model Or Part No." value={model} onChange={setModel} placeholder="For example SM-G998B" />
              <div className="span-2">
                <FieldLabel label="Category">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <SearchableSelect value={categoryId} options={categoryOptions} onChange={setCategoryId} placeholder="Select Category" />
                    </div>
                    <Button
                      variant="secondary"
                      icon={showCatCreate ? <IconX size={16} stroke={1.8} /> : <IconPlus size={16} stroke={1.8} />}
                      onClick={() => { setShowCatCreate(v => !v); setCatCreateError(''); }}
                      aria-label={showCatCreate ? 'Close New Category' : 'New Category'}
                      title={showCatCreate ? 'Close New Category' : 'New Category'}
                      aria-pressed={showCatCreate}
                    />
                  </div>
                </FieldLabel>
              </div>

              <FieldLabel label="Product Type">
                <SearchableSelect value={productTypeId} options={productTypeRecordOptions} onChange={setProductTypeId} placeholder="Select Product Type" />
              </FieldLabel>

              <FieldLabel label="Size">
                <SearchableSelect value={itemSizeId} options={sizeOptions} onChange={setItemSizeId} placeholder="Select Size" />
              </FieldLabel>

              <FieldLabel label="Color">
                <SearchableSelect value={colorId} options={colorOptions} onChange={setColorId} placeholder="Select Color" />
              </FieldLabel>

              <FieldLabel label="Origin">
                <SearchableSelect value={originId} options={originOptions} onChange={setOriginId} placeholder="Select Origin" />
              </FieldLabel>

              {/* ── Quick-create category ── */}
              {showCatCreate && (
                <div className="span-all panel" style={{ overflow: 'visible' }}>
                  <div className="panel-header">
                    <h3 className="panel-title">New Category</h3>
                  </div>
                  <div className="panel-body">
                    {catCreateError && <div style={{ marginBottom: 12 }}><InlineAlert tone="danger">{catCreateError}</InlineAlert></div>}
                    <div className="form-grid">
                      <TextField label="Category Code" required value={newCatCode} onChange={value => setNewCatCode(value.toUpperCase())} placeholder="ELEC" inputProps={{ maxLength: 20 }} />
                      <TextField label="Category Name" required value={newCatName} onChange={setNewCatName} placeholder="Electronics" inputProps={{ maxLength: 150 }} />
                      <div className="span-2">
                        <FieldLabel label="Parent Category">
                          <SearchableSelect value={newCatParentId} options={categoryOptions} onChange={setNewCatParentId} placeholder="No Parent (Top Level)" />
                        </FieldLabel>
                        <p className="form-hint">Leave blank to create a top-level Category.</p>
                      </div>
                    </div>
                  </div>
                  <div className="panel-footer">
                    <Button variant="ghost" onClick={closeCategoryCreate}>Cancel</Button>
                    <Button variant="primary" size="sm" icon={<IconCheck size={16} stroke={1.8} />} onClick={saveNewCategory} loading={createCatMut.isPending}>
                      Save Category
                    </Button>
                  </div>
                </div>
              )}

              <SelectField
                label="Product Type"
                required
                value={productType}
                options={PRODUCT_TYPE_OPTIONS}
                onChange={nextType => setProductType(nextType || 'Finished')}
              />
              <FieldLabel label="Unit Of Measure">
                <SearchableSelect value={uomId} options={uomOptions} onChange={setUomId} placeholder="Select Unit" />
              </FieldLabel>
              <SelectField
                label="Status"
                required
                value={status}
                options={STATUS_OPTIONS}
                onChange={nextStatus => setStatus(nextStatus || 'Active')}
              />
              <div style={{ display: 'flex', gap: 24, alignItems: 'end', minHeight: 52, flexWrap: 'wrap' }}>
                <CheckboxField label="Can Be Sold" checked={isSellable} onChange={setIsSellable} />
                <CheckboxField label="Can Be Bought" checked={isPurchasable} onChange={setIsPurchasable} />
              </div>

              <div className="span-all">
                <TextareaField label="Description" value={description} onChange={setDescription} placeholder="Detailed description of the product" rows={3} />
              </div>
              <div className="span-2">
                <TextField label="Product Image Link" value={imageUrl} onChange={setImageUrl} placeholder="https://example.com/images/product.jpg" inputProps={{ type: 'url' }} />
              </div>
            </div>
          </div>

          {/* ─────── PRICING AND TAX ─────── */}
          <div className="form-section">
            <h2 className="form-section-title">Pricing And Tax</h2>
            <div className="form-grid">
              <NumericField label={`Cost Price (${currencySymbol})`} value={costPrice} onChange={setCostPrice} placeholder="0.00" />
              <NumericField label={`Sale Price (${currencySymbol})`} value={salePrice} onChange={setSalePrice} placeholder="0.00" />
              <NumericField label={`Minimum Sale Price (${currencySymbol})`} value={minSalePrice} onChange={setMinSalePrice} placeholder="0.00" />
              <div />
              <SelectField
                label="Tax Category"
                value={taxCategory}
                options={TAX_CATEGORY_OPTIONS}
                onChange={nextTax => setTaxCategory(nextTax || 'Standard')}
              />
              <NumericField
                label="Tax Rate (%)"
                value={taxRate}
                onChange={setTaxRate}
                placeholder="For example 17"
                disabled={taxCategory !== 'Standard'}
              />
            </div>
            {marginValue && (
              <SummaryRow
                items={[
                  { label: 'Cost', value: formatMoney(costPrice || 0, generalSettings) },
                  { label: 'Sale', value: formatMoney(salePrice || 0, generalSettings) },
                  { label: 'Profit', value: formatMoney((parseFloat(salePrice) || 0) - (parseFloat(costPrice) || 0), generalSettings) },
                  { label: 'Margin', value: `${marginValue}%`, tone: parseFloat(marginValue) >= 20 ? undefined : 'warning' },
                ]}
              />
            )}
          </div>

          {/* ─────── STOCK CONTROL ─────── */}
          <div className="form-section">
            <h2 className="form-section-title">Stock Control</h2>
            <CheckboxField label="Track Stock For This Product" checked={trackInv} onChange={setTrackInv} />
            <p className="form-hint" style={{ marginBottom: 12 }}>Turn this off for services and items you do not keep in stock.</p>
            <div className="form-grid">
              {stockLevelFields.map(f => (
                <div key={f.label}>
                  <NumericField label={f.label} value={f.value} onChange={f.set} placeholder="0" decimalPlaces={4} disabled={!trackInv} />
                  <p className="form-hint">{f.hint}</p>
                </div>
              ))}
            </div>
            {trackInv && parseFloat(qtyOnHand) >= 0 && (parseFloat(minStock) || parseFloat(maxStock)) ? (
              <SummaryRow
                items={[
                  { label: 'On Hand', value: fmtQty(qtyOnHand, generalSettings) },
                  ...(minStock ? [{ label: 'Reorder At', value: fmtQty(minStock, generalSettings), tone: 'warning' as const }] : []),
                  ...(maxStock ? [{ label: 'Maximum', value: fmtQty(maxStock, generalSettings) }] : []),
                ]}
              />
            ) : null}
          </div>

          {/* ─────── PHYSICAL DETAILS AND NOTES ─────── */}
          <div className="form-section">
            <h2 className="form-section-title">Physical Details And Notes</h2>
            <div className="form-grid" style={{ '--form-cols': 5 } as CSSProperties}>
              <NumericField label="Weight" value={weight} onChange={setWeight} placeholder="0.000" decimalPlaces={3} />
              <SelectField
                label="Weight Unit"
                value={weightUnit}
                options={weightUnitOptions}
                onChange={nextUnit => setWeightUnit(nextUnit || 'kg')}
              />
              <NumericField label="Length (cm)" value={lengthCm} onChange={setLengthCm} placeholder="0.00" />
              <NumericField label="Width (cm)" value={widthCm} onChange={setWidthCm} placeholder="0.00" />
              <NumericField label="Height (cm)" value={heightCm} onChange={setHeightCm} placeholder="0.00" />
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="span-2">
                <TextField label="Tags" value={tags} onChange={setTags} placeholder="For example electronics, mobile, imported" />
                <p className="form-hint">Separate tags with commas.</p>
              </div>
              <div className="span-all">
                <TextareaField label="Internal Notes" value={notes} onChange={setNotes} placeholder="Notes for staff only, not printed" rows={4} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
