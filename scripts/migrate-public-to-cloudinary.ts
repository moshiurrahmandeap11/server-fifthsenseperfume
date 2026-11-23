import "dotenv/config";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../src/app/lib/prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PUBLIC_DIR = path.resolve(process.cwd(), "../ecombd-client/public");

function walkFiles(dir: string, list: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "fonts") continue;
      walkFiles(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

function toWebpUrl(url: string): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace(/\.(jpg|jpeg|png)$/i, ".webp");
}

async function run() {
  const files = walkFiles(PUBLIC_DIR);
  const urlMap: Record<string, string> = {};

  console.log(`Found ${files.length} files in public/ to migrate...`);

  for (const filePath of files) {
    const rel = "/" + path.relative(PUBLIC_DIR, filePath).replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path
      .basename(filePath, ext)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_]/g, "");

    if ([".ico"].includes(ext)) continue;

    try {
      if (ext === ".mp4" || ext === ".webm" || ext === ".mov") {
        const res = await cloudinary.uploader.upload(filePath, {
          resource_type: "video",
          folder: "ecombd/videos",
          public_id: baseName,
          overwrite: true,
        });
        // Add q_auto,f_auto delivery optimization for fast streaming
        const optimizedVideoUrl = res.secure_url.replace(
          "/video/upload/",
          "/video/upload/q_auto,f_auto/"
        );
        urlMap[rel] = optimizedVideoUrl;
        console.log(`Video uploaded: ${rel} -> ${optimizedVideoUrl}`);
      } else if (ext === ".svg") {
        const res = await cloudinary.uploader.upload(filePath, {
          resource_type: "image",
          folder: "ecombd/site-assets",
          public_id: baseName,
          overwrite: true,
        });
        urlMap[rel] = res.secure_url;
        console.log(`SVG uploaded: ${rel} -> ${res.secure_url}`);
      } else if ([".png", ".jpg", ".jpeg", ".webp", ".jxl"].includes(ext)) {
        const res = await cloudinary.uploader.upload(filePath, {
          resource_type: "image",
          folder: "ecombd/site-assets",
          public_id: baseName,
          format: "webp",
          transformation: [{ quality: "auto:good" }],
          overwrite: true,
        });
        urlMap[rel] = res.secure_url;
        console.log(`WebP image uploaded: ${rel} -> ${res.secure_url}`);
      }
    } catch (err) {
      console.error(`Failed to upload ${rel}:`, err);
    }
  }

  // Save map to scratch/public-url-map.json for reference
  fs.writeFileSync(
    path.resolve(process.cwd(), "scripts/public-url-map.json"),
    JSON.stringify(urlMap, null, 2)
  );

  // Convert existing DB image URLs to .webp
  const products = await prisma.product.findMany({
    include: { colors: true },
  });
  let updatedProds = 0;
  for (const prod of products) {
    const nextThumb = toWebpUrl(prod.thumbnailUrl);
    if (nextThumb !== prod.thumbnailUrl) {
      await prisma.product.update({
        where: { id: prod.id },
        data: { thumbnailUrl: nextThumb },
      });
      updatedProds++;
    }
    for (const col of prod.colors) {
      const nextImages = col.images.map(toWebpUrl);
      if (JSON.stringify(nextImages) !== JSON.stringify(col.images)) {
        await prisma.productColor.update({
          where: { id: col.id },
          data: { images: nextImages },
        });
      }
    }
  }

  const categories = await prisma.category.findMany();
  let updatedCats = 0;
  for (const cat of categories) {
    if (cat.image) {
      const nextImg = toWebpUrl(cat.image);
      if (nextImg !== cat.image) {
        await prisma.category.update({
          where: { id: cat.id },
          data: { image: nextImg },
        });
        updatedCats++;
      }
    }
  }

  console.log(
    `Done! Uploaded ${Object.keys(urlMap).length} assets. DB WebP updates: ${updatedProds} products, ${updatedCats} categories.`
  );
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
