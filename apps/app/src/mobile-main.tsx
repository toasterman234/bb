import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import { MobileApp } from "./mobile/MobileApp";
import { initializePreferredTheme } from "./hooks/useTheme";
import { applyCachedAppThemeCss } from "./lib/themes";
import {
  createAppQueryClient,
  installAppQueryClientBrowserEvents,
} from "./lib/query-client";
import "./app.css";
import "./mobile/mobile.css";

const queryClient = createAppQueryClient({ showMutationErrorToasts: false });
installAppQueryClientBrowserEvents(queryClient);
initializePreferredTheme();
applyCachedAppThemeCss();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <MobileApp />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/mobile/sw.js", { scope: "/mobile/" }).catch(() => {});
}
