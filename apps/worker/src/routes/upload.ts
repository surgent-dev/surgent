import { Hono } from "hono";
import { S3Client } from "bun";
import type { AppContext } from "@/types/application";
import { requireAuth } from "../middleware/auth";
import { config } from "@/lib/config";

const upload = new Hono<AppContext>();

const uploadsConfigured = config.uploads.accessKeyId && config.uploads.secretAccessKey && config.uploads.bucket;

const s3 = uploadsConfigured
  ? new S3Client({
      accessKeyId: config.uploads.accessKeyId!,
      secretAccessKey: config.uploads.secretAccessKey!,
      sessionToken: config.uploads.sessionToken,
      region: config.uploads.region,
      endpoint: config.uploads.endpoint,
      bucket: config.uploads.bucket!,
    })
  : null;

// GET /api/upload/* - Serve file from S3/R2
upload.get("/*", async (c) => {
  if (!s3) return c.json({ error: "Uploads not configured" }, 503);

  const key = c.req.param("*");

  if (!key) return c.json({ error: "No key provided" }, 400);
  if (key.includes("..")) return c.json({ error: "Invalid key" }, 400);

  const file = s3.file(key);
  if (!(await file.exists())) {
    return c.json({ error: "File not found" }, 404);
  }

  return new Response(file.stream(), {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000",
    },
  });
});

// POST /api/upload - Upload file to S3/R2
upload.post("/", requireAuth, async (c) => {
  if (!s3) return c.json({ error: "Uploads not configured" }, 503);

  const user = c.get("user")!;
  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }

  // Generate unique key: userId/timestamp-random-filename
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${user.id}/${timestamp}-${random}-${safeName}`;

  const uploadFile = s3.file(key);
  await uploadFile.write(file, { type: file.type });

  console.log("[upload] stored", { key, size: file.size });

  const publicBase = config.uploads.publicUrl;
  const publicUrl = publicBase
    ? `${publicBase.replace(/\/$/, "")}/${key}`
    : uploadFile.presign({ expiresIn: 60 * 60 * 24 });

  return c.json({
    url: publicUrl,
    key,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
});

export default upload;
