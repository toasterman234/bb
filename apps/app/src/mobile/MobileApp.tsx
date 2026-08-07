import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ThreadListEntry } from "@bb/domain";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useRouteState } from "@/hooks/useRouteState";
import { getThreadRoutePath } from "@/lib/route-paths";
import { MobileSidebar } from "./MobileSidebar";
import { MobileThreadView } from "./MobileThreadView";

export function MobileApp() {
  useWebSocket();
  useAppTheme();
  const navigate = useNavigate();
  const { projectId, threadId, isThreadView } = useRouteState();

  const openThread = useCallback(
    (thread: ThreadListEntry) => {
      void navigate(
        getThreadRoutePath({ projectId: thread.projectId, threadId: thread.id }),
      );
    },
    [navigate],
  );

  const closeThread = useCallback(() => {
    void navigate("/");
  }, [navigate]);

  return (
    <div className="bb-mobile-root">
      {isThreadView && projectId && threadId ? (
        <MobileThreadView
          projectId={projectId}
          threadId={threadId}
          onBack={closeThread}
        />
      ) : (
        <MobileSidebar onOpenThread={openThread} />
      )}
    </div>
  );
}
