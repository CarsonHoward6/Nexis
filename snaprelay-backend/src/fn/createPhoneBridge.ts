import { nanoid } from "nanoid";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { REGION, T_CAMERAS } from "../lib/env.js";
import { handle, ok, err, parseBody, requireAuth } from "../lib/http.js";
import { requireMember } from "../lib/groups.js";
import { hashToken } from "../lib/tokens.js";

type Body = { label: string };

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const groupId = event.pathParameters?.groupId;
  if (!groupId) return err(400, "groupId required");
  await requireMember(auth.sub, groupId);

  const b = parseBody<Body>(event);
  const label = (b.label || "").trim();
  if (!label) return err(400, "label required");

  const cameraId = nanoid(12);
  const uploadToken = nanoid(40);
  const now = new Date().toISOString();

  await ddb.send(new PutCommand({
    TableName: T_CAMERAS,
    Item: {
      cameraId,
      groupId,
      ownerSub: auth.sub,
      ownerEmail: auth.email || "",
      label,
      type: "phone",
      sftpUsername: "",
      uploadTokenHash: hashToken(uploadToken),
      createdAt: now,
    },
  }));

  const apiBase =
    (event.requestContext?.domainName && event.requestContext?.stage)
      ? `https://${event.requestContext.domainName}/${event.requestContext.stage}`
      : `https://povaa3g701.execute-api.${REGION}.amazonaws.com/prod`;

  return ok({
    cameraId,
    label,
    type: "phone",
    groupId,
    uploadToken,
    presignUrl: `${apiBase}/phone/presign`,
    createdAt: now,
    ownerEmail: auth.email || "",
  });
});
