import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { REGION, T_CAMERAS, SFTP_SERVER_ID, BUCKET } from "../lib/env.js";
import { handle, ok, err, requireAuth } from "../lib/http.js";
import { requireMember } from "../lib/groups.js";

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const groupId = event.pathParameters?.groupId;
  if (!groupId) return err(400, "groupId required");
  await requireMember(auth.sub, groupId);

  const r = await ddb.send(new QueryCommand({
    TableName: T_CAMERAS,
    IndexName: "groupId-index",
    KeyConditionExpression: "groupId = :g",
    ExpressionAttributeValues: { ":g": groupId },
  }));

  const host = SFTP_SERVER_ID ? `${SFTP_SERVER_ID}.server.transfer.${REGION}.amazonaws.com` : "";

  return ok((r.Items || []).map((c: any) => ({
    cameraId: c.cameraId,
    label: c.label,
    type: (c.type as "sftp" | "phone") || "sftp",
    groupId: c.groupId,
    sftpUsername: c.sftpUsername || "",
    host,
    s3Path: `s3://${BUCKET}/camera-inbox/${c.cameraId}/`,
    createdAt: c.createdAt,
    ownerEmail: c.ownerEmail || "",
    isOwner: c.ownerSub === auth.sub,
  })));
});
