import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BUCKET, REGION } from "./env.js";

export const s3 = new S3Client({ region: REGION });

export async function presignPut(key: string, contentType: string, ttl = 3600) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: ttl });
}

export async function presignGet(key: string, ttl = 3600, filename?: string) {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/"/g, "")}"` : undefined,
  });
  return getSignedUrl(s3, cmd, { expiresIn: ttl });
}
