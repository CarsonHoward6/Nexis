export type User = {
  id: string;
  email: string;
  displayName: string;
};

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  role: "owner" | "member";
  createdAt: string;
  memberCount: number;
};

export type FileStatus = "processing" | "ready" | "error";

export type FileKind = "image" | "raw" | "other";

export type FileItem = {
  id: string;
  userId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  fileKind: FileKind;
  mimeType: string;
  s3Key: string;
  thumbnailDataUrl?: string;
  groupId: string | null;
  status: FileStatus;
  uploadedAt: string;
  isPublic: boolean;
};

export type PresignResult = {
  fileId: string;
  s3Key: string;
  uploadUrl: string;
};

export type ShareLink = {
  shareId: string;
  url: string;
  expiresAt: string;
};

export type PublicShare = {
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  expiresAt: string;
  downloadUrl: string;
  mimeType: string;
};

export type Invite = {
  inviteCode: string;
  url: string;
  groupId: string;
  groupName: string;
  expiresAt: string;
};
