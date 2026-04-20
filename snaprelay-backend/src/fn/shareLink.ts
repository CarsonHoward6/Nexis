import { nanoid } from "nanoid";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_FILES, T_SHARES } from "../lib/env.js";
import { handle, ok, parseBody, requireAuth, err } from "../lib/http.js";

const APP_URL = process.env.APP_URL || "";

type Body = { expiresInSec?: number };

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const fileId = event.pathParameters?.id;
  if (!fileId) return err(400, "fileId required");

  const b = parseBody<Body>(event);
  const ttlSec = Math.min(Math.max(b.expiresInSec || 3600, 60), 30 * 24 * 3600);

  const f = await ddb.send(new GetCommand({ TableName: T_FILES, Key: { fileId } }));
  if (!f.Item) return err(404, "file not found");
  if (f.Item.userId !== auth.sub) return err(403, "not owner");

  const shareId = nanoid(16);
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  const ttl = Math.floor(Date.parse(expiresAt) / 1000);

  await ddb.send(new PutCommand({
    TableName: T_SHARES,
    Item: {
      shareId,
      fileId,
      groupId: f.Item.groupId,
      createdBy: auth.sub,
      expiresAt,
      ttl,
      downloadCount: 0,
    },
  }));

  return ok({
    shareId,
    url: APP_URL ? `${APP_URL}/s/${shareId}` : `/s/${shareId}`,
    expiresAt,
  });
});
