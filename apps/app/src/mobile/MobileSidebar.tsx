import { useMemo, type ReactNode } from "react";
import type { ProjectWithThreadsResponse } from "@bb/server-contract";
import type { ThreadListEntry } from "@bb/domain";
import { useSidebarNavigation } from "@/hooks/queries/sidebar-navigation-query";
import { getThreadDisplayTitle } from "@/lib/thread-title";

interface MobileSidebarProps {
  onOpenThread: (thread: ThreadListEntry) => void;
}

function isUnread(thread: ThreadListEntry): boolean {
  return thread.latestAttentionAt > (thread.lastReadAt ?? 0);
}

function statusLabel(thread: ThreadListEntry): string {
  const status = thread.runtime.displayStatus;
  return status === "idle" ? "" : status.replaceAll("-", " ");
}

function buildChildren(threads: readonly ThreadListEntry[]) {
  const byParent = new Map<string | null, ThreadListEntry[]>();
  const ids = new Set(threads.map((thread) => thread.id));
  for (const thread of threads) {
    const parent =
      thread.parentThreadId && ids.has(thread.parentThreadId)
        ? thread.parentThreadId
        : null;
    const list = byParent.get(parent) ?? [];
    list.push(thread);
    byParent.set(parent, list);
  }
  return byParent;
}

function ThreadRows({
  threads,
  onOpenThread,
}: {
  threads: readonly ThreadListEntry[];
  onOpenThread: (thread: ThreadListEntry) => void;
}) {
  const byParent = useMemo(() => buildChildren(threads), [threads]);

  const renderLevel = (parentId: string | null, depth: number): ReactNode =>
    (byParent.get(parentId) ?? []).map((thread) => {
      const unread = isUnread(thread) || thread.hasPendingInteraction;
      const status = statusLabel(thread);
      return (
        <div key={thread.id}>
          <button
            type="button"
            className="bb-mobile-thread-row"
            style={{ paddingLeft: `${10 + Math.min(depth, 4) * 15}px` }}
            onClick={() => onOpenThread(thread)}
          >
            <span
              className="bb-mobile-thread-dot"
              data-running={
                thread.runtime.displayStatus !== "idle" ? "true" : undefined
              }
              data-unread={unread ? "true" : undefined}
            />
            <span className="bb-mobile-thread-title">
              {getThreadDisplayTitle(thread)}
            </span>
            <span className="bb-mobile-thread-status">{status}</span>
          </button>
          {renderLevel(thread.id, depth + 1)}
        </div>
      );
    });

  return <>{renderLevel(null, 0)}</>;
}

function ProjectGroup({
  project,
  onOpenThread,
}: {
  project: ProjectWithThreadsResponse;
  onOpenThread: (thread: ThreadListEntry) => void;
}) {
  return (
    <section className="bb-mobile-project-group">
      <div className="bb-mobile-project-label">
        <span>⌄</span>
        <strong>{project.name}</strong>
        <span className="bb-mobile-project-count">{project.threads.length}</span>
      </div>
      {project.threads.length > 0 ? (
        <ThreadRows threads={project.threads} onOpenThread={onOpenThread} />
      ) : (
        <div className="bb-mobile-empty-project">No threads</div>
      )}
    </section>
  );
}

export function MobileSidebar({ onOpenThread }: MobileSidebarProps) {
  const navigation = useSidebarNavigation();
  const projects = navigation.data
    ? [navigation.data.personalProject, ...navigation.data.projects]
    : [];

  return (
    <div className="bb-mobile-sidebar">
      <header className="bb-mobile-sidebar-header">
        <strong>bb</strong>
        <div className="bb-mobile-sidebar-actions">
          <a href="/" aria-label="New thread">
            ＋
          </a>
          <a href="/" aria-label="Open full bb">
            ⋯
          </a>
        </div>
      </header>
      <div className="bb-mobile-sidebar-section-title">Threads</div>
      <main className="bb-mobile-sidebar-scroll">
        {navigation.isLoading ? (
          <div className="bb-mobile-loading">Loading threads…</div>
        ) : navigation.isError ? (
          <button
            className="bb-mobile-retry"
            type="button"
            onClick={() => void navigation.refetch()}
          >
            Couldn’t load bb navigation. Tap to retry.
          </button>
        ) : (
          projects.map((project) => (
            <ProjectGroup
              key={project.id}
              project={project}
              onOpenThread={onOpenThread}
            />
          ))
        )}
      </main>
    </div>
  );
}
