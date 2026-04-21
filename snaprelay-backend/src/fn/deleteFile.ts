import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { ddb } from "../lib/dynamo.js";
import { s3 } from "../lib/s3.js";
import { BUCKET, T_FILES } from "../lib/env.js";
import { handle, ok, requireAuth, err } from "../lib/http.js";
import { isMember } from "../lib/groups.js";

// Anyone in the file's group can delete the file. For private files
// (groupId starts with __mine__) only the owner can delete.
export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const fileId = event.pathParameters?.id;
  if (!fileId) return err(400, "fileId required");

  const ownerId = event.queryStringParameters?.userId;
  if (!ownerId) return err(400, "userId required");

  const r = await ddb.send(new GetCommand({
    TableName: T_FILES,
    Key: { userId: ownerId, fileId },
  }));
  const item = r.Item;
  if (!item) return err(404, "not found");

  const groupId = item.groupId as string;
  const isOwner = ownerId === auth.sub;

  if (!isOwner) {
    if (!groupId || groupId.startsWith("__mine__")) {
      return err(403, "private file — only the owner can delete");
    }
    if (!(await isMember(auth.sub, groupId))) {
      return err(403, "must be a member of this group to delete");
    }
  }

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: item.s3Key })).catch(() => {});
  await ddb.send(new DeleteCommand({
    TableName: T_FILES,
    Key: { userId: ownerId, fileId },
  }));

  return ok({ deleted: true });
});
