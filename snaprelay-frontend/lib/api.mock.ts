import type {
  FileItem,
  FileKind,
  Group,
  Invite,
  PresignResult,
  PublicShare,
  ShareLink,
  User,
} from "./types";

const SESSION_KEY = "snaprelay:mock:session";
const STORE_KEY = "snaprelay:mock:store";

type PendingSignup = { email: string; password: string; code: string };

type MockStore = {
  users: Record<string, User & { password: string }>;
  pendingSignups: Record<string, PendingSignup>;
  groups: Record<string, Group & { members: string[] }>;
  memberships: Record<string, string[]>; // userId → groupIds
  files: Record<string, FileItem>;
  invites: Record<string, { groupId: string; expiresAt: string }>;
  shares: Record<string, { fileId: string; expiresAt: string }>;
};

function emptyStore(): MockStore {
  return {
    users: {},
    pendingSignups: {},
    groups: {},
    memberships: {},
    files: {},
    invites: {},
    shares: {},
  };
}

function loadStore(): MockStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as MockStore;
  } catch {}
  const seeded = seed(emptyStore());
  saveStore(seeded);
  return seeded;
}

function saveStore(store: MockStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function seed(store: MockStore): MockStore {
  const demoUser: User & { password: string } = {
    id: "user-demo",
    email: "demo@snaprelay.dev",
    displayName: "Demo User",
    password: "password123",
  };
  const alice: User & { password: string } = {
    id: "user-alice",
    email: "alice@example.com",
    displayName: "Alice",
    password: "password123",
  };
  store.users[demoUser.id] = demoUser;
  store.users[alice.id] = alice;

  const weddingGroup: Group & { members: string[] } = {
    id: "group-wedding",
    name: "Smith Wedding",
    ownerId: demoUser.id,
    role: "owner",
    createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    memberCount: 2,
    members: [demoUser.id, alice.id],
  };
  const sportsGroup: Group & { members: string[] } = {
    id: "group-sports",
    name: "Varsity Track",
    ownerId: alice.id,
    role: "member",
    createdAt: new Date(Date.now() - 86_400_000 * 7).toISOString(),
    memberCount: 1,
    members: [alice.id],
  };
  store.groups[weddingGroup.id] = weddingGroup;
  store.groups[sportsGroup.id] = sportsGroup;
  store.memberships[demoUser.id] = [weddingGroup.id];
  store.memberships[alice.id] = [weddingGroup.id, sportsGroup.id];

  const sampleFiles: FileItem[] = [
    {
      id: "file-1",
      userId: alice.id,
      uploadedBy: alice.displayName,
      fileName: "ceremony-01.jpg",
      fileSize: 4_200_000,
      fileKind: "image",
      mimeType: "image/jpeg",
      s3Key: "files/file-1.jpg",
      groupId: weddingGroup.id,
      status: "ready",
      uploadedAt: new Date(Date.now() - 3_600_000 * 2).toISOString(),
      isPublic: false,
    },
    {
      id: "file-2",
      userId: demoUser.id,
      uploadedBy: demoUser.displayName,
      fileName: "IMG_0423.CR3",
      fileSize: 28_400_000,
      fileKind: "raw",
      mimeType: "image/x-canon-cr3",
      s3Key: "files/file-2.cr3",
      groupId: weddingGroup.id,
      status: "ready",
      uploadedAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
      isPublic: false,
    },
    {
      id: "file-3",
      userId: demoUser.id,
      uploadedBy: demoUser.displayName,
      fileName: "first-dance.jpg",
      fileSize: 3_100_000,
      fileKind: "image",
      mimeType: "image/jpeg",
      s3Key: "files/file-3.jpg",
      groupId: weddingGroup.id,
      status: "ready",
      uploadedAt: new Date(Date.now() - 3_600_000 * 8).toISOString(),
      isPublic: false,
    },
  ];
  for (const f of sampleFiles) store.files[f.id] = f;

  return store;
}

function delay<T>(value: T, ms = 280): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function kindFromMime(mime: string): FileKind {
  if (mime.startsWith("image/")) {
    if (/cr2|cr3|nef|arw|dng|raf|rw2|orf/i.test(mime)) return "raw";
    return "image";
  }
  return "other";
}

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

function setSession(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) window.localStorage.setItem(SESSION_KEY, userId);
  else window.localStorage.removeItem(SESSION_KEY);
}

function requireUser(): User {
  const store = loadStore();
  const id = getSession();
  if (!id || !store.users[id]) throw new Error("Not authenticated");
  const u = store.users[id];
  return { id: u.id, email: u.email, displayName: u.displayName };
}

function toPublicGroup(g: Group & { members: string[] }, userId: string): Group {
  return {
    id: g.id,
    name: g.name,
    ownerId: g.ownerId,
    role: g.ownerId === userId ? "owner" : "member",
    createdAt: g.createdAt,
    memberCount: g.members.length,
  };
}

export const mockApi = {
  async signUp(email: string, password: string) {
    const store = loadStore();
    if (Object.values(store.users).some((u) => u.email === email)) {
      throw new Error("Email already registered");
    }
    store.pendingSignups[email] = { email, password, code: "123456" };
    saveStore(store);
    return delay({ email });
  },

  async confirmSignUp(email: string, code: string) {
    const store = loadStore();
    const pending = store.pendingSignups[email];
    if (!pending) throw new Error("No pending signup for that email");
    if (code !== pending.code) throw new Error("Invalid verification code");
    const id = uid("user");
    store.users[id] = {
      id,
      email: pending.email,
      displayName: email.split("@")[0],
      password: pending.password,
    };
    delete store.pendingSignups[email];
    saveStore(store);
    return delay({ id });
  },

  async signIn(email: string, password: string): Promise<User> {
    const store = loadStore();
    const user = Object.values(store.users).find((u) => u.email === email);
    if (!user || user.password !== password) {
      await delay(null, 400);
      throw new Error("Invalid email or password");
    }
    setSession(user.id);
    return delay({ id: user.id, email: user.email, displayName: user.displayName });
  },

  async signOut() {
    setSession(null);
    return delay(undefined);
  },

  async getCurrentUser(): Promise<User | null> {
    const id = getSession();
    if (!id) return null;
    const store = loadStore();
    const u = store.users[id];
    if (!u) return null;
    return { id: u.id, email: u.email, displayName: u.displayName };
  },

  async listMyGroups(): Promise<Group[]> {
    const me = requireUser();
    const store = loadStore();
    const ids = store.memberships[me.id] ?? [];
    return delay(ids.map((id) => toPublicGroup(store.groups[id], me.id)).filter(Boolean));
  },

  async createGroup(name: string): Promise<Group> {
    const me = requireUser();
    const store = loadStore();
    const id = uid("group");
    const g: Group & { members: string[] } = {
      id,
      name,
      ownerId: me.id,
      role: "owner",
      createdAt: new Date().toISOString(),
      memberCount: 1,
      members: [me.id],
    };
    store.groups[id] = g;
    store.memberships[me.id] = [...(store.memberships[me.id] ?? []), id];
    saveStore(store);
    return delay(toPublicGroup(g, me.id));
  },

  async createInvite(groupId: string): Promise<Invite> {
    const me = requireUser();
    const store = loadStore();
    const g = store.groups[groupId];
    if (!g) throw new Error("Group not found");
    if (g.ownerId !== me.id) throw new Error("Only the owner can invite");
    const code = uid("inv").replace("inv-", "");
    const expiresAt = new Date(Date.now() + 86_400_000 * 7).toISOString();
    store.invites[code] = { groupId, expiresAt };
    saveStore(store);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return delay({
      inviteCode: code,
      url: `${origin}/join/${code}`,
      groupId,
      groupName: g.name,
      expiresAt,
    });
  },

  async acceptInvite(inviteCode: string): Promise<Group> {
    const me = requireUser();
    const store = loadStore();
    const inv = store.invites[inviteCode];
    if (!inv) throw new Error("Invite not found or expired");
    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      delete store.invites[inviteCode];
      saveStore(store);
      throw new Error("Invite has expired");
    }
    const g = store.groups[inv.groupId];
    if (!g) throw new Error("Group no longer exists");
    if (!g.members.includes(me.id)) {
      g.members.push(me.id);
      g.memberCount = g.members.length;
    }
    store.memberships[me.id] = Array.from(
      new Set([...(store.memberships[me.id] ?? []), g.id]),
    );
    delete store.invites[inviteCode];
    saveStore(store);
    return delay(toPublicGroup(g, me.id));
  },

  async presignUpload(args: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    groupId: string | null;
    isPublic: boolean;
  }): Promise<PresignResult> {
    requireUser();
    const fileId = uid("file");
    const ext = args.fileName.split(".").pop() ?? "bin";
    const s3Key = `files/${fileId}.${ext}`;
    return delay({
      fileId,
      s3Key,
      uploadUrl: `mock://upload/${fileId}`,
    });
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
    const me = requireUser();
    const store = loadStore();
    const item: FileItem = {
      id: args.fileId,
      userId: me.id,
      uploadedBy: me.displayName,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileKind: kindFromMime(args.mimeType),
      mimeType: args.mimeType,
      s3Key: args.s3Key,
      thumbnailDataUrl: args.thumbnailDataUrl,
      groupId: args.groupId,
      status: "processing",
      uploadedAt: new Date().toISOString(),
      isPublic: args.isPublic,
    };
    store.files[item.id] = item;
    saveStore(store);
    // Simulate SQS → processUpload flipping status to "ready" after ~2s.
    setTimeout(() => {
      const fresh = loadStore();
      if (fresh.files[item.id]) {
        fresh.files[item.id] = { ...fresh.files[item.id], status: "ready" };
        saveStore(fresh);
      }
    }, 2000);
    return delay(item);
  },

  async listFiles(groupId?: string | null): Promise<FileItem[]> {
    const me = requireUser();
    const store = loadStore();
    const all = Object.values(store.files);
    let filtered: FileItem[];
    if (groupId) {
      // membership check
      const membership = store.memberships[me.id] ?? [];
      if (!membership.includes(groupId)) throw new Error("Not a member of this group");
      filtered = all.filter((f) => f.groupId === groupId);
    } else {
      filtered = all.filter((f) => f.userId === me.id);
    }
    filtered.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return delay(filtered);
  },

  async deleteFile(fileId: string) {
    const me = requireUser();
    const store = loadStore();
    const f = store.files[fileId];
    if (!f) throw new Error("File not found");
    if (f.userId !== me.id) throw new Error("Only the uploader can delete");
    delete store.files[fileId];
    saveStore(store);
    return delay(undefined);
  },

  async createShareLink(
    fileId: string,
    expiresInSec: number,
  ): Promise<ShareLink> {
    requireUser();
    const store = loadStore();
    if (!store.files[fileId]) throw new Error("File not found");
    const shareId = uid("share").replace("share-", "");
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();
    store.shares[shareId] = { fileId, expiresAt };
    saveStore(store);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return delay({ shareId, url: `${origin}/s/${shareId}`, expiresAt });
  },

  async getPublicShare(shareId: string): Promise<PublicShare> {
    const store = loadStore();
    const sh = store.shares[shareId];
    if (!sh) throw new Error("Share link not found or expired");
    if (new Date(sh.expiresAt).getTime() < Date.now()) {
      throw new Error("This share link has expired");
    }
    const f = store.files[sh.fileId];
    if (!f) throw new Error("File no longer exists");
    return delay({
      fileName: f.fileName,
      fileSize: f.fileSize,
      uploadedBy: f.uploadedBy,
      expiresAt: sh.expiresAt,
      downloadUrl: `mock://download/${f.id}`,
      mimeType: f.mimeType,
    });
  },
};
