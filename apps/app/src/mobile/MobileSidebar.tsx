import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { PERSONAL_PROJECT_ID, type ThreadListEntry } from "@bb/domain";
import type {
  ProjectResponse,
  ProjectWithThreadsResponse,
  SidebarBootstrapResponse,
} from "@bb/server-contract";
import { useSidebarNavigation } from "@/hooks/queries/sidebar-navigation-query";
import { sdk } from "@/lib/sdk";
import { getThreadDisplayTitle } from "@/lib/thread-title";

interface MobileSidebarProps {
  onOpenThread: (thread: ThreadListEntry) => void;
}

const MOBILE_NAVIGATION_FALLBACK_QUERY_KEY = [
  "mobileSidebarNavigationFallback",
] as const;

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

function projectListWithoutEmbeddedThreads(
  value: Awaited<ReturnType<typeof sdk.projects.list>>,
): ProjectResponse[] {
  return value as ProjectResponse[];
}

async function fetchMobileNavigationFallback(
  signal?: AbortSignal,
): Promise<SidebarBootstrapResponse> {
  // sidebar-bootstrap is the canonical path and remains the primary query.
  // This fallback deliberately uses bb's public SDK/contracts rather than a
  // second hand-written API client. It avoids the bootstrap route's aggregate
  // execution-default work so one bad default/project record cannot blank the
  // entire mobile sidebar.
  const [projectRows, threads] = await Promise.all([
    sdk.projects.list({ includePersonal: true, signal }),
    sdk.threads.list({ archived: false, signal }),
  ]);
  const projects = projectListWithoutEmbeddedThreads(projectRows);
  const threadsByProjectId = new Map<string, ThreadListEntry[]>();
  for (const thread of threads) {
    const projectThreads = threadsByProjectId.get(thread.projectId) ?? [];
    projectThreads.push(thread);
    threadsByProjectId.set(thread.projectId, projectThreads);
  }

  const projectsWithThreads: ProjectWithThreadsResponse[] = projects.map(
    (project) => ({
      ...project,
      threads: threadsByProjectId.get(project.id) ?? [],
      // The compact mobile sidebar does not consume create-thread defaults.
      // Keeping this null preserves the server contract without inventing
      // execution policy client-side.
      defaultExecutionOptions: null,
    }),
  );
  const personalProject = projectsWithThreads.find(
    (project) => project.id === PERSONAL_PROJECT_ID,
  );
  if (!personalProject) {
    throw new Error("Personal project is missing from mobile navigation fallback");
  }

  return {
    sections: [],
    personalProject,
    projects: projectsWithThreads.filter(
      (project) => project.id !== PERSONAL_PROJECT_ID,
    ),
  };
}

function navigationErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "Unknown navigation error";
}

export function MobileSidebar({ onOpenThread }: MobileSidebarProps) {
  const navigation = useSidebarNavigation();
  const fallback = useQuery<SidebarBootstrapResponse>({
    queryKey: MOBILE_NAVIGATION_FALLBACK_QUERY_KEY,
    queryFn: ({ signal }) => fetchMobileNavigationFallback(signal),
    enabled: navigation.isError,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
    refetchInterval: navigation.isError ? 5_000 : false,
  });
  const navigationData = navigation.data ?? fallback.data;
  const projects = navigationData
    ? [navigationData.personalProject, ...navigationData.projects]
    : [];
  const recovering = navigation.isError && fallback.isLoading;
  const failed = navigation.isError && fallback.isError;

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
        ) : recovering ? (
          <div className="bb-mobile-loading">Recovering bb navigation…</div>
        ) : failed ? (
          <button
            className="bb-mobile-retry"
            type="button"
            onClick={() => {
              void navigation.refetch();
              void fallback.refetch();
            }}
          >
            Couldn’t load bb navigation. Tap to retry.
            <small>
              {navigationErrorMessage(navigation.error)} · fallback: {" "}
              {navigationErrorMessage(fallback.error)}
            </small>
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
