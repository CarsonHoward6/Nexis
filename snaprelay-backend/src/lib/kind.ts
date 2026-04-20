export type FileKind = "image" | "raw" | "other";

export function fileKindFor(mime: string, fileName: string): FileKind {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (/cr2|cr3|nef|arw|dng|raf|rw2|orf/.test(ext) || /raw/i.test(mime)) return "raw";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

export function s3KeyFor(userId: string, fileId: string, fileName: string) {
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `uploads/${userId}/${fileId}/${safe}`;
}

export function thumbKeyFor(userId: string, fileId: string) {
  return `thumbs/${userId}/${fileId}/thumb.jpg`;
}
