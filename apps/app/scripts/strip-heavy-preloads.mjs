#!/usr/bin/env node
/**
 * Strips heavy modulepreload links from the built index.html.
 *
 * Vite's modulepreload pass eagerly preloads every chunk in the import graph,
 * including multi-megabyte bundles that aren't needed for first paint. On
 * mobile devices over Tailscale, these extra fetches compete with critical
 * rendering and make the app feel sluggish.
 *
 * This script removes preload links for chunks that are loaded lazily by
 * React.lazy() or dynamic import() at runtime. The modules still load — just
 * not as part of the initial waterfall.
 *
 * Run after `vite build`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");
const INDEX = join(DIST, "index.html");

const NO_PRELOAD = [
  // 1.7MB of aggregated shared chunks (Vite co-bundles them because they
  // share an import graph with formatWorkspaceCheckoutDisplay).
  "workspace-checkout-display-",
  // 253KB — loaded lazily by ThreadDetailView for math rendering.
  "katex-",
];

let html = readFileSync(INDEX, "utf-8");
let removed = 0;

for (const prefix of NO_PRELOAD) {
  const before = html.length;
  html = html.replace(
    new RegExp(`<link rel="modulepreload"[^>]*${prefix}[^>]*>\\n?`, "g"),
    "",
  );
  if (html.length < before) removed++;
}

// Compute remaining preload size
let totalKB = 0;
for (const match of html.matchAll(
  /<link rel="modulepreload"[^>]*href="\/assets\/([^"]+)"/g,
)) {
  const chunk = match[1];
  try {
    const { size } = readFileSync(join(DIST, "assets", chunk));
    totalKB += size / 1024;
  } catch {
    // chunk may not exist (e.g., preload for a different build)
  }
}

writeFileSync(INDEX, html);
console.log(
  `Removed ${removed} heavy preload(s). ` +
    `Remaining: ${Math.round(totalKB)}KB (${(totalKB / 1024).toFixed(1)}MB).`,
);
