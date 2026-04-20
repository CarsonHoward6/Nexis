import type { SQSEvent, SQSHandler } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { ddb } from "../lib/dynamo.js";
import { s3 } from "../lib/s3.js";
import { BUCKET, T_FILES } from "../lib/env.js";

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const rec of event.Records) {
    let body: any;
    try {
      body = JSON.parse(rec.body);
    } catch {
      console.error("bad sqs body", rec.body);
      continue;
    }
    const s3Records = body.Records || [];
    for (const r of s3Records) {
      const key = decodeURIComponent((r.s3?.object?.key || "").replace(/\+/g, " "));
      if (!key) continue;
      const m = key.match(/^uploads\/([^/]+)\/([^/]+)\//);
      if (!m) {
        console.log("skip non-upload key", key);
        continue;
      }
      const fileId = m[2];

      let size: number | undefined;
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        size = head.ContentLength;
      } catch (e) {
        console.error("head failed", key, e);
      }

      await ddb.send(new UpdateCommand({
        TableName: T_FILES,
        Key: { fileId },
        UpdateExpression: "SET #s = :ready" + (size ? ", fileSize = :sz" : ""),
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: size
          ? { ":ready": "ready", ":sz": size }
          : { ":ready": "ready" },
      })).catch((e) => console.error("update failed", fileId, e));
    }
  }
};
