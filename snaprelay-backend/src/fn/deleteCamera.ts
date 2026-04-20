import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { TransferClient, DeleteUserCommand } from "@aws-sdk/client-transfer";
import { ddb } from "../lib/dynamo.js";
import { REGION, T_CAMERAS, SFTP_SERVER_ID } from "../lib/env.js";
import { handle, ok, err, requireAuth } from "../lib/http.js";

const transfer = new TransferClient({ region: REGION });

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const cameraId = event.pathParameters?.cameraId;
  if (!cameraId) return err(400, "cameraId required");

  const r = await ddb.send(new GetCommand({ TableName: T_CAMERAS, Key: { cameraId } }));
  const cam = r.Item;
  if (!cam) return err(404, "camera not found");
  if (cam.ownerSub !== auth.sub) return err(403, "only the owner can delete this camera");

  if (SFTP_SERVER_ID && cam.sftpUsername) {
    await transfer.send(new DeleteUserCommand({
      ServerId: SFTP_SERVER_ID,
      UserName: cam.sftpUsername,
    })).catch((e) => console.warn("delete-user failed (continuing)", e?.message));
  }

  await ddb.send(new DeleteCommand({ TableName: T_CAMERAS, Key: { cameraId } }));
  return ok({ deleted: true });
});
