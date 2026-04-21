import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ddb } from "../lib/dynamo.js";
import { s3 } from "../lib/s3.js";
import { BUCKET, T_FILES } from "../lib/env.js";
import { handle, ok, requireAuth, err } from "../lib/http.js";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const fileId = event.pathParameters?.id;
  if (!fileId) return err(400, "fileId required");

  const r = await ddb.send(new GetCommand({
    TableName: T_FILES,
    Key: { userId: auth.sub, fileId },
  }));
  const item = r.Item;
  if (!item) return err(404, "not found");

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.s3Key })).catch(() => {});
  await ddb.send(new DeleteCommand({
    TableName: T_FILES,
    Key: { userId: auth.sub, fileId },
  }));

  return ok({ deleted: true });
});
