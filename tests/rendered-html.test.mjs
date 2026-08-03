import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("ships the functional WORK NOTE editor surfaces", async () => {
  const source = await readFile(new URL("../app/work-note-app.tsx", import.meta.url), "utf8");
  for (const feature of ["text", "pen", "pencil", "highlighter", "eraser", "photo", "shape", "arrow", "dimension", "sticky", "marker", "check", "table", "audio"]) {
    assert.match(source, new RegExp(`id: \\"${feature}\\"`));
  }
  assert.match(source, /localStorage\.setItem\(STORE_KEY/);
  assert.match(source, /navigator\.serviceWorker\.register/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /WORK NOTEのバックアップファイル/);
  assert.match(source, /cells: \[\["項目 1"/);
  assert.match(source, /className="shape-label"/);
  assert.match(source, /onEraseElement/);
  assert.match(source, /className=\{`mobile-top-tools/);
  assert.match(source, /aria-label="標準メモ本文"/);
  assert.match(source, /\["標準メモ", "タップしてすぐ文章を書く/);
  assert.match(source, /requiredHeight > element\.h/);
  assert.match(source, /if \(tool === "select"\) \{ onBeginDrag\(event, element, "move"\)/);
});

test("keeps controls outside the page and fits the mobile editor viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/work-note-app.tsx", import.meta.url), "utf8");
  assert.match(css, /\.editor-root\s*\{[^}]*grid-template-rows:/s);
  assert.match(css, /\.editor-root\s*\{[^}]*height:\s*var\(--editor-height/s);
  assert.match(css, /\.canvas-shell\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.note-paper\s*\{[^}]*zoom:\s*var\(--page-zoom/s);
  assert.match(css, /\.note-paper\.simple-note-paper\s*\{[^}]*zoom:\s*1/s);
  assert.match(css, /\.simple-note\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.editor-root\s*\{[^}]*width:\s*var\(--editor-width/s);
  assert.match(css, /\.panel-close\s*\{[^}]*display:\s*grid\s*!important/s);
  assert.match(css, /\.editor-toolbar\s*\{[^}]*border-top:/s);
  assert.match(css, /\.mobile-text-editor\s*\{[^}]*bottom:/s);
  assert.match(css, /\.mobile-top-tools\s*\{[^}]*top:\s*44px/s);
  assert.match(css, /\.editor-toolbar\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.canvas-object\.type-text\.tool-select textarea[^}]*touch-action:\s*none/s);
  assert.match(css, /\.canvas-object\.type-text[^}]*touch-action:\s*manipulation/s);
  assert.doesNotMatch(source, /window\.innerWidth\s*<\s*760[^\n]*setShowInspector\(true\)/);
});
