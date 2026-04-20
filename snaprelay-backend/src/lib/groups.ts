import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./dynamo.js";
import { T_MEMBERS } from "./env.js";

export async function isMember(userId: string, groupId: string): Promise<boolean> {
  const r = await ddb.send(new GetCommand({ TableName: T_MEMBERS, Key: { userId, groupId } }));
  return !!r.Item;
}

export async function requireMember(userId: string, groupId: string) {
  if (!(await isMember(userId, groupId))) {
    throw Object.assign(new Error("Not a member of this group"), { status: 403 });
  }
}
