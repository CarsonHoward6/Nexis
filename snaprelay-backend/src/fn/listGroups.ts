import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_GROUPS, T_MEMBERS } from "../lib/env.js";
import { handle, ok, requireAuth } from "../lib/http.js";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);

  const memberships = await ddb.send(new QueryCommand({
    TableName: T_MEMBERS,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": auth.sub },
  }));

  const rows = memberships.Items || [];
  if (rows.length === 0) return ok([]);

  const keys = rows.map((m: any) => ({ groupId: m.groupId }));
  const batches: any[][] = [];
  for (let i = 0; i < keys.length; i += 100) batches.push(keys.slice(i, i + 100));

  const groups: Record<string, any> = {};
  for (const batch of batches) {
    const r = await ddb.send(new BatchGetCommand({
      RequestItems: { [T_GROUPS]: { Keys: batch } },
    }));
    for (const g of r.Responses?.[T_GROUPS] || []) groups[g.groupId] = g;
  }

  return ok(rows.map((m: any) => {
    const g = groups[m.groupId] || {};
    return {
      id: m.groupId,
      name: g.name || "(unknown)",
      ownerId: g.ownerId || "",
      role: m.role,
      createdAt: g.createdAt || m.joinedAt,
      memberCount: g.memberCount || 1,
    };
  }));
});
