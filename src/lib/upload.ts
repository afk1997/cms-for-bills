import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const storageDir = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "public/uploads");

export async function saveFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.mkdir(storageDir, { recursive: true });
  const ext = path.extname(file.name) || ".dat";
  const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(storageDir, fileName);
  await fs.writeFile(filePath, buffer);
  return {
    fileName: file.name,
    fileUrl: `/uploads/${fileName}`
  };
}

export async function removeFile(fileUrl: string) {
  const localPath = fileUrl.startsWith("/uploads/") ? fileUrl.replace("/uploads/", "") : null;
  if (!localPath) return;
  const filePath = path.join(storageDir, localPath);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // ignore
  }
}
