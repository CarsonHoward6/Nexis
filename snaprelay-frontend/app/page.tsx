"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "@/components/AuthGate";
import { GroupSidebar, type GroupSelection } from "@/components/GroupSidebar";
import { UploadZone } from "@/components/UploadZone";
import { FileGrid } from "@/components/FileGrid";
import { FileModal } from "@/components/FileModal";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { InviteDialog } from "@/components/InviteDialog";
import { ShareDialog } from "@/components/ShareDialog";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { FileItem, Group } from "@/lib/types";

export default function GalleryPage() {
  return (
    <AuthGate>
      <Gallery />
    </AuthGate>
  );
}

function Gallery() {
  const { user, signOut } = useAuth();
  const [selection, setSelection] = useState<GroupSelection>({ kind: "mine" });
  const [openFile, setOpenFile] = useState<FileItem | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [inviteGroup, setInviteGroup] = useState<Group | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.listMyGroups(),
  });

  const activeGroup =
    selection.kind === "group"
      ? groups.find((g) => g.id === selection.groupId) ?? null
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-divider bg-bg">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-text-secondary sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 py-6 md:flex-row md:gap-8 md:py-10">
        <GroupSidebar
          selection={selection}
          onSelect={setSelection}
          onCreate={() => setCreateGroupOpen(true)}
          onInvite={setInviteGroup}
        />
        <section className="flex flex-1 flex-col gap-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {activeGroup ? activeGroup.name : "My files"}
              </h1>
              <p className="text-sm text-text-secondary">
                {activeGroup
                  ? `Shared with ${activeGroup.memberCount} ${activeGroup.memberCount === 1 ? "member" : "members"}.`
                  : "Private — only you can see these."}
              </p>
            </div>
          </div>
          <UploadZone
            groupId={selection.kind === "group" ? selection.groupId : null}
          />
          <FileGrid
            groupId={selection.kind === "group" ? selection.groupId : null}
            onOpen={setOpenFile}
          />
        </section>
      </main>

      <FileModal
        file={openFile}
        onClose={() => setOpenFile(null)}
        onShare={(f) => {
          setOpenFile(null);
          setShareFile(f);
        }}
      />
      <CreateGroupDialog
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={(id) => setSelection({ kind: "group", groupId: id })}
      />
      <InviteDialog
        open={inviteGroup !== null}
        groupId={inviteGroup?.id ?? null}
        groupName={inviteGroup?.name}
        onClose={() => setInviteGroup(null)}
      />
      <ShareDialog
        open={shareFile !== null}
        fileId={shareFile?.id ?? null}
        fileName={shareFile?.fileName}
        onClose={() => setShareFile(null)}
      />
    </div>
  );
}
