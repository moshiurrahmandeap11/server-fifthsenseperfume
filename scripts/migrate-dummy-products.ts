import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../src/app/lib/prisma";
import { FitType, ProductGender, ProductStatus, StockMovementType } from "../src/generated/prisma/enums";
import { DUMMY_PRODUCTS, NEW_ARRIVALS_PRODUCTS } from "../../ecombd-client/src/data/dummyProducts";

const ALL_SEED_PRODUCTS = [...DUMMY_PRODUCTS, ...NEW_ARRIVALS_PRODUCTS];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const urlCache = new Map<string, string>();

async function uploadToCloudinary(imageUrl: string): Promise<string> {
  if (!imageUrl) return imageUrl;
  if (imageUrl.includes("res.cloudinary.com")) return imageUrl;
  if (urlCache.has(imageUrl)) {
    return urlCache.get(imageUrl)!;
  }

  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: "ecombd/images",
      resource_type: "image",
    });
    urlCache.set(imageUrl, result.secure_url);
    return result.secure_url;
  } catch (err) {
    console.error(`Failed to upload ${imageUrl} to Cloudinary:`, err);
    return imageUrl;
  }
}

async function run() {
  console.log(`Starting migration of ${ALL_SEED_PRODUCTS.length} products...`);
  console.log(`Cloudinary Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

  // 1. Collect & upload unique images first
  const uniqueUrls = new Set<string>();
  for (const p of ALL_SEED_PRODUCTS) {
    if (p.thumbnailUrl) uniqueUrls.add(p.thumbnailUrl);
    for (const c of p.colors || []) {
      for (const img of c.images || []) {
        if (img) uniqueUrls.add(img);
      }
    }
  }

  console.log(`Found ${uniqueUrls.size} unique image URLs. Uploading to Cloudinary...`);
  let uploadedCount = 0;
  for (const url of uniqueUrls) {
    await uploadToCloudinary(url);
    uploadedCount++;
    if (uploadedCount % 5 === 0 || uploadedCount === uniqueUrls.size) {
      console.log(`Uploaded ${uploadedCount}/${uniqueUrls.size} images`);
    }
  }

  // 2. Sync Categories
  const categoryMap = new Map<string, string>(); // slug -> real uuid
  for (const p of ALL_SEED_PRODUCTS) {
    const cat = p.category;
    if (!cat || categoryMap.has(cat.slug)) continue;

    const existingCat = await prisma.category.findFirst({
      where: {
        OR: [{ slug: cat.slug }, { name: cat.name }],
      },
    });

    if (existingCat) {
      categoryMap.set(cat.slug, existingCat.id);
    } else {
      const createdCat = await prisma.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          isActive: true,
          image: urlCache.get(p.thumbnailUrl) || p.thumbnailUrl,
        },
      });
      categoryMap.set(cat.slug, createdCat.id);
      console.log(`Created category: ${createdCat.name} (${createdCat.id})`);
    }
  }

  // Fallback category if any product lacks one
  let fallbackCategoryId = Array.from(categoryMap.values())[0];
  if (!fallbackCategoryId) {
    const firstCat = await prisma.category.findFirst();
    fallbackCategoryId = firstCat?.id || "";
  }

  // 3. Sync Products
  let createdCount = 0;
  let skippedCount = 0;

  for (const p of ALL_SEED_PRODUCTS) {
    const existingProd = await prisma.product.findFirst({
      where: {
        OR: [{ slug: p.slug }, { styleCode: p.styleCode }],
      },
    });

    if (existingProd) {
      skippedCount++;
      continue;
    }

    const realCatId =
      (p.category?.slug && categoryMap.get(p.category.slug)) || fallbackCategoryId;

    const cloudThumb = urlCache.get(p.thumbnailUrl) || p.thumbnailUrl;

    await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name: p.name,
          nameBn: p.nameBn || null,
          slug: p.slug,
          styleCode: p.styleCode,
          shortDescription: p.shortDescription || null,
          description: p.description,
          specifications: {
            concentration: p.heelHeight?.replace("Concentration: ", "") || "Eau de Parfum",
            topNotes: p.upperMaterial?.replace("Top: ", "") || "",
            heartNotes: p.soleMaterial?.replace("Heart: ", "") || "",
            baseNotes: p.insoleType?.replace("Base: ", "") || "",
          },
          gender: (p.gender as ProductGender) || ProductGender.UNISEX,
          fitType: (p.fitType as FitType) || FitType.TRUE_TO_SIZE,
          upperMaterial: p.upperMaterial || null,
          soleMaterial: p.soleMaterial || null,
          insoleType: p.insoleType || null,
          heelHeight: p.heelHeight || null,
          closureType: p.closureType || null,
          warrantyDays: p.warrantyDays || 30,
          costPrice: p.costPrice,
          basePrice: p.basePrice,
          discountPrice: p.discountPrice ?? null,
          thumbnailUrl: cloudThumb,
          status: (p.status as ProductStatus) || ProductStatus.PUBLISHED,
          isFeatured: Boolean(p.isFeatured),
          isNewArrival: Boolean(p.isNewArrival),
          isBestSeller: Boolean(p.isBestSeller),
          categoryId: realCatId,
        },
      });

      for (const color of p.colors || []) {
        const cloudImages = (color.images || []).map(
          (img) => urlCache.get(img) || img
        );
        const createdColor = await tx.productColor.create({
          data: {
            productId: createdProduct.id,
            colorName: color.colorName || "Signature Flacon",
            colorHex: color.colorHex || "#111111",
            images: cloudImages.length > 0 ? cloudImages : [cloudThumb],
            isDefault: Boolean(color.isDefault),
            sortOrder: color.sortOrder || 0,
          },
        });

        for (const v of color.variants || []) {
          const sku = v.sku || `${p.styleCode}-${v.size}`;
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: createdProduct.id,
              productColorId: createdColor.id,
              size: v.size,
              sku,
              barcode: sku,
              stockQuantity: v.stockQuantity ?? 10,
              showroomStock: v.showroomStock ?? 0,
              lowStockThreshold: v.lowStockThreshold ?? 3,
              isActive: v.isActive !== undefined ? v.isActive : true,
            },
          });

          if ((v.stockQuantity ?? 0) > 0) {
            await tx.stockMovement.create({
              data: {
                variantId: createdVariant.id,
                type: StockMovementType.FACTORY_IN,
                quantityChange: v.stockQuantity ?? 10,
                previousStock: 0,
                newStock: v.stockQuantity ?? 10,
                note: "Initial stock synced from storefront catalog",
              },
            });
          }
        }
      }
    });

    createdCount++;
  }

  console.log(`Migration complete! Created: ${createdCount}, Skipped (existing): ${skippedCount}`);
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error("Migration error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
