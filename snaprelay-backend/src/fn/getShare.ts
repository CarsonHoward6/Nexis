import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_SHARES } from "../lib/env.js";
import { handle, ok, err } from "../lib/http.js";
import { presignGet } from "../lib/s3.js";

export const handler = handle(async (event) => {
  const shareId = event.pathParameters?.shareId;
  if (!shareId) return err(400, "shareId required");

  const s = await ddb.send(new GetCommand({ TableName: T_SHARES, Key: { shareId } }));
  if (!s.Item) return err(404, "share not found");
  if (Date.parse(s.Item.expiresAt) < Date.now()) return err(410, "share expired");
  if (!s.Item.s3Key) return err(410, "share predates schema update; create a new link");

  const downloadUrl = await presignGet(s.Item.s3Key, 3600, s.Item.fileName);

  ddb.send(new UpdateCommand({
    TableName: T_SHARES,
    Key: { shareId },
    UpdateExpression: "ADD downloadCount :one",
    ExpressionAttributeValues: { ":one": 1 },
  })).catch(() => {});

  return ok({
    fileName: s.Item.fileName,
    fileSize: s.Item.fileSize,
    uploadedBy: s.Item.uploadedBy,
    expiresAt: s.Item.expiresAt,
    downloadUrl,
    mimeType: s.Item.mimeType,
  });
});
