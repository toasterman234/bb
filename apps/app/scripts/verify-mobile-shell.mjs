import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoDir = resolve(appDir, "../..");

const read = (path) => readFile(resolve(appDir, path), "utf8");
const mustContain = (content, token, label) => {
  if (!content.includes(token)) throw new Error(`${label}: missing ${token}`);
};
const mustNotExist = async (path, label) => {
  try {
    await access(resolve(repoDir, path));
  } catch {
    return;
  }
  throw new Error(`${label}: obsolete path still exists: ${path}`);
};

const [main, mobileApp, sidebar, thread, vite, manifest, sw, timelineDetails] =
  await Promise.all([
    read("src/mobile-main.tsx"),
    read("src/mobile/MobileApp.tsx"),
    read("src/mobile/MobileSidebar.tsx"),
    read("src/mobile/MobileThreadView.tsx"),
    read("vite.config.ts"),
    read("public/mobile/manifest.webmanifest"),
    read("public/mobile/sw.js"),
    read("src/components/thread/timeline/TimelineRowDetails.tsx"),
  ]);

mustContain(main, "HashRouter", "mobile entry");
mustContain(main, "createAppQueryClient", "mobile entry");
mustContain(main, 'import "./app.css"', "mobile entry");
mustContain(mobileApp, "useWebSocket", "mobile app");
mustContain(mobileApp, "useAppTheme", "mobile app");
mustContain(mobileApp, "useRouteState", "mobile app");
mustContain(sidebar, "useSidebarNavigation", "mobile sidebar");
mustContain(sidebar, "sdk.projects.list", "mobile sidebar fallback");
mustContain(sidebar, "sdk.threads.list", "mobile sidebar fallback");
mustContain(sidebar, "navigation.data ?? fallback.data", "mobile sidebar fallback");
mustContain(sidebar, "personalProject", "mobile sidebar");
mustContain(thread, "ThreadTimelineSurface", "mobile thread");
mustContain(thread, "useThreadTimeline", "mobile thread");
mustContain(thread, "useSendThreadMessage", "mobile thread");
mustContain(thread, "useStopThread", "mobile thread");
mustContain(vite, 'resolve(appDir, "mobile/index.html")', "vite config");
mustContain(manifest, "shared-core-1", "mobile manifest");
mustContain(sw, "bb-mobile-shared-core", "mobile service worker");
mustContain(timelineDetails, "lazy(() =>", "timeline details");
mustContain(timelineDetails, 'import("./TimelineFileDiffBlock.js")', "timeline details");

for (const obsoletePath of [
  "apps/mobile",
  "apps/app/public/mobile/index.html",
  "apps/app/public/mobile/app.css",
  "apps/app/public/mobile/core.js",
  "apps/app/public/mobile/views.js",
  "apps/app/public/mobile/data.js",
  "apps/app/public/mobile/main.js",
  "apps/app/public/mobile/icon.svg",
  "apps/app/public/mobile/icon-180.png",
  "apps/app/public/mobile/icon-192.png",
  "apps/app/public/mobile/icon-512.png",
]) {
  await mustNotExist(obsoletePath, "mobile architecture");
}

console.log(
  "bb mobile shell verified: shared-core entry, canonical sidebar/timeline, SDK navigation fallback, old standalone client absent",
);
