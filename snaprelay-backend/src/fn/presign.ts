import { nanoid } from "nanoid";
import { handle, ok, parseBody, requireAuth } from "../lib/http.js";
import { presignPut } from "../lib/s3.js";
import { s3KeyFor, fileKindFor } from "../lib/kind.js";
import { requireMember } from "../lib/groups.js";

type Body = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  groupId: string | null;
  isPublic?: boolean;
};

export const handler = handle(async (event) => {
  const auth = requireAuth(event);
  const b = parseBody<Body>(event);
  if (!b.fileName || !b.mimeType || typeof b.fileSize !== "number") {
    return ok({ error: "fileName, mimeType, fileSize required" }, 400);
  }
  if (b.groupId) await requireMember(auth.sub, b.groupId);

  const fileId = nanoid(21);
  const s3Key = s3KeyFor(auth.sub, fileId, b.fileName);
  const uploadUrl = await presignPut(s3Key, b.mimeType, 3600);

  return ok({
    fileId,
    s3Key,
    uploadUrl,
    fileKind: fileKindFor(b.mimeType, b.fileName),
  });
});
