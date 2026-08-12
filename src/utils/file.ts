import { config } from "../config";
import { supabase } from "../supabase";

// ─── Get File Extension ────────────────────────────────────────────

export function getFileExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex === -1) return ".bin";
  return filePath.substring(dotIndex);
}

// ─── Build Storage Path (for Supabase Storage) ────────────────────

export function buildStoragePath(
  nomorPorsi: string,
  jenisDokumen: string,
  originalFileName: string
): string {
  const ext = getFileExtension(originalFileName);
  const sanitizedJenis = jenisDokumen.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${nomorPorsi}_${sanitizedJenis}${ext}`;
  return `${nomorPorsi}/${fileName}`;
}

// ─── Ensure Bucket Exists ─────────────────────────────────────────

export async function ensureBucketExists(): Promise<void> {
  const bucket = config.STORAGE_BUCKET;

  const { data, error } = await supabase.storage.getBucket(bucket);

  if (error && error.message.includes("not found")) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: false,
    });

    if (createError) {
      throw new Error(`❌ Gagal membuat bucket "${bucket}": ${createError.message}`);
    }

    console.log(`✅ Bucket "${bucket}" berhasil dibuat.`);
  } else if (error) {
    throw new Error(`❌ Gagal mengecek bucket "${bucket}": ${error.message}`);
  } else {
    console.log(`✅ Bucket "${bucket}" sudah tersedia.`);
  }
}

// ─── Download from Telegram & Upload to Supabase Storage ──────────

export async function downloadAndUploadToSupabase(
  fileId: string,
  storagePath: string,
  botToken: string
): Promise<void> {
  // Step 1: Get file path from Telegram
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const fileInfoRes = await fetch(fileInfoUrl);

  if (!fileInfoRes.ok) {
    throw new Error(`❌ Gagal mendapatkan info file dari Telegram: ${fileInfoRes.statusText}`);
  }

  const fileInfoData = (await fileInfoRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  if (!fileInfoData.ok || !fileInfoData.result?.file_path) {
    throw new Error("❌ Telegram API tidak mengembalikan file_path.");
  }

  const telegramFilePath = fileInfoData.result.file_path;

  // Step 2: Download the actual file from Telegram
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${telegramFilePath}`;
  const downloadRes = await fetch(downloadUrl);

  if (!downloadRes.ok) {
    throw new Error(`❌ Gagal mengunduh file dari Telegram: ${downloadRes.statusText}`);
  }

  const fileBuffer = await downloadRes.arrayBuffer();

  // Step 3: Determine content type
  const ext = getFileExtension(telegramFilePath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";

  // Step 4: Upload to Supabase Storage (upsert to overwrite if exists)
  const { error } = await supabase.storage
    .from(config.STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`❌ Gagal mengupload file ke Supabase Storage: ${error.message}`);
  }

  console.log(`✅ File berhasil diupload ke Supabase Storage: ${storagePath}`);
}

// ─── Download File from Supabase Storage ──────────────────────────

export async function downloadFromSupabase(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(config.STORAGE_BUCKET)
    .download(storagePath);

  if (error) {
    throw new Error(`❌ Gagal mengunduh file dari Supabase Storage: ${error.message}`);
  }

  if (!data) {
    throw new Error(`❌ File tidak ditemukan di Supabase Storage: ${storagePath}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
