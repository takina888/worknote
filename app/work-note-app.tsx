"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type View = "home" | "papers" | "templates" | "saved" | "search" | "editor" | "settings";
type Tool = "select" | "text" | "pen" | "pencil" | "highlighter" | "eraser" | "photo" | "shape" | "arrow" | "dimension" | "sticky" | "marker" | "check" | "table" | "audio";
type ElementKind = "text" | "pen" | "image" | "shape" | "arrow" | "dimension" | "table" | "audio";

type Point = { x: number; y: number };

type NoteElement = {
  id: string;
  type: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  content: string;
  color: string;
  background: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  fontWeight: number;
  opacity: number;
  radius: number;
  shape: "rect" | "round" | "circle";
  src?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  points?: Point[];
  rows?: number;
  cols?: number;
  cells?: string[][];
  variant?: "plain" | "sticky" | "number" | "check";
  checked?: boolean;
};

type NotePage = {
  id: string;
  name: string;
  paper: string;
  mode?: "canvas" | "simple";
  simpleContent?: string;
  orientation: "portrait" | "landscape";
  background: string;
  ruled: "none" | "line" | "grid" | "dot";
  elements: NoteElement[];
};

type WorkDocument = {
  id: string;
  title: string;
  category: string;
  pages: NotePage[];
  currentPageId: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
};

type DragState = {
  id: string;
  mode: "move" | "resize" | "resize-start" | "resize-end";
  startClientX: number;
  startClientY: number;
  start: NoteElement;
  scaleX: number;
  scaleY: number;
};

const STORE_KEY = "work-note.documents.v1";
const SETTINGS_KEY = "work-note.settings.v1";
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

const basicPapers = [
  ["標準メモ", "タップしてすぐ文章を書く、使い慣れたメモ形式"],
  ["白紙", "自由に文字・写真・図形を配置"],
  ["横罫用紙", "行間が読みやすい罫線入り"],
  ["方眼用紙", "図形や寸法を揃えやすい方眼"],
  ["ドット用紙", "手書きと配置を助けるドット"],
  ["横向き白紙", "工程図や比較表に使いやすい横向き"],
  ["左右分割用紙", "写真と説明、作業前後を左右に整理"],
  ["上下分割用紙", "議題と結論、写真と説明を上下に整理"],
  ["二列用紙", "長い文章を二列で整理"],
  ["カード配置用紙", "項目ごとにカードで整理"],
  ["独自用紙", "方向・背景・罫線を後から設定"],
] as const;

const templateGroups = [
  {
    name: "会議・打ち合わせ",
    items: ["標準会議記録", "簡潔会議メモ", "詳細議事録", "定例会議記録", "短時間会議記録", "決定事項整理", "課題・担当・期限", "発言記録", "写真付き会議記録", "横向き会議一覧"],
  },
  {
    name: "現場・点検",
    items: ["標準作業記録", "作業前確認", "作業後確認", "現場打ち合わせ", "設備点検記録", "定期点検表", "写真付き点検", "不具合初動記録", "原因・対策整理", "復旧・完了報告"],
  },
  {
    name: "報告・写真記録",
    items: ["標準報告書", "簡潔報告書", "詳細報告書", "一日報告", "週間報告", "月間報告", "写真一枚報告", "写真四枚一覧", "作業前後比較", "番号・矢印付き写真報告"],
  },
  {
    name: "計画・管理",
    items: ["一日計画", "週間計画", "月間計画", "工程管理表", "進捗管理表", "課題一覧", "担当・期限管理", "確認事項一覧", "標準引き継ぎ", "未解決事項引き継ぎ"],
  },
  {
    name: "企画・個人メモ",
    items: ["アイデアメモ", "一枚企画書", "課題・解決案", "二案比較", "長所・短所", "原因・結果", "関係図", "流れ図", "自由写真メモ", "振り返りメモ"],
  },
] as const;

const toolItems: { id: Tool; icon: string; label: string }[] = [
  { id: "select", icon: "↖", label: "選択" },
  { id: "text", icon: "T", label: "文字" },
  { id: "pen", icon: "⌁", label: "ペン" },
  { id: "pencil", icon: "✎", label: "鉛筆" },
  { id: "highlighter", icon: "▰", label: "蛍光" },
  { id: "eraser", icon: "◇", label: "消去" },
  { id: "photo", icon: "▣", label: "写真" },
  { id: "shape", icon: "□", label: "図形" },
  { id: "arrow", icon: "↗", label: "矢印" },
  { id: "dimension", icon: "↔", label: "寸法" },
  { id: "sticky", icon: "▤", label: "付箋" },
  { id: "marker", icon: "①", label: "番号" },
  { id: "check", icon: "☐", label: "チェック" },
  { id: "table", icon: "▦", label: "表" },
  { id: "audio", icon: "●", label: "音声" },
];

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const snapValue = (value: number, enabled: boolean) => enabled ? Math.round(value / 10) * 10 : Math.round(value);

function elementBase(type: ElementKind, overrides: Partial<NoteElement> = {}): NoteElement {
  return {
    id: id("el"), type, x: 100, y: 120, w: 260, h: 88, rotation: 0,
    content: "", color: "#17384a", background: "transparent", borderColor: "#176f89",
    borderWidth: 2, fontSize: 22, fontWeight: 400, opacity: 1, radius: 10, shape: "round",
    variant: "plain",
    ...overrides,
  };
}

function templateElements(title: string): NoteElement[] {
  return [
    elementBase("text", { x: 62, y: 62, w: 670, h: 58, content: title, fontSize: 30, fontWeight: 700, color: "#145c73" }),
    elementBase("text", { x: 62, y: 140, w: 670, h: 48, content: "日付：　　　　　　担当：", fontSize: 17, color: "#425a66" }),
    elementBase("shape", { x: 62, y: 208, w: 670, h: 2, background: "#176f89", borderColor: "#176f89", radius: 0 }),
    elementBase("text", { x: 62, y: 236, w: 670, h: 180, content: "ここをタップして内容を入力してください。", fontSize: 19, color: "#243f4c" }),
  ];
}

function createPage(paper = "白紙", template?: string): NotePage {
  const landscape = paper === "横向き白紙";
  const simple = paper === "標準メモ";
  const ruled = paper === "横罫用紙" ? "line" : paper === "方眼用紙" ? "grid" : paper === "ドット用紙" ? "dot" : "none";
  return {
    id: id("page"), name: "ページ 1", paper, orientation: landscape ? "landscape" : "portrait",
    mode: simple ? "simple" : "canvas", simpleContent: simple ? "" : undefined,
    background: "#ffffff", ruled, elements: template ? templateElements(template) : [],
  };
}

function createDocument(title: string, category: string, paper = "白紙", template?: string): WorkDocument {
  const page = createPage(paper, template);
  return {
    id: id("doc"), title, category, pages: [page], currentPageId: page.id,
    createdAt: Date.now(), updatedAt: Date.now(), favorite: false,
  };
}

function paperBackground(page: NotePage) {
  if (page.ruled === "line") return "repeating-linear-gradient(#fff 0 31px, #dbe7eb 32px)";
  if (page.ruled === "grid") return "linear-gradient(#dfeaed 1px, transparent 1px),linear-gradient(90deg,#dfeaed 1px,transparent 1px),#fff";
  if (page.ruled === "dot") return "radial-gradient(circle,#b9cdd4 1.2px,transparent 1.5px),#fff";
  return page.background;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

function svgEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function elementSvg(element: NoteElement) {
  const transform = `rotate(${element.rotation} ${element.x + element.w / 2} ${element.y + element.h / 2})`;
  if (element.type === "text") return `<foreignObject x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" transform="${transform}" opacity="${element.opacity}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:${element.fontSize}px;font-weight:${element.fontWeight};line-height:1.45;color:${element.color};white-space:pre-wrap">${svgEscape(element.content)}</div></foreignObject>`;
  if (element.type === "image" && element.src) return `<image href="${element.src}" x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" preserveAspectRatio="xMidYMid slice" transform="${transform}" opacity="${element.opacity}" style="filter:brightness(${element.brightness ?? 100}%) contrast(${element.contrast ?? 100}%) saturate(${element.saturation ?? 100}%)"/>`;
  if (element.type === "shape") {
    if (element.shape === "circle") return `<ellipse cx="${element.x + element.w / 2}" cy="${element.y + element.h / 2}" rx="${element.w / 2}" ry="${element.h / 2}" fill="${element.background}" stroke="${element.borderColor}" stroke-width="${element.borderWidth}" transform="${transform}" opacity="${element.opacity}"/>`;
    return `<rect x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" rx="${element.shape === "round" ? element.radius : 0}" fill="${element.background}" stroke="${element.borderColor}" stroke-width="${element.borderWidth}" transform="${transform}" opacity="${element.opacity}"/>`;
  }
  if (element.type === "arrow" || element.type === "dimension") {
    const x2 = element.x + element.w;
    const y2 = element.y + element.h;
    const label = element.type === "dimension" ? `<text x="${element.x + element.w / 2}" y="${element.y + element.h / 2 - 8}" text-anchor="middle" font-family="sans-serif" font-size="${element.fontSize}" fill="${element.color}" stroke="white" stroke-width="5" paint-order="stroke">${svgEscape(element.content)}</text>` : "";
    return `<g transform="${transform}" opacity="${element.opacity}"><defs><marker id="arrow-end-${element.id}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${element.color}"/></marker><marker id="arrow-start-${element.id}" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto"><path d="M9,0 L9,6 L0,3 z" fill="${element.color}"/></marker></defs><line x1="${element.x}" y1="${element.y}" x2="${x2}" y2="${y2}" stroke="${element.color}" stroke-width="${element.borderWidth + 1}" marker-end="url(#arrow-end-${element.id})" ${element.type === "dimension" ? `marker-start="url(#arrow-start-${element.id})"` : ""}/>${label}</g>`;
  }
  if (element.type === "pen") return `<polyline points="${(element.points ?? []).map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${element.color}" stroke-width="${element.borderWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${element.opacity}"/>`;
  if (element.type === "table") {
    const rows = element.rows ?? 3;
    const cols = element.cols ?? 3;
    const lines = Array.from({ length: rows - 1 }, (_, index) => `<line x1="${element.x}" y1="${element.y + element.h * (index + 1) / rows}" x2="${element.x + element.w}" y2="${element.y + element.h * (index + 1) / rows}"/>`).join("") + Array.from({ length: cols - 1 }, (_, index) => `<line x1="${element.x + element.w * (index + 1) / cols}" y1="${element.y}" x2="${element.x + element.w * (index + 1) / cols}" y2="${element.y + element.h}"/>`).join("");
    return `<g stroke="${element.borderColor}" stroke-width="1" fill="none" transform="${transform}" opacity="${element.opacity}"><rect x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" fill="white"/>${lines}</g>`;
  }
  if (element.type === "audio") return `<g transform="${transform}" opacity="${element.opacity}"><rect x="${element.x}" y="${element.y}" width="${element.w}" height="${element.h}" rx="12" fill="#eef5f5" stroke="#aac5ca"/><text x="${element.x + 18}" y="${element.y + element.h / 2 + 6}" font-family="sans-serif" font-size="16" fill="#17384a">● ${svgEscape(element.content)}</text></g>`;
  return "";
}

export default function WorkNoteApp() {
  const [view, setView] = useState<View>("home");
  const [documents, setDocuments] = useState<WorkDocument[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<WorkDocument[]>([]);
  const [future, setFuture] = useState<WorkDocument[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [snap, setSnap] = useState(true);
  const [showPages, setShowPages] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [query, setQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [recording, setRecording] = useState(false);
  const [dark, setDark] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [savePulse, setSavePulse] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const currentDoc = useMemo(() => documents.find((doc) => doc.id === currentId) ?? null, [documents, currentId]);
  const currentPage = useMemo(() => currentDoc?.pages.find((page) => page.id === currentDoc.currentPageId) ?? null, [currentDoc]);
  const selected = useMemo(() => currentPage?.elements.find((element) => element.id === selectedId) ?? null, [currentPage, selectedId]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORE_KEY);
        const settings = localStorage.getItem(SETTINGS_KEY);
        if (stored) setDocuments(JSON.parse(stored));
        if (settings) {
          const parsed = JSON.parse(settings);
          setDark(Boolean(parsed.dark));
          setFontScale(Number(parsed.fontScale) || 1);
        }
      } catch { /* corrupted local data is ignored */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORE_KEY, JSON.stringify(documents));
      setSavePulse(true);
      window.setTimeout(() => setSavePulse(false), 700);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [documents, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dark, fontScale }));
  }, [dark, fontScale, hydrated]);

  const pushHistory = useCallback(() => {
    if (!currentDoc) return;
    setHistory((items) => [...items.slice(-39), clone(currentDoc)]);
    setFuture([]);
  }, [currentDoc]);

  const replaceCurrent = useCallback((next: WorkDocument) => {
    next.updatedAt = Date.now();
    setDocuments((items) => items.map((doc) => doc.id === next.id ? next : doc));
  }, []);

  const mutateCurrent = useCallback((mutator: (doc: WorkDocument) => void, record = true) => {
    if (!currentDoc) return;
    if (record) pushHistory();
    const next = clone(currentDoc);
    mutator(next);
    replaceCurrent(next);
  }, [currentDoc, pushHistory, replaceCurrent]);

  const updateElement = useCallback((elementId: string, patch: Partial<NoteElement>, record = false) => {
    mutateCurrent((doc) => {
      const page = doc.pages.find((item) => item.id === doc.currentPageId);
      const element = page?.elements.find((item) => item.id === elementId);
      if (element) Object.assign(element, patch);
    }, record);
  }, [mutateCurrent]);

  const addElement = useCallback((type: ElementKind, overrides: Partial<NoteElement> = {}) => {
    if (!currentDoc || !currentPage) return;
    const centerX = currentPage.orientation === "landscape" ? 390 : 260;
    const offset = (currentPage.elements.length * 28) % 196;
    let element = elementBase(type, { x: centerX + offset, y: 150 + offset, ...overrides });
    if (type === "text") element = { ...element, content: overrides.content ?? "文字を入力", w: overrides.w ?? 280, h: overrides.h ?? 64 };
    if (type === "shape") element = { ...element, content: overrides.content ?? "", w: overrides.w ?? 220, h: overrides.h ?? 130, background: overrides.background ?? "#dff2f4" };
    if (type === "arrow") element = { ...element, w: 260, h: 100, color: "#e46d3c" };
    if (type === "dimension") element = { ...element, w: 260, h: 72, content: "100 mm", color: "#176f89" };
    if (type === "table") element = { ...element, w: 440, h: 190, rows: 3, cols: 3, cells: [["項目 1", "項目 2", "項目 3"], ["", "", ""], ["", "", ""]], background: "#ffffff" };
    mutateCurrent((doc) => {
      doc.pages.find((page) => page.id === doc.currentPageId)?.elements.push(element);
    });
    setSelectedId(element.id);
    setTool("select");
    setShowPages(false);
    setShowInspector(false);
  }, [currentDoc, currentPage, mutateCurrent]);

  const createFromPaper = (paper: string) => {
    const next = createDocument(paper === "標準メモ" ? "標準メモ" : "新しいメモ", "基本用紙", paper);
    setDocuments((items) => [next, ...items]);
    setCurrentId(next.id);
    setSelectedId(null);
    setHistory([]);
    setFuture([]);
    setShowPages(false);
    setShowInspector(false);
    setView("editor");
  };

  const createFromTemplate = (template: string, category: string) => {
    const next = createDocument(template, category, "白紙", template);
    setDocuments((items) => [next, ...items]);
    setCurrentId(next.id);
    setSelectedId(null);
    setHistory([]);
    setFuture([]);
    setShowPages(false);
    setShowInspector(false);
    setView("editor");
  };

  const openDocument = (doc: WorkDocument) => {
    setCurrentId(doc.id);
    setSelectedId(null);
    setHistory([]);
    setFuture([]);
    setShowPages(false);
    setShowInspector(false);
    setView("editor");
  };

  const undo = useCallback(() => {
    if (!currentDoc || history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [clone(currentDoc), ...items].slice(0, 40));
    replaceCurrent(clone(previous));
    setSelectedId(null);
  }, [currentDoc, history, replaceCurrent]);

  const redo = useCallback(() => {
    if (!currentDoc || future.length === 0) return;
    const next = future[0];
    setHistory((items) => [...items, clone(currentDoc)].slice(-40));
    setFuture((items) => items.slice(1));
    replaceCurrent(clone(next));
    setSelectedId(null);
  }, [currentDoc, future, replaceCurrent]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    mutateCurrent((doc) => {
      const page = doc.pages.find((item) => item.id === doc.currentPageId);
      if (page) page.elements = page.elements.filter((item) => item.id !== selectedId);
    });
    setSelectedId(null);
    setShowInspector(false);
  }, [mutateCurrent, selectedId]);

  const removeElement = useCallback((elementId: string) => {
    mutateCurrent((doc) => {
      const page = doc.pages.find((item) => item.id === doc.currentPageId);
      if (page) page.elements = page.elements.filter((item) => item.id !== elementId);
    });
    setSelectedId((current) => current === elementId ? null : current);
  }, [mutateCurrent]);

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...clone(selected), id: id("el"), x: selected.x + 24, y: selected.y + 24 };
    mutateCurrent((doc) => doc.pages.find((page) => page.id === doc.currentPageId)?.elements.push(copy));
    setSelectedId(copy.id);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSavePulse(true);
      }
      if (event.key === "Delete" || event.key === "Backspace") removeSelected();
      if (event.key === "Escape") { setSelectedId(null); setShowInspector(false); setShowExport(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [undo, redo, removeSelected]);

  const beginDrag = (event: ReactPointerEvent, element: NoteElement, mode: DragState["mode"]) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(element.id);
    setTool("select");
    const paper = (event.currentTarget as HTMLElement).closest(".note-paper")?.getBoundingClientRect();
    if (!paper) return;
    pushHistory();
    setDrag({
      id: element.id, mode, startClientX: event.clientX, startClientY: event.clientY,
      start: clone(element), scaleX: (currentPage?.orientation === "landscape" ? PAGE_HEIGHT : PAGE_WIDTH) / paper.width,
      scaleY: (currentPage?.orientation === "landscape" ? PAGE_WIDTH : PAGE_HEIGHT) / paper.height,
    });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const dx = (event.clientX - drag.startClientX) * drag.scaleX;
      const dy = (event.clientY - drag.startClientY) * drag.scaleY;
      const start = drag.start;
      if (drag.mode === "move") updateElement(drag.id, { x: snapValue(start.x + dx, snap), y: snapValue(start.y + dy, snap) });
      if (drag.mode === "resize" || drag.mode === "resize-end") updateElement(drag.id, { w: Math.max(32, snapValue(start.w + dx, snap)), h: Math.max(24, snapValue(start.h + dy, snap)) });
      if (drag.mode === "resize-start") updateElement(drag.id, {
        x: snapValue(start.x + dx, snap), y: snapValue(start.y + dy, snap),
        w: Math.max(32, snapValue(start.w - dx, snap)), h: Math.max(24, snapValue(start.h - dy, snap)),
      });
    };
    const end = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); };
  }, [drag, snap, updateElement]);

  const handlePaperPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!["pen", "pencil", "highlighter"].includes(tool) || !currentPage) { if (event.target === event.currentTarget) setSelectedId(null); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const sourceWidth = currentPage.orientation === "landscape" ? PAGE_HEIGHT : PAGE_WIDTH;
    const sourceHeight = currentPage.orientation === "landscape" ? PAGE_WIDTH : PAGE_HEIGHT;
    const point = { x: (event.clientX - rect.left) * (sourceWidth / rect.width), y: (event.clientY - rect.top) * (sourceHeight / rect.height) };
    const strokeStyle = tool === "pencil"
      ? { color: "#354a54", borderWidth: 2, opacity: .72 }
      : tool === "highlighter"
        ? { color: "#f3c842", borderWidth: 18, opacity: .38 }
        : { color: "#17384a", borderWidth: 3, opacity: 1 };
    const stroke = elementBase("pen", { x: 0, y: 0, w: sourceWidth, h: sourceHeight, points: [point], ...strokeStyle });
    pushHistory();
    mutateCurrent((doc) => doc.pages.find((page) => page.id === doc.currentPageId)?.elements.push(stroke), false);
    setDrawingId(stroke.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePaperPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawingId || !currentPage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sourceWidth = currentPage.orientation === "landscape" ? PAGE_HEIGHT : PAGE_WIDTH;
    const sourceHeight = currentPage.orientation === "landscape" ? PAGE_WIDTH : PAGE_HEIGHT;
    const point = { x: (event.clientX - rect.left) * (sourceWidth / rect.width), y: (event.clientY - rect.top) * (sourceHeight / rect.height) };
    const stroke = currentPage.elements.find((item) => item.id === drawingId);
    updateElement(drawingId, { points: [...(stroke?.points ?? []), point] });
  };

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addElement("image", { src: String(reader.result), w: 360, h: 260, x: 190, brightness: 100, contrast: 100, saturation: 100, background: "#eaf1f2" });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const onBackupImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as WorkDocument;
        if (!parsed.title || !Array.isArray(parsed.pages) || !parsed.pages.length) throw new Error("invalid");
        const restored = clone(parsed);
        restored.id = id("doc");
        restored.title = `${restored.title}（復元）`;
        restored.updatedAt = Date.now();
        restored.pages = restored.pages.map((page, pageIndex) => ({ ...page, id: id("page"), name: page.name || `ページ ${pageIndex + 1}`, elements: (page.elements ?? []).map((element) => ({ ...element, id: id("el") })) }));
        restored.currentPageId = restored.pages[0].id;
        setDocuments((items) => [restored, ...items]);
        openDocument(restored);
      } catch {
        alert("WORK NOTEのバックアップファイルを読み込めませんでした。");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorder.current) { mediaRecorder.current.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = (event) => audioChunks.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => addElement("audio", { src: String(reader.result), w: 360, h: 76, content: "録音メモ" });
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
    } catch {
      alert("マイクを使用できません。端末のマイク許可を確認してください。");
    }
  };

  const handleTool = (next: Tool) => {
    setShowPages(false);
    setShowInspector(false);
    if (next === "photo") { photoInput.current?.click(); return; }
    if (next === "audio") { void toggleRecording(); return; }
    if (next === "sticky") { addElement("text", { content: "付箋メモ", w: 250, h: 150, background: "#fff4ad", borderColor: "#d8bd45", borderWidth: 1, radius: 4, variant: "sticky" }); return; }
    if (next === "marker") {
      const nextNumber = (currentPage?.elements.filter((element) => element.variant === "number").length ?? 0) + 1;
      addElement("text", { content: String(nextNumber), w: 58, h: 58, background: "#176f89", color: "#ffffff", fontSize: 26, fontWeight: 700, radius: 99, variant: "number" });
      return;
    }
    if (next === "check") { addElement("text", { content: "確認項目", w: 300, h: 58, fontSize: 20, variant: "check", checked: false }); return; }
    if (["text", "shape", "arrow", "dimension", "table"].includes(next)) { addElement(next as ElementKind); return; }
    setTool(next);
    setSelectedId(null);
  };

  const addPage = () => mutateCurrent((doc) => {
    const page = createPage(currentPage?.mode === "simple" ? "標準メモ" : "白紙");
    page.name = `ページ ${doc.pages.length + 1}`;
    doc.pages.push(page);
    doc.currentPageId = page.id;
  });

  const duplicatePage = () => mutateCurrent((doc) => {
    const source = doc.pages.find((page) => page.id === doc.currentPageId);
    if (!source) return;
    const copy = clone(source);
    copy.id = id("page");
    copy.name = `ページ ${doc.pages.length + 1}`;
    copy.elements = copy.elements.map((element) => ({ ...element, id: id("el") }));
    doc.pages.push(copy);
    doc.currentPageId = copy.id;
  });

  const deletePage = () => {
    if (!currentDoc || currentDoc.pages.length <= 1) return;
    mutateCurrent((doc) => {
      const index = doc.pages.findIndex((page) => page.id === doc.currentPageId);
      doc.pages.splice(index, 1);
      doc.currentPageId = doc.pages[Math.max(0, index - 1)].id;
    });
  };

  const changePage = (pageId: string) => {
    mutateCurrent((doc) => { doc.currentPageId = pageId; }, false);
    setSelectedId(null);
    setShowPages(false);
  };

  const download = (name: string, type: string, body: BlobPart) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportDocument = (format: "doc" | "xls" | "ppt" | "json" | "svg") => {
    if (!currentDoc || !currentPage) return;
    const text = currentDoc.pages.flatMap((page) => [page.simpleContent ?? "", ...page.elements.filter((el) => el.type === "text" || el.type === "dimension").map((el) => el.content)]).filter(Boolean);
    const safeTitle = currentDoc.title.replace(/[\\/:*?"<>|]/g, "_");
    if (format === "json") download(`${safeTitle}.worknote.json`, "application/json", JSON.stringify(currentDoc, null, 2));
    if (format === "doc") download(`${safeTitle}.doc`, "application/msword", `<html><meta charset="utf-8"><body><h1>${currentDoc.title}</h1>${text.map((item) => `<p>${item}</p>`).join("")}</body></html>`);
    if (format === "xls") download(`${safeTitle}.xls`, "application/vnd.ms-excel", `<html><meta charset="utf-8"><table>${text.map((item, index) => `<tr><td>${index + 1}</td><td>${item}</td></tr>`).join("")}</table></html>`);
    if (format === "ppt") download(`${safeTitle}.ppt`, "application/vnd.ms-powerpoint", `<html><meta charset="utf-8"><body><h1>${currentDoc.title}</h1>${text.map((item) => `<div style="page-break-after:always"><h2>${item}</h2></div>`).join("")}</body></html>`);
    if (format === "svg") {
      let offset = 0;
      const pages = currentDoc.pages.map((page) => {
        const width = page.orientation === "landscape" ? PAGE_HEIGHT : PAGE_WIDTH;
        const height = page.orientation === "landscape" ? PAGE_WIDTH : PAGE_HEIGHT;
        const simpleText = (page.simpleContent ?? "").split("\n").slice(0, 36).map((line, index) => `<text x="62" y="${86 + index * 28}" font-family="sans-serif" font-size="20" fill="#17384a">${svgEscape(line)}</text>`).join("");
        const group = `<g transform="translate(0 ${offset})"><rect width="${width}" height="${height}" fill="${page.background}"/>${simpleText}${page.elements.map(elementSvg).join("")}</g>`;
        offset += height + 30;
        return group;
      }).join("");
      const width = Math.max(...currentDoc.pages.map((page) => page.orientation === "landscape" ? PAGE_HEIGHT : PAGE_WIDTH));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.max(1, offset - 30)}">${pages}</svg>`;
      download(`${safeTitle}.svg`, "image/svg+xml", svg);
    }
    setShowExport(false);
  };

  const printDocument = () => { setShowExport(false); window.setTimeout(() => window.print(), 80); };

  const filteredTemplates = templateGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.includes(templateQuery)) })).filter((group) => group.items.length);
  const searchResults = documents.filter((doc) => {
    const haystack = `${doc.title} ${doc.category} ${doc.pages.flatMap((page) => [page.simpleContent ?? "", ...page.elements.map((element) => element.content)]).join(" ")}`;
    return haystack.toLowerCase().includes(query.toLowerCase());
  });

  if (!hydrated) return <div className="boot-screen"><div className="brand-mark">WN</div><p>WORK NOTE</p></div>;

  return (
    <div className={`work-note ${dark ? "dark" : ""}`} style={{ "--font-scale": fontScale } as React.CSSProperties}>
      <input ref={photoInput} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
      <input ref={backupInput} className="hidden-input" type="file" accept="application/json,.json" onChange={onBackupImport} />

      {view !== "editor" && (
        <header className="app-header">
          <div className="header-inner">
            {view !== "home" ? <button className="icon-button" onClick={() => setView("home")} aria-label="戻る">‹</button> : <div className="brand-mark small">WN</div>}
            <div className="brand-copy"><strong>WORK NOTE</strong><span>OFFLINE WORKSPACE</span></div>
            <div className="header-actions"><span className="offline-badge"><i />端末内保存</span><button className="icon-button" onClick={() => setView("settings")} aria-label="設定">⚙</button></div>
          </div>
        </header>
      )}

      {view === "home" && <HomeView documents={documents} openDocument={openDocument} setView={setView} />}

      {view === "papers" && (
        <main className="content-page">
          <PageHeading eyebrow="NEW NOTE" title="基本用紙" description="文章をすぐ書く標準メモと、自由配置できる用紙を選べます。" />
          <div className="paper-grid">{basicPapers.map(([name, description], index) => (
            <button key={name} className="paper-card" onClick={() => createFromPaper(name)}>
              <span className={`paper-preview paper-${index}`}><i /><i /><i /></span><strong>{name}</strong><small>{description}</small>
            </button>
          ))}</div>
        </main>
      )}

      {view === "templates" && (
        <main className="content-page">
          <PageHeading eyebrow="TEMPLATES" title="標準様式 50" description="用途に合う様式を選び、内容や配置を自由に編集できます。" />
          <label className="search-box"><span>⌕</span><input value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)} placeholder="様式を検索" /></label>
          {filteredTemplates.map((group) => <section className="template-section" key={group.name}><h2>{group.name}</h2><div className="template-grid">{group.items.map((item) => <button className="template-card" key={item} onClick={() => createFromTemplate(item, group.name)}><span className="template-sheet"><i/><i/><i/><i/></span><strong>{item}</strong><small>タップして作成</small></button>)}</div></section>)}
        </main>
      )}

      {view === "saved" && <DocumentList title="保存したメモ" documents={documents} openDocument={openDocument} setDocuments={setDocuments} />}

      {view === "search" && (
        <main className="content-page">
          <PageHeading eyebrow="SEARCH" title="メモを検索" description="タイトルと入力した本文を端末内だけで検索します。" />
          <label className="search-box large"><span>⌕</span><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="検索する文字を入力" /></label>
          <DocumentCards documents={query ? searchResults : documents} openDocument={openDocument} empty="該当するメモはありません" />
        </main>
      )}

      {view === "settings" && (
        <main className="content-page settings-page">
          <PageHeading eyebrow="SETTINGS" title="設定" description="表示と端末内データを管理します。" />
          <section className="settings-card"><div><strong>ダーク表示</strong><small>画面の明るさを抑えます</small></div><button className={`switch ${dark ? "on" : ""}`} onClick={() => setDark(!dark)}><i /></button></section>
          <section className="settings-card column"><div><strong>文字の大きさ</strong><small>画面内の案内文字を調整します</small></div><input type="range" min="0.9" max="1.2" step="0.05" value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} /></section>
          <section className="settings-card"><div><strong>保存先</strong><small>メモ・写真・録音をこの端末内へ保存</small></div><span className="status-pill">使用中</span></section>
          <section className="settings-card"><div><strong>バックアップを復元</strong><small>書き出したWORK NOTEデータを読み込みます</small></div><button className="settings-action" onClick={() => backupInput.current?.click()}>読み込む</button></section>
          <section className="settings-card"><div><strong>通信</strong><small>主要な編集・保存は通信不要</small></div><span className="status-pill">オフライン対応</span></section>
        </main>
      )}

      {view === "editor" && currentDoc && currentPage && (
        <Editor
          doc={currentDoc} page={currentPage} selected={selected} selectedId={selectedId} tool={tool}
          historyCount={history.length} futureCount={future.length} snap={snap} recording={recording} savePulse={savePulse}
          showPages={showPages} showInspector={showInspector}
          onBack={() => { setView("home"); setSelectedId(null); setShowPages(false); setShowInspector(false); }}
          onTitle={(title) => mutateCurrent((doc) => { doc.title = title; })}
          onUndo={undo} onRedo={redo} onExport={() => setShowExport(true)} onTool={handleTool}
          onSelect={setSelectedId}
          onDeselect={() => setSelectedId(null)}
          onBeginDrag={beginDrag} onPaperDown={handlePaperPointerDown} onPaperMove={handlePaperPointerMove}
          onPaperUp={() => setDrawingId(null)} onUpdateElement={updateElement} onDeleteElement={removeSelected}
          onEraseElement={removeElement}
          onDuplicateElement={duplicateSelected} onToggleSnap={() => setSnap(!snap)}
          onTogglePages={() => { setShowPages((open) => !open); setShowInspector(false); }}
          onToggleInspector={() => { setShowInspector((open) => !open); setShowPages(false); }}
          onDismissPanels={() => { setShowPages(false); setShowInspector(false); }}
          onChangePage={changePage} onAddPage={addPage} onDuplicatePage={duplicatePage} onDeletePage={deletePage}
          onPageSetting={(patch, record = true) => mutateCurrent((doc) => { const page = doc.pages.find((item) => item.id === doc.currentPageId); if (page) Object.assign(page, patch); }, record)}
        />
      )}

      {view !== "editor" && <BottomNav view={view} setView={setView} />}

      {showExport && currentDoc && <ExportDialog title={currentDoc.title} close={() => setShowExport(false)} print={printDocument} exportDocument={exportDocument} />}
    </div>
  );
}

function HomeView({ documents, openDocument, setView }: { documents: WorkDocument[]; openDocument: (doc: WorkDocument) => void; setView: (view: View) => void }) {
  return <main className="home-page">
    <section className="home-hero">
      <div><span className="eyebrow">YOUR WORK, CLEARLY</span><h1>思いついた瞬間から、<br/><em>そのまま仕事の形へ。</em></h1><p>文字、手書き、写真、図形、寸法、音声を一枚のページで。通信なしでも保存できます。</p></div>
      <div className="hero-sheet" aria-hidden="true"><div className="hero-paper"><span>WORK NOTE</span><b>作業記録</b><i/><i/><i/><div className="hero-photo"/><div className="hero-arrow">↗</div></div></div>
    </section>
    <section className="quick-actions">
      <button className="primary-action" onClick={() => setView("papers")}><span>＋</span><div><strong>新しいメモ</strong><small>標準メモ・白紙・方眼から始める</small></div><b>›</b></button>
      <button onClick={() => setView("templates")}><span>▤</span><div><strong>標準様式</strong><small>50種類から選ぶ</small></div><b>›</b></button>
      <button onClick={() => setView("saved")}><span>□</span><div><strong>保存したメモ</strong><small>{documents.length}件を端末内に保存</small></div><b>›</b></button>
    </section>
    <section className="recent-section"><div className="section-heading"><div><span className="eyebrow">RECENT</span><h2>最近のメモ</h2></div>{documents.length > 0 && <button onClick={() => setView("saved")}>すべて見る</button>}</div><DocumentCards documents={documents.slice(0, 4)} openDocument={openDocument} empty="まだメモはありません。新しいメモから始めてください。" /></section>
    <section className="local-note"><span>◉</span><div><strong>この端末だけに保存</strong><small>ログイン不要。メモ・写真・録音を外部へ自動送信しません。</small></div></section>
  </main>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

function DocumentCards({ documents, openDocument, empty }: { documents: WorkDocument[]; openDocument: (doc: WorkDocument) => void; empty: string }) {
  if (!documents.length) return <div className="empty-state"><div>＋</div><p>{empty}</p></div>;
  return <div className="document-grid">{documents.map((doc) => <button className="document-card" key={doc.id} onClick={() => openDocument(doc)}><div className="document-preview"><span>{doc.title.slice(0, 18)}</span><i/><i/><i/><b>{doc.pages.length}</b></div><strong>{doc.title}</strong><small>{doc.category} ・ {formatDate(doc.updatedAt)}</small></button>)}</div>;
}

function DocumentList({ title, documents, openDocument, setDocuments }: { title: string; documents: WorkDocument[]; openDocument: (doc: WorkDocument) => void; setDocuments: React.Dispatch<React.SetStateAction<WorkDocument[]>> }) {
  const [filter, setFilter] = useState<"all" | "favorite">("all");
  const items = filter === "favorite" ? documents.filter((doc) => doc.favorite) : documents;
  return <main className="content-page"><PageHeading eyebrow="SAVED" title={title} description="自動保存されたメモを開き、続きから編集できます。"/><div className="filter-row"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>すべて</button><button className={filter === "favorite" ? "active" : ""} onClick={() => setFilter("favorite")}>お気に入り</button></div>{!items.length ? <div className="empty-state"><div>□</div><p>保存したメモはありません</p></div> : <div className="saved-list">{items.map((doc) => <article key={doc.id}><button className="saved-main" onClick={() => openDocument(doc)}><div className="mini-page"><i/><i/><i/></div><div><strong>{doc.title}</strong><small>{doc.category} ・ {doc.pages.length}ページ</small><span>{formatDate(doc.updatedAt)}</span></div></button><button className={`favorite ${doc.favorite ? "on" : ""}`} onClick={() => setDocuments((all) => all.map((item) => item.id === doc.id ? { ...item, favorite: !item.favorite } : item))} aria-label="お気に入り">★</button><button className="trash" onClick={() => { if (confirm("このメモを削除しますか？")) setDocuments((all) => all.filter((item) => item.id !== doc.id)); }} aria-label="削除">×</button></article>)}</div>}</main>;
}

function BottomNav({ view, setView }: { view: View; setView: (view: View) => void }) {
  const items: { id: View; icon: string; label: string }[] = [{ id: "home", icon: "⌂", label: "ホーム" }, { id: "saved", icon: "□", label: "保存メモ" }, { id: "papers", icon: "＋", label: "新規作成" }, { id: "search", icon: "⌕", label: "検索" }, { id: "settings", icon: "⚙", label: "設定" }];
  return <nav className="bottom-nav">{items.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>;
}

type EditorProps = {
  doc: WorkDocument; page: NotePage; selected: NoteElement | null; selectedId: string | null; tool: Tool;
  historyCount: number; futureCount: number; snap: boolean; recording: boolean; savePulse: boolean;
  showPages: boolean; showInspector: boolean;
  onBack: () => void; onTitle: (value: string) => void; onUndo: () => void; onRedo: () => void; onExport: () => void;
  onTool: (tool: Tool) => void; onSelect: (id: string) => void; onDeselect: () => void; onBeginDrag: (event: ReactPointerEvent, element: NoteElement, mode: DragState["mode"]) => void;
  onPaperDown: (event: ReactPointerEvent<HTMLDivElement>) => void; onPaperMove: (event: ReactPointerEvent<HTMLDivElement>) => void; onPaperUp: () => void;
  onUpdateElement: (id: string, patch: Partial<NoteElement>, record?: boolean) => void; onDeleteElement: () => void; onEraseElement: (id: string) => void; onDuplicateElement: () => void;
  onToggleSnap: () => void; onTogglePages: () => void; onToggleInspector: () => void; onDismissPanels: () => void; onChangePage: (id: string) => void;
  onAddPage: () => void; onDuplicatePage: () => void; onDeletePage: () => void; onPageSetting: (patch: Partial<NotePage>, record?: boolean) => void;
};

function Editor(props: EditorProps) {
  const { doc, page, selected, selectedId, tool } = props;
  const landscape = page.orientation === "landscape";
  const simple = page.mode === "simple";
  const [viewport, setViewport] = useState({ width: 1024, height: 800, offsetLeft: 0 });
  const simpleNoteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const syncViewport = () => setViewport({
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      offsetLeft: Math.round(window.visualViewport?.offsetLeft ?? 0),
    });
    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

  const sourceWidth = landscape ? PAGE_HEIGHT : PAGE_WIDTH;
  const mobileZoom = viewport.width <= 760 ? Math.max(.28, Math.min(.56, (viewport.width - 32) / sourceWidth)) : 1;
  const editorStyle = {
    "--editor-height": `${viewport.height}px`,
    "--editor-width": `${viewport.width}px`,
    "--editor-left": `${viewport.offsetLeft}px`,
    "--page-zoom": mobileZoom,
  } as React.CSSProperties;

  const insertSimpleText = (value: string) => {
    const textarea = simpleNoteRef.current;
    const content = page.simpleContent ?? "";
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? start;
    const lineBreak = start > 0 && content[start - 1] !== "\n" ? "\n" : "";
    const insertion = `${lineBreak}${value}`;
    props.onPageSetting({ simpleContent: `${content.slice(0, start)}${insertion}${content.slice(end)}` });
    window.requestAnimationFrame(() => {
      const position = start + insertion.length;
      simpleNoteRef.current?.focus({ preventScroll: true });
      simpleNoteRef.current?.setSelectionRange(position, position);
    });
  };

  const renderSimpleActions = () => <>
    <button onClick={() => insertSimpleText("☐ ")}><span>☐</span><small>チェック</small></button>
    <button onClick={() => insertSimpleText("・")}><span>•</span><small>箇条書き</small></button>
    <button onClick={() => insertSimpleText(`${new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }).format(new Date())} `)}><span>日</span><small>日付</small></button>
    <button onClick={() => insertSimpleText("──────────\n")}><span>―</span><small>区切り</small></button>
    <button disabled={!props.historyCount} onClick={props.onUndo}><span>↶</span><small>戻す</small></button>
    <button disabled={!props.futureCount} onClick={props.onRedo}><span>↷</span><small>やり直し</small></button>
  </>;

  return <div className={`editor-root ${simple ? "simple-editor" : ""}`} style={editorStyle}>
    <header className="editor-header"><button className="icon-button" onClick={props.onBack} aria-label="戻る">‹</button><input className="document-title" value={doc.title} onChange={(e) => props.onTitle(e.target.value)} aria-label="文書タイトル"/><span className={`save-state ${props.savePulse ? "pulse" : ""}`}>● 保存済み</span><div className="editor-header-actions"><button disabled={!props.historyCount} onClick={props.onUndo} title="元に戻す">↶</button><button disabled={!props.futureCount} onClick={props.onRedo} title="やり直す">↷</button><button className="export-button" onClick={props.onExport}>書き出し</button></div></header>
    <div className="editor-body">
      <PageRail doc={doc} current={page.id} onChange={props.onChangePage} onAdd={props.onAddPage} onDuplicate={props.onDuplicatePage} onDelete={props.onDeletePage} onClose={props.onDismissPanels} className={props.showPages ? "mobile-open" : ""}/>
      <div className="canvas-shell">
        <div className="canvas-topbar"><button onClick={props.onTogglePages}>▤ <span>ページ {doc.pages.findIndex((item) => item.id === page.id) + 1}/{doc.pages.length}</span></button><div>{!simple && <button className={props.snap ? "active" : ""} onClick={props.onToggleSnap}>⌁ 吸着</button>}<button onClick={props.onToggleInspector}>調整</button></div></div>
        <nav className={`mobile-top-tools ${simple ? "simple-tools" : ""}`} aria-label={simple ? "標準メモツール" : "書き込みツール"}>{simple ? renderSimpleActions() : toolItems.map((item) => <button key={item.id} className={`${tool === item.id ? "active" : ""} ${item.id === "audio" && props.recording ? "recording" : ""}`} onClick={() => props.onTool(item.id)}><span>{item.id === "audio" && props.recording ? "■" : item.icon}</span><small>{item.id === "audio" && props.recording ? "停止" : item.label}</small></button>)}</nav>
        <div className="canvas-stage" onPointerDown={() => { if (props.showPages || props.showInspector) props.onDismissPanels(); }}><div className={`paper-wrap ${simple ? "simple-mode" : ""}`}><div className={`note-paper ${landscape ? "landscape" : "portrait"} ruled-${page.ruled} ${simple ? "simple-note-paper" : ""} ${["pen", "pencil", "highlighter", "eraser"].includes(tool) ? "pen-cursor" : ""}`} style={{ background: paperBackground(page), backgroundSize: page.ruled === "grid" || page.ruled === "dot" ? "24px 24px" : undefined }} onPointerDown={simple ? undefined : props.onPaperDown} onPointerMove={simple ? undefined : props.onPaperMove} onPointerUp={simple ? undefined : props.onPaperUp}>{simple ? <div className="simple-note"><div className="simple-note-actions">{renderSimpleActions()}</div><textarea ref={simpleNoteRef} aria-label="標準メモ本文" value={page.simpleContent ?? ""} onChange={(event) => props.onPageSetting({ simpleContent: event.target.value })} placeholder="メモを入力" autoCapitalize="sentences"/></div> : <>{page.elements.map((element) => <CanvasObject key={element.id} element={element} selected={selectedId === element.id} tool={tool} onErase={props.onEraseElement} onSelect={props.onSelect} onBeginDrag={props.onBeginDrag} onUpdate={props.onUpdateElement} />)}{props.snap && selected && <><div className="snap-guide vertical" style={{ left: selected.x + selected.w / 2 }}/><div className="snap-guide horizontal" style={{ top: selected.y + selected.h / 2 }}/></>}</>}</div></div><div className="page-foot">{page.name} ・ {page.paper} ・ 自動保存中</div></div>
      </div>
      <Inspector selected={selected} page={page} onUpdate={props.onUpdateElement} onDelete={props.onDeleteElement} onDuplicate={props.onDuplicateElement} onPageSetting={props.onPageSetting} onClose={props.onDismissPanels} className={props.showInspector ? "mobile-open" : ""}/>
    </div>
    {(selected?.type === "text" || selected?.type === "shape") && !props.showPages && !props.showInspector && <div className="mobile-text-editor"><textarea aria-label="選択した文字を編集" value={selected.content} onChange={(event) => props.onUpdateElement(selected.id, { content: event.target.value })} rows={2} autoCapitalize="sentences"/><button onClick={() => { (document.activeElement as HTMLElement | null)?.blur(); props.onDeselect(); }}>完了</button></div>}
    {!simple && <nav className="editor-toolbar"><button className="mobile-page-button" onClick={props.onTogglePages}><span>▤</span><small>ページ</small></button>{toolItems.map((item) => <button key={item.id} className={`${tool === item.id ? "active" : ""} ${item.id === "audio" && props.recording ? "recording" : ""}`} onClick={() => props.onTool(item.id)}><span>{item.id === "audio" && props.recording ? "■" : item.icon}</span><small>{item.id === "audio" && props.recording ? "停止" : item.label}</small></button>)}<button className="mobile-inspector-button" onClick={props.onToggleInspector}><span>☷</span><small>調整</small></button></nav>}
    <div className="print-pages" aria-hidden="true">{doc.pages.map((printPage) => <div className={`print-page ${printPage.orientation}`} key={printPage.id} style={{ background: paperBackground(printPage), backgroundSize: printPage.ruled === "grid" || printPage.ruled === "dot" ? "24px 24px" : undefined }}>{printPage.mode === "simple" ? <div className="simple-note-print">{printPage.simpleContent}</div> : printPage.elements.map((element) => <CanvasObject key={element.id} element={element} selected={false} onSelect={() => undefined} onBeginDrag={() => undefined} onUpdate={() => undefined}/>)}</div>)}</div>
  </div>;
}

function PageRail({ doc, current, onChange, onAdd, onDuplicate, onDelete, onClose, className }: { doc: WorkDocument; current: string; onChange: (id: string) => void; onAdd: () => void; onDuplicate: () => void; onDelete: () => void; onClose: () => void; className: string }) {
  return <aside className={`page-rail ${className}`}><div className="panel-heading"><strong>ページ</strong><div className="panel-heading-actions"><button onClick={onAdd}>＋ 追加</button><button className="panel-close" onClick={onClose} aria-label="ページ一覧を閉じる">×</button></div></div><div className="page-thumbs">{doc.pages.map((page, index) => <button key={page.id} className={current === page.id ? "active" : ""} onClick={() => onChange(page.id)}><span className={page.orientation}><i/><i/><i/></span><small>{index + 1}</small></button>)}</div><div className="page-actions"><button onClick={onDuplicate}>複製</button><button onClick={onDelete} disabled={doc.pages.length <= 1}>削除</button></div></aside>;
}

function CanvasObject({ element, selected, tool = "select", onErase, onSelect, onBeginDrag, onUpdate }: { element: NoteElement; selected: boolean; tool?: Tool; onErase?: (id: string) => void; onSelect: (id: string) => void; onBeginDrag: EditorProps["onBeginDrag"]; onUpdate: EditorProps["onUpdateElement"] }) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (element.type !== "text" || !textRef.current) return;
    const requiredHeight = Math.ceil(textRef.current.scrollHeight);
    if (requiredHeight > element.h) onUpdate(element.id, { h: requiredHeight }, false);
  }, [element.content, element.fontSize, element.fontWeight, element.h, element.id, element.type, element.w, onUpdate]);
  if (element.type === "pen") return <svg className={`pen-stroke ${tool === "eraser" ? "erasable" : ""}`} width="100%" height="100%" viewBox={`0 0 ${element.w || PAGE_WIDTH} ${element.h || PAGE_HEIGHT}`} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); if (tool === "eraser") onErase?.(element.id); else onSelect(element.id); }}><polyline points={(element.points ?? []).map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={element.color} strokeWidth={element.borderWidth} strokeLinecap="round" strokeLinejoin="round" opacity={element.opacity}/></svg>;
  const style: React.CSSProperties = { left: element.x, top: element.y, width: element.w, height: element.h, transform: `rotate(${element.rotation}deg)`, opacity: element.opacity, color: element.color, fontSize: element.fontSize, fontWeight: element.fontWeight, zIndex: selected ? 20 : 2 };
  const isLine = element.type === "arrow" || element.type === "dimension";
  const editablePointerDown = (event: ReactPointerEvent<HTMLTextAreaElement>) => {
    if (tool === "select") { onBeginDrag(event, element, "move"); return; }
    event.stopPropagation();
    onSelect(element.id);
    event.currentTarget.focus({ preventScroll: true });
  };
  const editableClick = (event: ReactPointerEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    onSelect(element.id);
    if (tool !== "select") event.currentTarget.focus({ preventScroll: true });
  };
  return <div className={`canvas-object type-${element.type} variant-${element.variant ?? "plain"} tool-${tool} ${selected ? "selected" : ""}`} style={style} onPointerDown={(event) => { if ((event.target as HTMLElement).closest("textarea,audio,input,button")) return; onBeginDrag(event, element, "move"); }} onClick={(event) => { event.stopPropagation(); onSelect(element.id); }}>
    {element.type === "text" && <textarea ref={textRef} aria-label="ページ内の文字" value={element.content} onChange={(event) => { const requiredHeight = Math.ceil(event.currentTarget.scrollHeight); onUpdate(element.id, { content: event.currentTarget.value, h: Math.max(element.h, requiredHeight) }); }} onPointerDown={editablePointerDown} onClick={editableClick} onFocus={() => onSelect(element.id)} autoCapitalize="sentences" style={{ color: element.color, fontSize: element.fontSize, fontWeight: element.fontWeight, background: element.background, borderRadius: element.radius }} />}
    {element.type === "text" && element.variant === "check" && <button className={`check-toggle ${element.checked ? "checked" : ""}`} aria-label="チェック状態を切り替える" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onUpdate(element.id, { checked: !element.checked }, true); }}>{element.checked ? "✓" : ""}</button>}
    {element.type === "shape" && <div className={`shape-body ${element.shape}`} style={{ background: element.background, borderColor: element.borderColor, borderWidth: element.borderWidth, borderRadius: element.shape === "circle" ? "50%" : element.shape === "rect" ? 0 : element.radius }}><textarea className="shape-label" aria-label="図形内の文字" value={element.content} placeholder="文字" onChange={(event) => onUpdate(element.id, { content: event.target.value })} onPointerDown={editablePointerDown} onClick={editableClick}/></div>}
    {isLine && <svg width="100%" height="100%" overflow="visible"><defs><marker id={`arrowhead-${element.id}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={element.color}/></marker>{element.type === "dimension" && <marker id={`arrowstart-${element.id}`} markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto"><path d="M9,0 L9,6 L0,3 z" fill={element.color}/></marker>}</defs><line x1="8" y1="8" x2={Math.max(10, element.w - 8)} y2={Math.max(10, element.h - 8)} stroke={element.color} strokeWidth={element.borderWidth + 1} markerEnd={`url(#arrowhead-${element.id})`} markerStart={element.type === "dimension" ? `url(#arrowstart-${element.id})` : undefined}/>{element.type === "dimension" && <><line x1="8" y1="-4" x2="8" y2="22" stroke={element.color} strokeWidth="2"/><line x1={element.w - 8} y1={element.h - 20} x2={element.w - 8} y2={element.h + 4} stroke={element.color} strokeWidth="2"/><text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={element.color} stroke="white" strokeWidth="5" paintOrder="stroke" fontSize={element.fontSize}>{element.content}</text></>}</svg>}
    {element.type === "image" && element.src && <img src={element.src} alt="挿入した写真" draggable={false} style={{ filter: `brightness(${element.brightness ?? 100}%) contrast(${element.contrast ?? 100}%) saturate(${element.saturation ?? 100}%)`, borderRadius: element.radius }} />}
    {element.type === "table" && <table style={{ borderColor: element.borderColor, fontSize: element.fontSize * .65 }}><tbody>{Array.from({ length: element.rows ?? 3 }, (_, row) => <tr key={row}>{Array.from({ length: element.cols ?? 3 }, (_, col) => <td key={col}><textarea aria-label={`${row + 1}行${col + 1}列`} value={element.cells?.[row]?.[col] ?? (row === 0 ? `項目 ${col + 1}` : "")} onPointerDown={(event) => { event.stopPropagation(); onSelect(element.id); }} onChange={(event) => { const rows = element.rows ?? 3; const cols = element.cols ?? 3; const next = Array.from({ length: rows }, (_, rowIndex) => Array.from({ length: cols }, (_, colIndex) => element.cells?.[rowIndex]?.[colIndex] ?? (rowIndex === 0 ? `項目 ${colIndex + 1}` : ""))); next[row][col] = event.target.value; onUpdate(element.id, { cells: next }); }}/></td>)}</tr>)}</tbody></table>}
    {element.type === "audio" && element.src && <div className="audio-object"><span>● {element.content}</span><audio controls src={element.src}/></div>}
    {selected && <><button className="object-drag-handle" onPointerDown={(event) => onBeginDrag(event, element, "move")} aria-label="移動">✥</button>{isLine && <button className="endpoint start" onPointerDown={(event) => onBeginDrag(event, element, "resize-start")} aria-label="始点を移動"/>}<button className={`resize-handle ${isLine ? "endpoint end" : ""}`} onPointerDown={(event) => onBeginDrag(event, element, isLine ? "resize-end" : "resize")} aria-label="大きさを変更"/></>}
  </div>;
}

function Inspector({ selected, page, onUpdate, onDelete, onDuplicate, onPageSetting, onClose, className }: { selected: NoteElement | null; page: NotePage; onUpdate: EditorProps["onUpdateElement"]; onDelete: () => void; onDuplicate: () => void; onPageSetting: (patch: Partial<NotePage>) => void; onClose: () => void; className: string }) {
  return (
    <aside className={`inspector ${className}`}>
      <div className="panel-heading">
        <strong>{selected ? "対象を調整" : "ページ設定"}</strong>
        <div className="panel-heading-actions"><span>{selected ? typeLabel(selected.type) : page.paper}</span><button className="panel-close" onClick={onClose} aria-label="調整画面を閉じる">×</button></div>
      </div>
      {!selected ? (
        <div className="inspector-content">
          <Field label="向き">
            <div className="segmented">
              <button className={page.orientation === "portrait" ? "active" : ""} onClick={() => onPageSetting({ orientation: "portrait" })}>縦</button>
              <button className={page.orientation === "landscape" ? "active" : ""} onClick={() => onPageSetting({ orientation: "landscape" })}>横</button>
            </div>
          </Field>
          <Field label="背景"><input type="color" value={page.background} onChange={(e) => onPageSetting({ background: e.target.value })}/></Field>
          <Field label="罫線">
            <select value={page.ruled} onChange={(e) => onPageSetting({ ruled: e.target.value as NotePage["ruled"] })}>
              <option value="none">なし</option><option value="line">横罫</option><option value="grid">方眼</option><option value="dot">ドット</option>
            </select>
          </Field>
          <p className="inspector-tip">対象を選ぶと、色・大きさ・回転などを調整できます。</p>
        </div>
      ) : (
        <div className="inspector-content">
          <div className="position-grid">
            <NumberField label="X" value={selected.x} onChange={(value) => onUpdate(selected.id, { x: value }, true)}/>
            <NumberField label="Y" value={selected.y} onChange={(value) => onUpdate(selected.id, { y: value }, true)}/>
            <NumberField label="幅" value={selected.w} onChange={(value) => onUpdate(selected.id, { w: Math.max(20, value) }, true)}/>
            <NumberField label="高さ" value={selected.h} onChange={(value) => onUpdate(selected.id, { h: Math.max(20, value) }, true)}/>
          </div>
          <Field label={`回転 ${selected.rotation}°`}><input type="range" min="-180" max="180" value={selected.rotation} onChange={(e) => onUpdate(selected.id, { rotation: Number(e.target.value) })}/></Field>

          {selected.type === "text" && (
            <>
              <Field label="文字サイズ"><input type="range" min="10" max="72" value={selected.fontSize} onChange={(e) => onUpdate(selected.id, { fontSize: Number(e.target.value) })}/></Field>
              <Field label="文字色"><input type="color" value={selected.color} onChange={(e) => onUpdate(selected.id, { color: e.target.value })}/></Field>
              <button className={`wide-toggle ${selected.fontWeight > 500 ? "active" : ""}`} onClick={() => onUpdate(selected.id, { fontWeight: selected.fontWeight > 500 ? 400 : 700 }, true)}>太字</button>
            </>
          )}

          {selected.type === "image" && (
            <>
              <Field label={`明るさ ${selected.brightness ?? 100}%`}><input type="range" min="20" max="180" value={selected.brightness ?? 100} onChange={(e) => onUpdate(selected.id, { brightness: Number(e.target.value) })}/></Field>
              <Field label={`コントラスト ${selected.contrast ?? 100}%`}><input type="range" min="20" max="180" value={selected.contrast ?? 100} onChange={(e) => onUpdate(selected.id, { contrast: Number(e.target.value) })}/></Field>
              <Field label={`彩度 ${selected.saturation ?? 100}%`}><input type="range" min="0" max="200" value={selected.saturation ?? 100} onChange={(e) => onUpdate(selected.id, { saturation: Number(e.target.value) })}/></Field>
              <Field label="角丸"><input type="range" min="0" max="60" value={selected.radius} onChange={(e) => onUpdate(selected.id, { radius: Number(e.target.value) })}/></Field>
            </>
          )}

          {selected.type === "shape" && (
            <>
              <Field label="形">
                <div className="segmented">
                  <button className={selected.shape === "rect" ? "active" : ""} onClick={() => onUpdate(selected.id, { shape: "rect" }, true)}>四角</button>
                  <button className={selected.shape === "round" ? "active" : ""} onClick={() => onUpdate(selected.id, { shape: "round" }, true)}>角丸</button>
                  <button className={selected.shape === "circle" ? "active" : ""} onClick={() => onUpdate(selected.id, { shape: "circle" }, true)}>円</button>
                </div>
              </Field>
              <Field label="塗り"><input type="color" value={selected.background} onChange={(e) => onUpdate(selected.id, { background: e.target.value })}/></Field>
            </>
          )}

          {(selected.type === "arrow" || selected.type === "dimension" || selected.type === "pen") && (
            <>
              <Field label="線の色"><input type="color" value={selected.color} onChange={(e) => onUpdate(selected.id, { color: e.target.value })}/></Field>
              <Field label={`線幅 ${selected.borderWidth}px`}><input type="range" min="1" max="16" value={selected.borderWidth} onChange={(e) => onUpdate(selected.id, { borderWidth: Number(e.target.value) })}/></Field>
              {selected.type === "dimension" && <Field label="寸法値"><input type="text" value={selected.content} onChange={(e) => onUpdate(selected.id, { content: e.target.value })}/></Field>}
            </>
          )}

          {selected.type === "table" && (
            <>
              <NumberField label="行" value={selected.rows ?? 3} onChange={(value) => onUpdate(selected.id, { rows: Math.max(1, Math.min(12, value)) }, true)}/>
              <NumberField label="列" value={selected.cols ?? 3} onChange={(value) => onUpdate(selected.id, { cols: Math.max(1, Math.min(8, value)) }, true)}/>
            </>
          )}

          <Field label={`透明度 ${Math.round(selected.opacity * 100)}%`}><input type="range" min="10" max="100" value={selected.opacity * 100} onChange={(e) => onUpdate(selected.id, { opacity: Number(e.target.value) / 100 })}/></Field>
          <div className="object-actions"><button onClick={onDuplicate}>複製</button><button className="danger" onClick={onDelete}>削除</button></div>
        </div>
      )}
    </aside>
  );
}

function typeLabel(type: ElementKind) { return ({ text: "文字", pen: "手書き", image: "写真", shape: "図形", arrow: "矢印", dimension: "寸法", table: "表", audio: "音声" } as Record<ElementKind, string>)[type]; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="number-field"><span>{label}</span><input type="number" value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))}/></label>; }

function ExportDialog({ title, close, print, exportDocument }: { title: string; close: () => void; print: () => void; exportDocument: (format: "doc" | "xls" | "ppt" | "json" | "svg") => void }) {
  const options = [{ id: "doc", icon: "W", title: "文書形式", text: "文字を編集できる文書" }, { id: "xls", icon: "X", title: "表計算形式", text: "表と項目をセルで出力" }, { id: "ppt", icon: "P", title: "スライド形式", text: "ページ単位で出力" }, { id: "svg", icon: "▧", title: "画像形式", text: "高品質な画像で保存" }, { id: "json", icon: "↥", title: "バックアップ", text: "再編集用の完全データ" }] as const;
  return <div className="modal-backdrop" onMouseDown={close}><section className="export-dialog" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">EXPORT</span><h2>書き出し・印刷</h2><p>{title}</p></div><button onClick={close}>×</button></div><div className="export-options">{options.map((option) => <button key={option.id} onClick={() => exportDocument(option.id)}><span>{option.icon}</span><div><strong>{option.title}</strong><small>{option.text}</small></div><b>›</b></button>)}<button onClick={print}><span>▤</span><div><strong>PDF・直接印刷</strong><small>用紙と余白を確認して印刷</small></div><b>›</b></button></div></section></div>;
}
