import { nanoid } from "nanoid";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_GROUPS, T_INVITES } from "../lib/env.js";
import { handle, ok, requireAuth, err } from "../lib/http.js";
import { requireMember } from "../lib/groups.js";

const APP_URL = process.env.APP_URL || "";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const groupId = event.pathParameters?.groupId;
  if (!groupId) return err(400, "groupId required");
  await requireMember(auth.sub, groupId);

  const g = await ddb.send(new GetCommand({ TableName: T_GROUPS, Key: { groupId } }));
  if (!g.Item) return err(404, "group not found");

  const inviteCode = nanoid(10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const ttl = Math.floor(Date.parse(expiresAt) / 1000);

  await ddb.send(new PutCommand({
    TableName: T_INVITES,
    Item: { inviteCode, groupId, createdBy: auth.sub, expiresAt, ttl, maxUses: 100, uses: 0 },
  }));

  return ok({
    inviteCode,
    url: APP_URL ? `${APP_URL}/join/${inviteCode}` : `/join/${inviteCode}`,
    groupId,
    groupName: g.Item.name,
    expiresAt,
  });
});
