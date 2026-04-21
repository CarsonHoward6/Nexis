import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { TransferClient, DeleteUserCommand } from "@aws-sdk/client-transfer";
import { ddb } from "../lib/dynamo.js";
import { s3 } from "../lib/s3.js";
import {
  BUCKET,
  REGION,
  SFTP_SERVER_ID,
  T_CAMERAS,
  T_FILES,
  T_GROUPS,
  T_MEMBERS,
} from "../lib/env.js";
import { handle, ok, err, requireAuth } from "../lib/http.js";

const transfer = new TransferClient({ region: REGION });

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const groupId = event.pathParameters?.groupId;
  if (!groupId) return err(400, "groupId required");

  const g = await ddb.send(new GetCommand({ TableName: T_GROUPS, Key: { groupId } }));
  if (!g.Item) return err(404, "group not found");
  if (g.Item.ownerId !== auth.sub) return err(403, "only the owner can delete this group");

  // 1. gather all files in the group (via GSI)
  const files = await ddb.send(new QueryCommand({
    TableName: T_FILES,
    IndexName: "groupId-uploadedAt-index",
    KeyConditionExpression: "groupId = :g",
    ExpressionAttributeValues: { ":g": groupId },
  }));

  // 2. delete S3 objects in batches of 1000 (S3 DeleteObjects limit)
  const s3Keys = (files.Items || []).map((f) => ({ Key: f.s3Key as string })).filter((o) => !!o.Key);
  for (let i = 0; i < s3Keys.length; i += 1000) {
    const chunk = s3Keys.slice(i, i + 1000);
    if (chunk.length === 0) break;
    await s3
      .send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: chunk, Quiet: true } }))
      .catch((e) => console.warn("S3 DeleteObjects partial failure", e?.message));
  }

  // 3. delete file rows (requires composite key userId+fileId)
  await batchDelete(
    T_FILES,
    (files.Items || []).map((f) => ({ userId: f.userId as string, fileId: f.fileId as string })),
  );

  // 4. gather memberships via GSI, delete
  const members = await ddb.send(new QueryCommand({
    TableName: T_MEMBERS,
    IndexName: "groupId-index",
    KeyConditionExpression: "groupId = :g",
    ExpressionAttributeValues: { ":g": groupId },
  }));
  await batchDelete(
    T_MEMBERS,
    (members.Items || []).map((m) => ({ userId: m.userId as string, groupId: m.groupId as string })),
  );

  // 5. cameras in this group — delete Transfer Family users for SFTP cameras, then DDB
  const cameras = await ddb.send(new QueryCommand({
    TableName: T_CAMERAS,
    IndexName: "groupId-index",
    KeyConditionExpression: "groupId = :g",
    ExpressionAttributeValues: { ":g": groupId },
  }));
  for (const c of cameras.Items || []) {
    if (c.type !== "phone" && SFTP_SERVER_ID && c.sftpUsername) {
      await transfer
        .send(new DeleteUserCommand({ ServerId: SFTP_SERVER_ID, UserName: c.sftpUsername as string }))
        .catch((e) => console.warn("delete SFTP user failed", c.sftpUsername, e?.message));
    }
  }
  await batchDelete(
    T_CAMERAS,
    (cameras.Items || []).map((c) => ({ cameraId: c.cameraId as string })),
  );

  // 6. the group row itself
  await ddb.send(new DeleteCommand({ TableName: T_GROUPS, Key: { groupId } }));

  return ok({
    deleted: true,
    filesRemoved: (files.Items || []).length,
    membershipsRemoved: (members.Items || []).length,
    camerasRemoved: (cameras.Items || []).length,
  });
});

async function batchDelete(table: string, keys: Record<string, string>[]) {
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = keys.slice(i, i + 25);
    if (chunk.length === 0) break;
    await ddb
      .send(new BatchWriteCommand({
        RequestItems: { [table]: chunk.map((k) => ({ DeleteRequest: { Key: k } })) },
      }))
      .catch((e) => console.warn(`BatchWrite delete on ${table} failed`, e?.message));
  }
}
