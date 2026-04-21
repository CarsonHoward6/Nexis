import { nanoid } from "nanoid";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_FILES, T_SHARES } from "../lib/env.js";
import { handle, ok, parseBody, requireAuth, err } from "../lib/http.js";

// URL is composed on the frontend; backend returns a relative path.

type Body = { expiresInSec?: number };

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const fileId = event.pathParameters?.id;
  if (!fileId) return err(400, "fileId required");

  const b = parseBody<Body>(event);
  const ttlSec = Math.min(Math.max(b.expiresInSec || 3600, 60), 30 * 24 * 3600);

  const f = await ddb.send(new GetCommand({
    TableName: T_FILES,
    Key: { userId: auth.sub, fileId },
  }));
  if (!f.Item) return err(404, "file not found");

  const shareId = nanoid(16);
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  const ttl = Math.floor(Date.parse(expiresAt) / 1000);

  // Denormalize the file fields into the share row so getShare is self-contained.
  await ddb.send(new PutCommand({
    TableName: T_SHARES,
    Item: {
      shareId,
      fileId,
      s3Key: f.Item.s3Key,
      fileName: f.Item.fileName,
      fileSize: f.Item.fileSize,
      mimeType: f.Item.mimeType,
      uploadedBy: f.Item.uploadedBy,
      groupId: f.Item.groupId,
      createdBy: auth.sub,
      expiresAt,
      ttl,
      downloadCount: 0,
    },
  }));

  return ok({ shareId, url: `/s/${shareId}`, expiresAt });
});
