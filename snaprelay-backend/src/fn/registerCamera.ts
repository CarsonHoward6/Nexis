import { nanoid } from "nanoid";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { TransferClient, CreateUserCommand, ImportSshPublicKeyCommand } from "@aws-sdk/client-transfer";
import { ddb } from "../lib/dynamo.js";
import { REGION, T_CAMERAS, SFTP_SERVER_ID, SFTP_ROLE_ARN, BUCKET } from "../lib/env.js";
import { handle, ok, err, parseBody, requireAuth } from "../lib/http.js";
import { requireMember } from "../lib/groups.js";

type Body = { label: string; sshPublicKey: string };

const transfer = new TransferClient({ region: REGION });

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const groupId = event.pathParameters?.groupId;
  if (!groupId) return err(400, "groupId required");
  if (!SFTP_SERVER_ID || !SFTP_ROLE_ARN) return err(500, "SFTP server not configured");
  await requireMember(auth.sub, groupId);

  const b = parseBody<Body>(event);
  const label = (b.label || "").trim();
  const sshKey = (b.sshPublicKey || "").trim();
  if (!label) return err(400, "label required");
  if (!sshKey.startsWith("ssh-") && !sshKey.startsWith("ecdsa-")) {
    return err(400, "sshPublicKey must be an OpenSSH-format public key");
  }

  const cameraId = nanoid(12);
  const sftpUsername = `cam_${cameraId}`;
  const homeDirEntry = `/camera-inbox/${cameraId}`;

  await transfer.send(new CreateUserCommand({
    ServerId: SFTP_SERVER_ID,
    UserName: sftpUsername,
    Role: SFTP_ROLE_ARN,
    HomeDirectoryType: "LOGICAL",
    HomeDirectoryMappings: [{ Entry: "/", Target: `/${BUCKET}${homeDirEntry}` }],
  }));

  await transfer.send(new ImportSshPublicKeyCommand({
    ServerId: SFTP_SERVER_ID,
    UserName: sftpUsername,
    SshPublicKeyBody: sshKey,
  }));

  const now = new Date().toISOString();
  await ddb.send(new PutCommand({
    TableName: T_CAMERAS,
    Item: {
      cameraId,
      groupId,
      ownerSub: auth.sub,
      ownerEmail: auth.email || "",
      label,
      type: "sftp",
      sftpUsername,
      createdAt: now,
    },
  }));

  return ok({
    cameraId,
    label,
    type: "sftp",
    groupId,
    sftpUsername,
    host: `${SFTP_SERVER_ID}.server.transfer.${REGION}.amazonaws.com`,
    s3Path: `s3://${BUCKET}${homeDirEntry}/`,
    createdAt: now,
    ownerEmail: auth.email || "",
  });
});
