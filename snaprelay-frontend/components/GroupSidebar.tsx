"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Button } from "./Button";

export type GroupSelection =
  | { kind: "mine" }
  | { kind: "group"; groupId: string };

export function GroupSidebar({
  selection,
  onSelect,
  onCreate,
  onInvite,
  onCameras,
  onDelete,
}: {
  selection: GroupSelection;
  onSelect: (s: GroupSelection) => void;
  onCreate: () => void;
  onInvite: (group: Group) => void;
  onCameras: (group: Group) => void;
  onDelete: (group: Group) => void;
}) {
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.listMyGroups(),
  });

  return (
    <aside className="flex flex-col gap-4 md:w-60 md:shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          Library
        </h2>
        <Button size="sm" variant="ghost" onClick={onCreate} aria-label="New group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New
        </Button>
      </div>
      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        <SidebarRow
          active={selection.kind === "mine"}
          onClick={() => onSelect({ kind: "mine" })}
          label="My files"
          hint="Only you"
        />
        {groups.map((g) => (
          <SidebarRow
            key={g.id}
            active={selection.kind === "group" && selection.groupId === g.id}
            onClick={() => onSelect({ kind: "group", groupId: g.id })}
            label={g.name}
            hint={`${g.memberCount} member${g.memberCount === 1 ? "" : "s"}`}
            rightAction={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCameras(g);
                  }}
                  aria-label={`Cameras for ${g.name}`}
                  title="Cameras"
                  className="rounded-full p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>
                {g.role === "owner" ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInvite(g);
                      }}
                      aria-label={`Invite to ${g.name}`}
                      title="Invite"
                      className="rounded-full p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M20 8v6M23 11h-6" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(g);
                      }}
                      aria-label={`Delete ${g.name}`}
                      title="Delete group"
                      className="rounded-full p-1 text-text-muted hover:bg-red-500/10 hover:text-red-400"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                ) : null}
              </div>
            }
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarRow({
  active,
  onClick,
  label,
  hint,
  rightAction,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 rounded-[12px] border px-3 py-2 transition-colors",
        "min-w-[140px] shrink-0 md:min-w-0 md:shrink",
        active
          ? "border-accent/60 bg-accent/10"
          : "border-transparent hover:bg-surface-elevated",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col items-start text-left"
      >
        <span className={["truncate text-sm", active ? "text-accent" : "text-text-primary"].join(" ")}>
          {label}
        </span>
        {hint ? <span className="truncate text-xs text-text-muted">{hint}</span> : null}
      </button>
      {rightAction}
    </div>
  );
}
