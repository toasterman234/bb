import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  isRunningThreadRuntimeDisplayStatus,
  ThreadTimelineSurface,
} from "@/components/thread/timeline";
import {
  useThread,
  useThreadDetailBootstrap,
  useThreadPendingInteractions,
  useThreadTimeline,
} from "@/hooks/queries/thread-queries";
import { useMarkThreadRead } from "@/hooks/mutations/thread-state-mutations";
import {
  useSendThreadMessage,
  useStopThread,
} from "@/hooks/mutations/thread-runtime-mutations";
import { getThreadDisplayTitle } from "@/lib/thread-title";
import { getThreadRoutePath } from "@/lib/route-paths";
import { MobilePendingInteractions } from "./MobilePendingInteractions";

interface MobileThreadViewProps {
  projectId: string;
  threadId: string;
  onBack: () => void;
}

export function MobileThreadView({
  projectId,
  threadId,
  onBack,
}: MobileThreadViewProps) {
  const threadQuery = useThread(threadId);
  const bootstrapQuery = useThreadDetailBootstrap(threadId, {
    timelinePrefetch: true,
  });
  const timelineQuery = useThreadTimeline(threadId);
  const interactionsQuery = useThreadPendingInteractions(threadId);
  const markRead = useMarkThreadRead();
  const send = useSendThreadMessage();
  const stop = useStopThread();
  const [message, setMessage] = useState("");
  const markedAttentionRef = useRef<number | null>(null);

  const thread = threadQuery.data ?? bootstrapQuery.data;
  const runtimeStatus = thread?.runtime.displayStatus ?? "idle";
  const running = isRunningThreadRuntimeDisplayStatus(runtimeStatus);
  const timelineRows = timelineQuery.data?.rows ?? [];
  const workspaceRootPath = bootstrapQuery.data?.environment?.path;

  useEffect(() => {
    if (!thread) return;
    if (thread.latestAttentionAt <= (thread.lastReadAt ?? 0)) return;
    if (markedAttentionRef.current === thread.latestAttentionAt) return;
    markedAttentionRef.current = thread.latestAttentionAt;
    markRead.mutate(threadId);
  }, [markRead.mutate, thread?.lastReadAt, thread?.latestAttentionAt, threadId]);

  const title = useMemo(
    () => (thread ? getThreadDisplayTitle(thread) : "Thread"),
    [thread],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || send.isPending) return;
    setMessage("");
    send.mutate({
      id: threadId,
      input: [{ type: "text", text, mentions: [] }],
      mode: "auto",
    });
  };

  return (
    <div className="bb-mobile-thread-view">
      <header className="bb-mobile-thread-header">
        <button type="button" onClick={onBack} aria-label="Back to threads">
          ‹
        </button>
        <div className="bb-mobile-thread-heading">
          <strong>{title}</strong>
          <span>
            {thread?.providerId ?? ""}
            {running ? ` · ${runtimeStatus}` : ""}
          </span>
        </div>
        <a
          href={getThreadRoutePath({ projectId, threadId })}
          aria-label="Open full bb"
        >
          ⋯
        </a>
      </header>

      <MobilePendingInteractions
        interactions={interactionsQuery.data ?? []}
        onResolved={() => void interactionsQuery.refetch()}
      />

      <main className="bb-mobile-thread-body">
        <ThreadTimelineSurface
          activeThinking={timelineQuery.data?.activeThinking ?? null}
          isThreadTimelinePending={timelineQuery.isPending}
          timelineError={timelineQuery.isError}
          showOngoingIndicator={running}
          timelineRows={timelineRows}
          threadId={threadId}
          projectId={projectId}
          threadRuntimeDisplayStatus={runtimeStatus}
          workspaceRootPath={workspaceRootPath}
        />
      </main>

      <form className="bb-mobile-composer" onSubmit={submit}>
        <textarea
          rows={1}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Message…"
          aria-label="Message"
        />
        {running ? (
          <button
            className="bb-mobile-stop"
            type="button"
            disabled={stop.isPending}
            onClick={() => stop.mutate(threadId)}
            aria-label="Stop"
          >
            ■
          </button>
        ) : null}
        <button
          className="bb-mobile-send"
          type="submit"
          disabled={!message.trim() || send.isPending}
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
