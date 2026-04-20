import type { SQSEvent, SQSHandler } from "aws-lambda";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { ddb } from "../lib/dynamo.js";
import { s3 } from "../lib/s3.js";
import { BUCKET, T_CAMERAS, T_FILES } from "../lib/env.js";
import { fileKindFor } from "../lib/kind.js";

const mimeFromExt = (name: string): string => {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  if (ext === "cr2") return "image/x-canon-cr2";
  if (ext === "cr3") return "image/x-canon-cr3";
  if (ext === "nef") return "image/x-nikon-nef";
  if (ext === "arw") return "image/x-sony-arw";
  if (ext === "dng") return "image/x-adobe-dng";
  return "application/octet-stream";
};

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    let body: any;
    try {
      body = JSON.parse(rec.body);
    } catch {
      console.error("bad sqs body", rec.body);
      continue;
    }
    for (const r of body.Records || []) {
      const key = decodeURIComponent((r.s3?.object?.key || "").replace(/\+/g, " "));
      if (!key) continue;
      try {
        await handleKey(key);
      } catch (e) {
        console.error("handleKey failed", key, e);
      }
    }
  }
};

async function handleKey(key: string) {
  // Browser upload: uploads/{userId}/{fileId}/{filename}
  let m = key.match(/^uploads\/([^/]+)\/([^/]+)\//);
  if (m) {
    const fileId = m[2];
    const size = await headSize(key);
    await ddb.send(new UpdateCommand({
      TableName: T_FILES,
      Key: { fileId },
      UpdateExpression: "SET #s = :ready" + (size ? ", fileSize = :sz" : ""),
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: size ? { ":ready": "ready", ":sz": size } : { ":ready": "ready" },
    }));
    return;
  }

  // Camera SFTP: camera-inbox/{cameraId}/{filename}
  m = key.match(/^camera-inbox\/([^/]+)\/(.+)$/);
  if (m) {
    const [, cameraId, fileName] = m;
    const cam = await ddb.send(new GetCommand({ TableName: T_CAMERAS, Key: { cameraId } }));
    if (!cam.Item) {
      console.warn("unknown cameraId — skipping", cameraId, key);
      return;
    }
    const { ownerSub, groupId, label, ownerEmail } = cam.Item as {
      ownerSub: string;
      groupId: string;
      label: string;
      ownerEmail?: string;
    };
    const size = (await headSize(key)) ?? 0;
    const fileId = nanoid(21);
    const mimeType = mimeFromExt(fileName);
    const now = new Date().toISOString();
    await ddb.send(new PutCommand({
      TableName: T_FILES,
      Item: {
        fileId,
        id: fileId,
        userId: ownerSub,
        uploadedBy: label ? `${label} (camera)` : "camera",
        fileName,
        fileSize: size,
        mimeType,
        fileKind: fileKindFor(mimeType, fileName),
        s3Key: key,
        groupId,
        groupIdClient: groupId.startsWith("__mine__") ? null : groupId,
        isPublic: false,
        status: "ready",
        uploadedAt: now,
        source: "camera",
        cameraId,
        cameraLabel: label,
        cameraOwnerEmail: ownerEmail || "",
      },
    }));
    console.log("camera ingest ok", { fileId, cameraId, groupId, fileName });
    return;
  }

  console.log("skip unknown key", key);
}

async function headSize(key: string): Promise<number | undefined> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return head.ContentLength;
  } catch (e) {
    console.error("head failed", key, e);
    return undefined;
  }
}
