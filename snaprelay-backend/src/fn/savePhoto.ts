import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_FILES } from "../lib/env.js";
import { handle, ok, parseBody, requireAuth } from "../lib/http.js";
import { fileKindFor } from "../lib/kind.js";
import { requireMember } from "../lib/groups.js";

type Body = {
  fileId: string;
  s3Key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  groupId: string | null;
  isPublic?: boolean;
  thumbnailDataUrl?: string;
};

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const b = parseBody<Body>(event);
  if (!b.fileId || !b.s3Key || !b.fileName) return ok({ error: "missing fields" }, 400);
  if (b.groupId) await requireMember(auth.sub, b.groupId);

  const now = new Date().toISOString();
  const groupId = b.groupId || `__mine__${auth.sub}`;
  const item = {
    fileId: b.fileId,
    id: b.fileId,
    userId: auth.sub,
    uploadedBy: auth.email || auth.sub,
    fileName: b.fileName,
    fileSize: b.fileSize,
    mimeType: b.mimeType,
    fileKind: fileKindFor(b.mimeType, b.fileName),
    s3Key: b.s3Key,
    groupId,
    groupIdClient: b.groupId ?? null,
    isPublic: !!b.isPublic,
    status: "processing" as const,
    uploadedAt: now,
    thumbnailDataUrl: b.thumbnailDataUrl,
  };
  await ddb.send(new PutCommand({ TableName: T_FILES, Item: item }));
  return ok(item);
});
