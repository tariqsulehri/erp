import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const companyId = "00000000-0000-0000-0000-000000000001";

async function ensureExistingCompany() {
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name
    FROM companies
    WHERE id = ${companyId}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error(
      `Sample company ${companyId} was not found. Create a company before seeding inventory.`,
    );
  }

  return rows[0];
}

async function seedLookups() {
  const categories = [
    { code: "VINYL", name: "Vinyl", description: "Vinyl rolls and sheets" },
    { code: "PAPER", name: "Paper", description: "Printing and office paper" },
    { code: "INK", name: "Ink", description: "Ink and printing consumables" },
    { code: "BOARD", name: "Board", description: "Boards and rigid sheets" },
    { code: "PACKING", name: "Packing", description: "Packing material" },
  ];

  const categoryMap = new Map<string, string>();

  for (const [index, category] of categories.entries()) {
    const saved = await prisma.inventoryCategory.upsert({
      where: { companyId_code: { companyId, code: category.code } },
      update: {
        name: category.name,
        description: category.description,
        level: 0,
        path: category.code,
        sortOrder: index + 1,
        isActive: true,
      },
      create: {
        companyId,
        code: category.code,
        name: category.name,
        description: category.description,
        level: 0,
        path: category.code,
        sortOrder: index + 1,
        isActive: true,
      },
    });
    categoryMap.set(category.code, saved.id);
  }

  const subCategories = [
    { code: "VINYL-GLOSSY", name: "Glossy Vinyl", parentCode: "VINYL" },
    { code: "VINYL-MATTE", name: "Matte Vinyl", parentCode: "VINYL" },
    { code: "PAPER-PHOTO", name: "Photo Paper", parentCode: "PAPER" },
    { code: "PAPER-OFFICE", name: "Office Paper", parentCode: "PAPER" },
    { code: "INK-SOLVENT", name: "Solvent Ink", parentCode: "INK" },
    { code: "INK-ECO", name: "Eco Solvent Ink", parentCode: "INK" },
    { code: "BOARD-FOAM", name: "Foam Board", parentCode: "BOARD" },
    { code: "PACKING-TAPE", name: "Packing Tape", parentCode: "PACKING" },
  ];

  for (const [index, category] of subCategories.entries()) {
    const parentId = categoryMap.get(category.parentCode);
    if (!parentId) {
      continue;
    }

    const saved = await prisma.inventoryCategory.upsert({
      where: { companyId_code: { companyId, code: category.code } },
      update: {
        name: category.name,
        parentId,
        level: 1,
        path: `${category.parentCode}/${category.code}`,
        sortOrder: index + 1,
        isActive: true,
      },
      create: {
        companyId,
        code: category.code,
        name: category.name,
        parentId,
        level: 1,
        path: `${category.parentCode}/${category.code}`,
        sortOrder: index + 1,
        isActive: true,
      },
    });
    categoryMap.set(category.code, saved.id);
  }

  const itemGroups = await Promise.all(
    [
      { code: "ROLLS", name: "Roll Items" },
      { code: "SHEETS", name: "Sheet Items" },
      { code: "CONSUMABLES", name: "Consumables" },
      { code: "PACKING", name: "Packing Items" },
    ].map((group, index) =>
      prisma.inventoryItemGroup.upsert({
        where: { companyId_code: { companyId, code: group.code } },
        update: { name: group.name, sortOrder: index + 1, isActive: true },
        create: { companyId, ...group, sortOrder: index + 1, isActive: true },
      }),
    ),
  );

  const productTypes = await Promise.all(
    [
      { code: "FINISHED", name: "Finished Good" },
      { code: "RAW", name: "Raw Material" },
      { code: "CONSUMABLE", name: "Consumable" },
      { code: "PACKING", name: "Packing Material" },
    ].map((type, index) =>
      prisma.productType.upsert({
        where: { companyId_code: { companyId, code: type.code } },
        update: { name: type.name, sortOrder: index + 1, isActive: true },
        create: { companyId, ...type, sortOrder: index + 1, isActive: true },
      }),
    ),
  );

  const brands = await Promise.all(
    [
      "Sabri",
      "Orajet",
      "Avery",
      "3M",
      "HP",
      "Epson",
      "Canon",
      "Mactac",
      "Ritrama",
      "Local",
    ].map((name, index) =>
      prisma.brand.upsert({
        where: { companyId_code: { companyId, code: name.toUpperCase().replaceAll(" ", "-") } },
        update: { name, sortOrder: index + 1, isActive: true },
        create: {
          companyId,
          code: name.toUpperCase().replaceAll(" ", "-"),
          name,
          sortOrder: index + 1,
          isActive: true,
        },
      }),
    ),
  );

  const sizes = await Promise.all(
    [
      "12 x 18",
      "24 x 36",
      "36 x 48",
      "48 x 96",
      "54 x 164",
      "60 x 150",
      "A4",
      "A3",
      "1 Liter",
      "5 Liter",
    ].map((name, index) =>
      prisma.itemSize.upsert({
        where: { companyId_code: { companyId, code: `SIZE-${index + 1}` } },
        update: { name, sortOrder: index + 1, isActive: true },
        create: {
          companyId,
          code: `SIZE-${index + 1}`,
          name,
          sortOrder: index + 1,
          isActive: true,
        },
      }),
    ),
  );

  const origins = await Promise.all(
    ["Pakistan", "China", "Taiwan", "Japan", "Korea", "Germany", "USA"].map((name, index) =>
      prisma.origin.upsert({
        where: { companyId_code: { companyId, code: name.toUpperCase() } },
        update: { name, sortOrder: index + 1, isActive: true },
        create: {
          companyId,
          code: name.toUpperCase(),
          name,
          sortOrder: index + 1,
          isActive: true,
        },
      }),
    ),
  );

  const units = await Promise.all(
    [
      { code: "PCS", name: "Pieces", shortName: "PCS" },
      { code: "SFT", name: "Square Feet", shortName: "SFT" },
      { code: "ROLL", name: "Roll", shortName: "ROLL" },
      { code: "BOX", name: "Box", shortName: "BOX" },
      { code: "LTR", name: "Liter", shortName: "LTR" },
      { code: "KG", name: "Kilogram", shortName: "KG" },
      { code: "MTR", name: "Meter", shortName: "MTR" },
    ].map((unit, index) =>
      prisma.unitOfMeasure.upsert({
        where: { companyId_code: { companyId, code: unit.code } },
        update: { name: unit.name, shortName: unit.shortName, isDefault: index === 0, isActive: true },
        create: { companyId, ...unit, isDefault: index === 0, isActive: true },
      }),
    ),
  );

  const warehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId, code: "MAIN" } },
    update: {
      name: "Main Warehouse",
      description: "Main stock storage place",
      address: "Head Office",
      isDefault: true,
      isActive: true,
    },
    create: {
      companyId,
      code: "MAIN",
      name: "Main Warehouse",
      description: "Main stock storage place",
      address: "Head Office",
      isDefault: true,
      isActive: true,
    },
  });

  const location = await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "HEAD-OFFICE" } },
    update: { name: "Head Office", isDefault: true, isActive: true },
    create: {
      companyId,
      warehouseId: warehouse.id,
      code: "HEAD-OFFICE",
      name: "Head Office",
      isDefault: true,
      isActive: true,
    },
  });

  return {
    categoryMap,
    itemGroups,
    productTypes,
    brands,
    sizes,
    origins,
    units,
    warehouse,
    location,
  };
}

async function seedItems() {
  const lookups = await seedLookups();
  const categoryCodes = Array.from(lookups.categoryMap.keys()).filter((code) => code.includes("-"));
  const itemKinds = ["FINISHED_GOOD", "RAW_MATERIAL", "CONSUMABLE", "PACKAGING"] as const;
  const colors = ["White", "Black", "Blue", "Red", "Green", "Clear", "Silver", "Gold"];
  const qualities = ["Standard", "Premium", "Economy", "Heavy Duty"];

  for (let index = 1; index <= 120; index += 1) {
    const itemCode = `ITM-${String(index).padStart(4, "0")}`;
    const categoryCode = categoryCodes[index % categoryCodes.length];
    const brand = lookups.brands[index % lookups.brands.length];
    const size = lookups.sizes[index % lookups.sizes.length];
    const origin = lookups.origins[index % lookups.origins.length];
    const itemGroup = lookups.itemGroups[index % lookups.itemGroups.length];
    const productType = lookups.productTypes[index % lookups.productTypes.length];
    const unit = lookups.units[index % lookups.units.length];
    const quantity = 50 + index * 3;
    const purchasePrice = 25 + index * 1.75;
    const salesPrice = purchasePrice * 1.28;
    const wholesalePrice = salesPrice * 0.92;
    const minimumSalesPrice = salesPrice * 0.85;

    const item = await prisma.inventoryItem.upsert({
      where: { companyId_itemCode: { companyId, itemCode } },
      update: {
        sku: `SKU-${String(index).padStart(4, "0")}`,
        itemName: `${brand.name} ${categoryCode.replace("-", " ")} ${size.name}`,
        saleDescription: `${brand.name} ${categoryCode.replace("-", " ")} ${size.name}`,
        detailedDescription: `${brand.name} ${categoryCode.replace("-", " ")} item, origin ${origin.name}, size ${size.name}.`,
        categoryId: lookups.categoryMap.get(categoryCode),
        itemGroupId: itemGroup.id,
        productTypeId: productType.id,
        brandId: brand.id,
        itemSizeId: size.id,
        originId: origin.id,
        baseUomId: unit.id,
        stockUomId: unit.id,
        purchaseUomId: unit.id,
        salesUomId: unit.id,
        itemKind: itemKinds[index % itemKinds.length],
        defaultPurchasePrice: purchasePrice.toFixed(4),
        defaultSalesPrice: salesPrice.toFixed(4),
        minimumSalesPrice: minimumSalesPrice.toFixed(4),
        wholesalePrice: wholesalePrice.toFixed(4),
        standardCost: purchasePrice.toFixed(4),
        minimumStockLevel: "25.0000",
        maximumStockLevel: "1000.0000",
        reorderLevel: "75.0000",
        reorderQuantity: "150.0000",
        defaultWarehouseId: lookups.warehouse.id,
        defaultLocationId: lookups.location.id,
        otherInformation: `Seed sample item ${index}`,
        isActive: true,
        isBlocked: false,
      },
      create: {
        companyId,
        itemCode,
        sku: `SKU-${String(index).padStart(4, "0")}`,
        itemName: `${brand.name} ${categoryCode.replace("-", " ")} ${size.name}`,
        saleDescription: `${brand.name} ${categoryCode.replace("-", " ")} ${size.name}`,
        detailedDescription: `${brand.name} ${categoryCode.replace("-", " ")} item, origin ${origin.name}, size ${size.name}.`,
        categoryId: lookups.categoryMap.get(categoryCode),
        itemGroupId: itemGroup.id,
        productTypeId: productType.id,
        brandId: brand.id,
        itemSizeId: size.id,
        originId: origin.id,
        baseUomId: unit.id,
        stockUomId: unit.id,
        purchaseUomId: unit.id,
        salesUomId: unit.id,
        itemKind: itemKinds[index % itemKinds.length],
        valuationMethod: "WEIGHTED_AVERAGE",
        trackingMethod: "NONE",
        defaultPurchasePrice: purchasePrice.toFixed(4),
        defaultSalesPrice: salesPrice.toFixed(4),
        minimumSalesPrice: minimumSalesPrice.toFixed(4),
        wholesalePrice: wholesalePrice.toFixed(4),
        standardCost: purchasePrice.toFixed(4),
        purchaseDiscountPercent: "0.0000",
        salesDiscountPercent: "0.0000",
        wholesaleDiscountPercent: "0.0000",
        importTaxPercent: "0.0000",
        minimumStockLevel: "25.0000",
        maximumStockLevel: "1000.0000",
        reorderLevel: "75.0000",
        reorderQuantity: "150.0000",
        defaultWarehouseId: lookups.warehouse.id,
        defaultLocationId: lookups.location.id,
        otherInformation: `Seed sample item ${index}`,
        isActive: true,
        isBlocked: false,
      },
    });

    await prisma.itemPrice.deleteMany({ where: { companyId, itemId: item.id } });
    await prisma.itemBarcode.deleteMany({ where: { companyId, itemId: item.id } });
    await prisma.itemImage.deleteMany({ where: { companyId, itemId: item.id } });
    await prisma.itemAttribute.deleteMany({ where: { companyId, itemId: item.id } });
    await prisma.stockMovement.deleteMany({ where: { companyId, itemId: item.id } });
    await prisma.stockBalance.deleteMany({ where: { companyId, itemId: item.id } });

    await prisma.itemPrice.createMany({
      data: [
        {
          companyId,
          itemId: item.id,
          priceKind: "PURCHASE",
          price: purchasePrice.toFixed(4),
          discountPercent: "0.0000",
        },
        {
          companyId,
          itemId: item.id,
          priceKind: "SALES",
          price: salesPrice.toFixed(4),
          discountPercent: "0.0000",
        },
        {
          companyId,
          itemId: item.id,
          priceKind: "WHOLESALE",
          price: wholesalePrice.toFixed(4),
          discountPercent: "0.0000",
        },
        {
          companyId,
          itemId: item.id,
          priceKind: "MINIMUM_SALES",
          price: minimumSalesPrice.toFixed(4),
          discountPercent: "0.0000",
        },
      ],
    });

    await prisma.itemBarcode.create({
      data: {
        companyId,
        itemId: item.id,
        barcode: `890000${String(index).padStart(6, "0")}`,
        label: "Primary Barcode",
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.itemImage.create({
      data: {
        companyId,
        itemId: item.id,
        imageUrl: `https://example.com/erp/items/${itemCode.toLowerCase()}.jpg`,
        label: "Main Image",
        sortOrder: 1,
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.itemAttribute.createMany({
      data: [
        {
          companyId,
          itemId: item.id,
          name: "Color",
          value: colors[index % colors.length],
        },
        {
          companyId,
          itemId: item.id,
          name: "Quality",
          value: qualities[index % qualities.length],
        },
      ],
    });

    await prisma.stockBalance.create({
      data: {
        companyId,
        itemId: item.id,
        warehouseId: lookups.warehouse.id,
        locationId: lookups.location.id,
        stockOnHand: quantity.toFixed(4),
        reservedStock: "0.0000",
        availableStock: quantity.toFixed(4),
        averageCost: purchasePrice.toFixed(4),
        totalStockValue: (quantity * purchasePrice).toFixed(4),
        isActive: true,
      },
    });

    await prisma.stockMovement.create({
      data: {
        companyId,
        itemId: item.id,
        warehouseId: lookups.warehouse.id,
        locationId: lookups.location.id,
        movementDate: new Date("2026-06-19T00:00:00.000Z"),
        movementKind: "OPENING_BALANCE",
        sourceKind: "OPENING_BALANCE",
        sourceDocumentNumber: `OPEN-${itemCode}`,
        quantityIn: quantity.toFixed(4),
        quantityOut: "0.0000",
        unitCost: purchasePrice.toFixed(4),
        totalCost: (quantity * purchasePrice).toFixed(4),
        stockAfterMovement: quantity.toFixed(4),
        valuationMethod: "WEIGHTED_AVERAGE",
        remarks: "Opening stock from inventory seed.",
        isActive: true,
      },
    });
  }
}

async function main() {
  const company = await ensureExistingCompany();
  await seedItems();

  const [items, images, balances, movements] = await Promise.all([
    prisma.inventoryItem.count({ where: { companyId } }),
    prisma.itemImage.count({ where: { companyId } }),
    prisma.stockBalance.count({ where: { companyId } }),
    prisma.stockMovement.count({ where: { companyId } }),
  ]);

  console.log(
    JSON.stringify(
      {
        company: company.name,
        inventoryItems: items,
        itemImages: images,
        stockBalances: balances,
        stockMovements: movements,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
