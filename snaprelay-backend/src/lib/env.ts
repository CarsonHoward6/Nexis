export const REGION = process.env.AWS_REGION || "us-east-1";
export const BUCKET = must("S3_BUCKET");
export const T_FILES = must("DYNAMODB_FILES_TABLE");
export const T_GROUPS = must("DYNAMODB_GROUPS_TABLE");
export const T_MEMBERS = must("DYNAMODB_MEMBERSHIPS_TABLE");
export const T_INVITES = must("DYNAMODB_INVITES_TABLE");
export const T_SHARES = must("DYNAMODB_SHARES_TABLE");

function must(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env ${key}`);
  return v;
}
