import { nanoid } from "nanoid";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/dynamo.js";
import { T_CAMERAS } from "../lib/env.js";
import { handle, ok, err, parseBody } from "../lib/http.js";
import { presignPut } from "../lib/s3.js";
import { hashToken, tokensMatch } from "../lib/tokens.js";

type Body = { fileName: string; mimeType?: string; fileSize?: number };

// NOTE: we Scan `snaprelay-cameras` to find the row whose uploadTokenHash
// matches. Fine at demo scale. If it grows, add a GSI on uploadTokenHash.
export const handler = handle(async (event) => {
  const headers = event.headers || {};
  const token =
    headers["x-nexis-token"] ||
    headers["X-Nexis-Token"] ||
    "";
  if (!token) return err(401, "missing token");

  const b = parseBody<Body>(event);
  const fileName = (b.fileName || "").trim();
  if (!fileName) return err(400, "fileName required");
  const mimeType = b.mimeType || "application/octet-stream";

  const targetHash = hashToken(token);
  const scan = await ddb.send(new ScanCommand({
    TableName: T_CAMERAS,
    FilterExpression: "uploadTokenHash = :h AND #t = :phone",
    ExpressionAttributeValues: { ":h": targetHash, ":phone": "phone" },
    ExpressionAttributeNames: { "#t": "type" },
    Limit: 2,
  }));
  const cam = scan.Items?.[0];
  if (!cam || !tokensMatch(token, cam.uploadTokenHash as string)) {
    return err(401, "invalid token");
  }

  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const prefix = nanoid(8);
  const s3Key = `camera-inbox/${cam.cameraId}/${prefix}-${safe}`;
  const uploadUrl = await presignPut(s3Key, mimeType, 3600);

  return ok({
    uploadUrl,
    s3Key,
    expiresInSec: 3600,
    cameraId: cam.cameraId,
  });
});
