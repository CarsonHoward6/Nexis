import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_FILES } from "../lib/env.js";
import { handle, ok, requireAuth } from "../lib/http.js";
import { requireMember } from "../lib/groups.js";
import { presignGet } from "../lib/s3.js";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const qs = event.queryStringParameters || {};
  const groupParam = qs.groupId || null;
  const groupId = groupParam ? groupParam : `__mine__${auth.sub}`;

  if (groupParam) await requireMember(auth.sub, groupParam);

  const r = await ddb.send(new QueryCommand({
    TableName: T_FILES,
    IndexName: "groupId-uploadedAt-index",
    KeyConditionExpression: "groupId = :g",
    ExpressionAttributeValues: { ":g": groupId },
    ScanIndexForward: false,
    Limit: 100,
  }));

  const items = await Promise.all((r.Items || []).map(async (raw) => {
    const base = reshape(raw);
    if (base.status !== "ready" || !raw.s3Key) return base;
    const [previewUrl, downloadUrl] = await Promise.all([
      presignGet(raw.s3Key, 3600),
      presignGet(raw.s3Key, 3600, raw.fileName),
    ]);
    return { ...base, previewUrl, downloadUrl };
  }));
  return ok(items);
});

function reshape(i: any) {
  return {
    id: i.fileId ?? i.id,
    userId: i.userId,
    uploadedBy: i.uploadedBy,
    fileName: i.fileName,
    fileSize: i.fileSize,
    fileKind: i.fileKind,
    mimeType: i.mimeType,
    s3Key: i.s3Key,
    thumbnailDataUrl: i.thumbnailDataUrl,
    groupId: i.groupIdClient ?? null,
    status: i.status,
    uploadedAt: i.uploadedAt,
    isPublic: !!i.isPublic,
    source: i.source || "browser",
    cameraId: i.cameraId,
    cameraLabel: i.cameraLabel,
    cameraOwnerEmail: i.cameraOwnerEmail,
  };
}
