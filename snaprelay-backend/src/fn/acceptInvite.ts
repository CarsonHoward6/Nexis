import { GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_GROUPS, T_INVITES, T_MEMBERS } from "../lib/env.js";
import { handle, ok, requireAuth, err } from "../lib/http.js";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const code = event.pathParameters?.code;
  if (!code) return err(400, "code required");

  const inv = await ddb.send(new GetCommand({ TableName: T_INVITES, Key: { inviteCode: code } }));
  if (!inv.Item) return err(404, "invite not found");
  if (Date.parse(inv.Item.expiresAt) < Date.now()) return err(410, "invite expired");
  if (inv.Item.uses >= inv.Item.maxUses) return err(410, "invite exhausted");

  const groupId = inv.Item.groupId as string;
  const existing = await ddb.send(new GetCommand({ TableName: T_MEMBERS, Key: { userId: auth.sub, groupId } }));
  const now = new Date().toISOString();

  if (!existing.Item) {
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: T_MEMBERS,
            Item: { userId: auth.sub, groupId, role: "member", joinedAt: now },
            ConditionExpression: "attribute_not_exists(userId)",
          },
        },
        {
          Update: {
            TableName: T_GROUPS,
            Key: { groupId },
            UpdateExpression: "ADD memberCount :one",
            ExpressionAttributeValues: { ":one": 1 },
          },
        },
        {
          Update: {
            TableName: T_INVITES,
            Key: { inviteCode: code },
            UpdateExpression: "ADD uses :one",
            ExpressionAttributeValues: { ":one": 1 },
          },
        },
      ],
    }));
  }

  const g = await ddb.send(new GetCommand({ TableName: T_GROUPS, Key: { groupId } }));
  return ok({
    id: groupId,
    name: g.Item?.name || "(unknown)",
    ownerId: g.Item?.ownerId || "",
    role: existing.Item?.role || "member",
    createdAt: g.Item?.createdAt || now,
    memberCount: g.Item?.memberCount || 1,
  });
});
