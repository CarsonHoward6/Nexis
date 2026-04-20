import { nanoid } from "nanoid";
import { PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_GROUPS, T_MEMBERS } from "../lib/env.js";
import { handle, ok, parseBody, requireAuth, err } from "../lib/http.js";

type Body = { name: string };

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const b = parseBody<Body>(event);
  const name = (b.name || "").trim();
  if (!name) return err(400, "name required");

  const groupId = nanoid(12);
  const now = new Date().toISOString();

  await ddb.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: T_GROUPS,
          Item: { groupId, name, ownerId: auth.sub, createdAt: now, memberCount: 1 },
        },
      },
      {
        Put: {
          TableName: T_MEMBERS,
          Item: { userId: auth.sub, groupId, role: "owner", joinedAt: now },
        },
      },
    ],
  }));

  return ok({ id: groupId, name, ownerId: auth.sub, role: "owner", createdAt: now, memberCount: 1 });
});
