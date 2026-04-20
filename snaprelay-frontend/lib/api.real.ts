import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
} from "aws-amplify/auth";
import { configureAmplify } from "./amplify";
import type {
  User,
  Group,
  FileItem,
  PresignResult,
  ShareLink,
  PublicShare,
  Invite,
} from "./types";

configureAmplify();

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
if (!API_URL && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_URL is empty — real API calls will fail");
}

async function authHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error("Not authenticated");
  return { authorization: `Bearer ${token}` };
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== false) Object.assign(headers, await authHeader());
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json as T;
}

// ---- auth ----

async function currentUserOrNull(): Promise<User | null> {
  try {
    const u = await amplifyGetCurrentUser();
    let email = "";
    let displayName = u.username || "";
    try {
      const attrs = await fetchUserAttributes();
      email = attrs.email || "";
      displayName = (attrs.preferred_username || attrs.email || u.username || "").split("@")[0];
    } catch {
      /* attrs may fail immediately after signIn */
    }
    return { id: u.userId, email, displayName };
  } catch {
    return null;
  }
}

// ---- api ----

export const realApi = {
  async signUp(email: string, password: string) {
    await amplifySignUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
    return { email };
  },

  async confirmSignUp(email: string, code: string) {
    await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    return { id: email };
  },

  async signIn(email: string, password: string): Promise<User> {
    try {
      await amplifySignOut().catch(() => {});
      await amplifySignIn({
        username: email,
        password,
        options: { authFlowType: "USER_PASSWORD_AUTH" },
      });
    } catch (e: any) {
      throw new Error(e?.message || "Sign-in failed");
    }
    const u = await currentUserOrNull();
    if (!u) throw new Error("Sign-in succeeded but session not available");
    return { ...u, email: u.email || email, displayName: u.displayName || email.split("@")[0] };
  },

  async signOut() {
    await amplifySignOut().catch(() => {});
  },

  async getCurrentUser(): Promise<User | null> {
    return currentUserOrNull();
  },

  async listMyGroups(): Promise<Group[]> {
    return req<Group[]>("GET", "/groups");
  },

  async createGroup(name: string): Promise<Group> {
    return req<Group>("POST", "/groups", { name });
  },

  async createInvite(groupId: string): Promise<Invite> {
    const r = await req<Invite>("POST", `/groups/${groupId}/invites`);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { ...r, url: r.url?.startsWith("http") ? r.url : `${origin}/join/${r.inviteCode}` };
  },

  async acceptInvite(inviteCode: string): Promise<Group> {
    return req<Group>("POST", `/invites/${inviteCode}/accept`);
  },

  async presignUpload(args: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    groupId: string | null;
    isPublic: boolean;
  }): Promise<PresignResult> {
    return req<PresignResult>("POST", "/upload/presign", args);
  },

  async savePhoto(args: {
    fileId: string;
    s3Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    groupId: string | null;
    isPublic: boolean;
    thumbnailDataUrl?: string;
  }): Promise<FileItem> {
    return req<FileItem>("POST", "/files", args);
  },

  async listFiles(groupId?: string | null): Promise<FileItem[]> {
    const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
    return req<FileItem[]>("GET", `/files${qs}`);
  },

  async deleteFile(fileId: string) {
    await req<{ deleted: boolean }>("DELETE", `/files/${encodeURIComponent(fileId)}`);
  },

  async createShareLink(fileId: string, expiresInSec: number): Promise<ShareLink> {
    const r = await req<ShareLink>("POST", `/files/${encodeURIComponent(fileId)}/share`, {
      expiresInSec,
    });
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { ...r, url: r.url?.startsWith("http") ? r.url : `${origin}/s/${r.shareId}` };
  },

  async getPublicShare(shareId: string): Promise<PublicShare> {
    return req<PublicShare>("GET", `/shares/${encodeURIComponent(shareId)}`, undefined, {
      auth: false,
    });
  },
} satisfies typeof import("./api.mock").mockApi;
