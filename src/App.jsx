import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const DATA_FILE = "/data/morning_meeting_data.xlsx";
const WORLD_MAP_ASSET = "/minimalist_world_map_with_soft_gradients.png";

const tabs = ["Stocks", "Foreign Exchange", "Commodities", "Bonds", "Crypto"];

const C = {
  green: "#16a34a",
  red: "#ef4444",
  gold: "#d99a2b",
  slate: "#64748b",
};

const cn = (...x) => x.filter(Boolean).join(" ");

const bool = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
};

const num = (v, d = 0) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : d;
};

const isNA = (v) => {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s === "n/a" || s === "na" || s === "—" || s === "-" || s === "placeholder";
};

const parseSignedValue = (raw) => {
  if (isNA(raw)) return null;
  const s = String(raw).replace(",", ".").trim();
  const match = s.match(/([+-]?\d+(\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const getTone = (raw) => {
  if (isNA(raw)) return "neutral";
  const v = parseSignedValue(raw);
  if (v === null) return "neutral";
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
};

const toneCard = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  negative: "border-red-200 bg-red-50 text-red-600",
  neutral: "border-slate-200 bg-slate-50 text-slate-500",
};

const toneText = {
  positive: "text-emerald-600",
  negative: "text-red-500",
  neutral: "text-slate-500",
};

const getBarWidth = (raw, maxAbs = 5) => {
  const v = parseSignedValue(raw);
  if (v === null) return 0;
  return Math.min((Math.abs(v) / maxAbs) * 100, 100);
};

const sortRows = (rows) => [...(rows || [])].sort((a, b) => num(a.sort) - num(b.sort));

const groupBy = (rows, key) => {
  const out = {};
  (rows || []).forEach((r) => {
    const k = r[key];
    if (!k) return;
    if (!out[k]) out[k] = [];
    out[k].push(r);
  });
  return out;
};

const colorOf = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (s === "red") return C.red;
  if (s === "gold") return C.gold;
  if (s === "green") return C.green;
  if (String(v || "").startsWith("#")) return v;
  return C.green;
};

const primaryUrl = (url) => {
  if (!url || isNA(url)) return null;
  const first = String(url).split("|")[0].trim();
  if (!first.startsWith("http")) return null;
  return first;
};

function SourceInfo({ url, label = "Source" }) {
  const href = primaryUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={label}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
    >
      i
    </a>
  );
}

function createEmptyData() {
  return {
    markets: {},
    placeholders: {},
    mainChart: {},
    marketStats: {},
    snapshot: {},
    news: {},
    drivers: {},
    conclusions: {},
    deeper: {},
    mapHotspots: [],
    industryBreakdown: [],
    breadthRows: [],
    fxRates: [],
    fxStrength: [],
    fxHeatmap: { currencies: [], rows: {}, source_url: "" },
    commodityTiles: [],
    bondCurve: [],
    bondTenorMoves: [],
    bondMetricCards: [],
    cryptoStructure: [],
    cryptoDerivatives: [],
  };
}

function normalizeWorkbook(sheets) {
  const data = createEmptyData();

  sortRows(sheets.markets || []).forEach((r) => {
    if (r.market_key) data.markets[r.market_key] = r;
  });

  const simpleGrouped = {
    placeholders: (r) => ({ name: r.name, description: r.description, source_url: r.source_url, notes: r.notes }),
    marketStats: (r) => ({ label: r.label, value: r.value, source_url: r.source_url, notes: r.notes }),
    snapshot: (r) => ({ label: r.label, value: r.value, sub: r.sub, source_url: r.source_url, notes: r.notes }),
    drivers: (r) => ({ title: r.title, text: r.text, source_url: r.source_url }),
  };

  Object.entries(simpleGrouped).forEach(([sheet, map]) => {
    const grouped = groupBy(sortRows(sheets[sheet] || []), "market_key");
    Object.keys(grouped).forEach((k) => {
      data[sheet][k] = grouped[k].map(map);
    });
  });

  const chartGrouped = groupBy(sortRows(sheets.mainChart || []), "market_key");
  Object.keys(chartGrouped).forEach((k) => {
    data.mainChart[k] = chartGrouped[k].map((r) => ({
      label: r.label,
      value: num(r.value),
      source_url: r.source_url,
      notes: r.notes,
    }));
  });

  const newsGrouped = groupBy(sortRows(sheets.news || []), "market_key");
  Object.keys(newsGrouped).forEach((k) => {
    data.news[k] = newsGrouped[k].map((r) => ({
      source: r.source,
      time: r.time,
      title: r.title,
      tag: r.tag,
      importance: r.importance,
      source_url: r.source_url,
    }));
  });

  (sheets.conclusions || []).forEach((r) => {
    if (!r.market_key) return;
    data.conclusions[r.market_key] = {
      stance: r.stance,
      bullets: [r.bullet1, r.bullet2, r.bullet3].filter((x) => !isNA(x)),
      presenterLine: r.presenter_line,
      source_url: r.source_url,
    };
  });

  const deeperGrouped = groupBy(sortRows(sheets.deeper || []), "market_key");
  Object.keys(deeperGrouped).forEach((k) => {
    data.deeper[k] = { Context: [], Monitor: [], Risks: [], "Speaker Notes": [], Template: [] };
    deeperGrouped[k].forEach((r) => {
      if (data.deeper[k][r.category]) data.deeper[k][r.category].push({ text: r.text, source_url: r.source_url });
    });
  });

  if (sheets.mapHotspots?.length) {
    data.mapHotspots = sortRows(sheets.mapHotspots).map((r) => ({
      id: r.id,
      label: r.label,
      index_name: r.index_name,
      value: r.value,
      move: r.move,
      x_pct: num(r.x_pct),
      y_pct: num(r.y_pct),
      color: r.color,
      is_active: bool(r.is_active),
      source_url: r.source_url,
      notes: r.notes,
    }));
  }

  if (sheets.industryBreakdown?.length) {
    data.industryBreakdown = sortRows(sheets.industryBreakdown).map((r) => ({
      industry: r.industry,
      move: r.move,
      weight: r.weight,
      color: r.color,
      source_url: r.source_url,
      notes: r.notes,
    }));
  }

  if (sheets.breadthRows?.length) {
    data.breadthRows = sortRows(sheets.breadthRows).map((r) => ({
      name: r.name,
      advancers: num(r.advancers),
      decliners: num(r.decliners, 1),
      ratio_label: r.ratio_label,
      is_placeholder: bool(r.is_placeholder),
      source_url: r.source_url,
    }));
  }

  if (sheets.fxRates?.length) {
    data.fxRates = sortRows(sheets.fxRates).map((r) => ({
      pair: r.pair,
      last: r.last,
      move: r.move,
      high: r.high,
      low: r.low,
      is_placeholder: bool(r.is_placeholder),
      source_url: r.source_url,
    }));
  }

  if (sheets.fxStrength?.length) {
    data.fxStrength = sortRows(sheets.fxStrength).map((r) => ({
      currency: r.currency,
      move: r.move,
      source_url: r.source_url,
    }));
  }

  if (sheets.fxHeatmap?.length) {
    const removedCurrencies = new Set(["AUD", "NZD"]);
    const systemColumns = new Set(["base", "sort", "source_url", "notes", "as_of"]);
    const first = sheets.fxHeatmap[0];
    const currencies = Object.keys(first)
      .filter((k) => !systemColumns.has(k.toLowerCase()))
      .filter((k) => !removedCurrencies.has(k));

    data.fxHeatmap = {
      currencies,
      rows: {},
      source_url: sheets.fxHeatmap.find((r) => r.source_url)?.source_url || "",
    };

    sortRows(sheets.fxHeatmap).forEach((r) => {
      if (!r.base || removedCurrencies.has(r.base) || !currencies.includes(r.base)) return;
      data.fxHeatmap.rows[r.base] = currencies.map((c) => r[c] || "—");
    });
  }

  if (sheets.commodityTiles?.length) {
    data.commodityTiles = sortRows(sheets.commodityTiles).map((r) => ({
      group: r.group,
      name: r.name,
      price: r.price,
      move: r.move,
      span: num(r.span, 1),
      source_url: r.source_url,
    }));
  }

  if (sheets.bondCurve?.length) {
    data.bondCurve = sortRows(sheets.bondCurve).map((r) => ({
      tenor: r.tenor,
      today: num(r.today),
      prior: num(r.prior),
      source_url: r.source_url,
    }));
  }

  if (sheets.bondTenorMoves?.length) {
    data.bondTenorMoves = sortRows(sheets.bondTenorMoves).map((r) => ({
      tenor: r.tenor,
      bp: num(r.bp),
      source_url: r.source_url,
    }));
  }

  if (sheets.bondMetricCards?.length) {
    data.bondMetricCards = sortRows(sheets.bondMetricCards).map((r) => ({
      title: r.title,
      value: r.value,
      sub: r.sub,
      positive: bool(r.positive),
      source_url: r.source_url,
    }));
  }

  if (sheets.cryptoStructure?.length) {
    data.cryptoStructure = sortRows(sheets.cryptoStructure).map((r) => ({
      name: r.name,
      value: r.value,
      color: r.color,
      is_placeholder: bool(r.is_placeholder),
      source_url: r.source_url,
    }));
  }

  if (sheets.cryptoDerivatives?.length) {
    data.cryptoDerivatives = sortRows(sheets.cryptoDerivatives).map((r) => ({
      title: r.title,
      value: r.value,
      sub: r.sub,
      is_placeholder: bool(r.is_placeholder),
      source_url: r.source_url,
    }));
  }

  return data;
}

async function loadExcelData() {
  const url = `${DATA_FILE}?v=${Date.now()}`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) throw new Error(`Excel file was not found: ${DATA_FILE}. HTTP status: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));
  const signature = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const isZipXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isLegacyXls = bytes[0] === 0xd0 && bytes[1] === 0xcf;

  if (!isZipXlsx && !isLegacyXls) {
    const preview = new TextDecoder("utf-8").decode(buffer.slice(0, 300));
    const looksLikeHtml = preview.trim().startsWith("<!doctype") || preview.trim().startsWith("<html") || preview.includes("<div id=\"root\"");
    if (looksLikeHtml) throw new Error("Expected an .xlsx file, but the app received HTML instead. Check public/data/morning_meeting_data.xlsx.");
    throw new Error(`Expected an Excel file, but received an unknown format. First bytes: ${signature}.`);
  }

  const XLSX = await import("xlsx");
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch (err) {
    throw new Error(`Failed to parse Excel workbook. ${err?.message || err}`);
  }

  const sheets = {};
  workbook.SheetNames.forEach((name) => {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
  });

  return normalizeWorkbook(sheets);
}

function buildSlide(data, key) {
  const meta = data.markets[key];
  if (!meta) return null;

  return {
    key,
    market: meta.market,
    section: meta.section_label,
    filters: String(meta.filters_csv || "").split(",").map((x) => x.trim()).filter(Boolean),
    source: meta.source,
    source_url: meta.source_url,
    sidebar: meta.sidebar_label,
    title: meta.chart_title,
    value: meta.chart_value,
    move: meta.chart_move,
    color: colorOf(meta.chart_color),
    hero: meta.hero_type,
    snapshotTitle: meta.snapshot_title,
    focus: {
      name: meta.focus_name,
      sub: meta.focus_sub,
      value: meta.focus_value,
      move: meta.focus_move,
      up: bool(meta.focus_up),
      source_url: meta.source_url,
    },
    placeholders: data.placeholders[key] || [],
    chart: data.mainChart[key] || [],
    stats: data.marketStats[key] || [],
    snapshot: data.snapshot[key] || [],
    news: data.news[key] || [],
    why: data.drivers[key] || [],
    conclusions: data.conclusions[key] || { stance: "N/A", bullets: [], presenterLine: "", source_url: "" },
    deeper: data.deeper[key] || { Context: [], Monitor: [], Risks: [], "Speaker Notes": [], Template: [] },
  };
}

function Header({ active, setActive }) {
  return (
    <div className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/90 px-5 backdrop-blur-xl">
      <div className="flex min-w-[290px] items-center gap-3">
        <motion.div animate={{ rotate: [0, 8, 0] }} transition={{ duration: 8, repeat: Infinity }} className="grid h-10 w-10 place-items-center rounded-full border border-amber-200 bg-amber-50 text-2xl text-amber-500">☼</motion.div>
        <div>
          <div className="font-serif text-2xl font-semibold leading-6 tracking-tight text-slate-950">MORNING MEETING</div>
          <div className="text-xs font-medium text-amber-600">Wednesday, May 28, 2025 • 8:30 AM ET</div>
        </div>
      </div>

      <div className="flex h-full items-center gap-7">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActive(t)} className="relative h-full px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-950">
            <span className={active === t ? "text-slate-950" : ""}>{t}</span>
            {active === t && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-amber-500" />}
          </button>
        ))}
      </div>

      <div className="flex min-w-[250px] items-center justify-end gap-3 text-slate-600">
        <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Excel connected</span>
        <button className="rounded-xl px-3 py-2 hover:bg-slate-50">▤ Slides</button>
        <button className="relative rounded-xl px-3 py-2 text-xl hover:bg-slate-50">♢<span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">3</span></button>
        <button className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">MS</span><span>⌄</span></button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]", className)}>{children}</div>;
}

function SectionTitle({ children, right = null, sourceUrl = null }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
        {children}
        <SourceInfo url={sourceUrl} />
      </div>
      {right}
    </div>
  );
}

function Spark({ up = true, muted = false }) {
  const pts = up ? [12, 18, 15, 23, 20, 26, 31, 28, 35] : [35, 31, 34, 26, 28, 21, 19, 16, 13];
  const color = muted ? "#94a3b8" : up ? C.green : C.red;
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${i * 9} ${40 - p}`).join(" ");
  return (
    <svg viewBox="0 0 76 42" className="h-10 w-20">
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`${d} L 72 42 L 0 42 Z`} fill={color} opacity="0.08" />
    </svg>
  );
}

function PlaceholderAccordion({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100">
        <span>Other markets</span><span>{open ? "⌃" : "⌄"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <motion.div whileHover={{ x: 4 }} key={item.name} className="relative flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left opacity-70 grayscale">
                  <div>
                    <div className="flex items-center gap-2 text-base font-semibold text-slate-500">{item.name}<SourceInfo url={item.source_url} /></div>
                    <div className="text-xs text-slate-400">{item.description}</div>
                    <div className="mt-1 inline-flex rounded-md bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">Placeholder</div>
                  </div>
                  <Spark muted />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ cfg }) {
  const f = cfg.focus;
  return (
    <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-slate-200/70 bg-white px-4 py-4">
      <div className="mb-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{cfg.section}</div>
        <div className="flex flex-wrap gap-2">
          {cfg.filters.map((x, i) => (
            <motion.button whileTap={{ scale: 0.96 }} key={x} className={cn("rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition", i === 0 ? "bg-amber-500 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100")}>{x}</motion.button>
          ))}
        </div>
      </div>

      <div className="mb-5 border-y border-slate-100 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">MARKET</div>
        <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-medium text-slate-800 shadow-sm"><span>{cfg.market}</span><span>⌄</span></button>
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{cfg.sidebar}</div>
      <motion.div whileHover={{ y: -2 }} className="flex w-full items-center justify-between rounded-xl border border-amber-400 bg-white p-3 text-left shadow-sm ring-1 ring-amber-100">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">{f.name}<SourceInfo url={f.source_url} /></div>
          <div className="text-xs text-slate-500">{f.sub}</div>
          <div className="mt-1 flex items-center gap-3"><span className="text-slate-600">{f.value}</span><span className={cn("text-sm font-semibold", f.up ? "text-emerald-600" : "text-red-500")}>{f.move} {f.up ? "▲" : "▼"}</span></div>
        </div>
        <Spark up={f.up} />
      </motion.div>

      <PlaceholderAccordion items={cfg.placeholders} />
      <button className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><span>▤ Configure markets</span><span>›</span></button>
      <div className="mt-8 text-xs leading-6 text-slate-500">All performance is daily % change<br />Source: {cfg.source}<br />Data as of 7:59 AM ET</div>
    </aside>
  );
}

function LineSVG({ points, color, valueSuffix = "" }) {
  if (!points?.length) return <div className="grid h-[255px] place-items-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-400">No chart data</div>;

  const values = points.map((p) => num(p.value));
  const labels = points.map((p) => p.label);
  const w = 760, h = 255, padL = 48, padR = 26, padT = 22, padB = 32;
  const minRaw = Math.min(...values), maxRaw = Math.max(...values), range = maxRaw - minRaw || 1;
  const min = minRaw - range * 0.12, max = maxRaw + range * 0.12, span = max - min || 1;
  const gid = `grad-${String(color).replace("#", "")}`;
  const pts = values.map((v, i) => [padL + (i * (w - padL - padR)) / (values.length - 1), padT + ((max - v) / span) * (h - padT - padB), v]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const area = `${d} L${w - padR},${h - padB} L${padL},${h - padB} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => max - p * span);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[255px] w-full overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.20" /><stop offset="70%" stopColor={color} stopOpacity="0.05" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
        <filter id="chartShadow"><feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.10" /></filter>
      </defs>
      <rect x="0" y="0" width={w} height={h} fill="white" />
      {yTicks.map((v, i) => {
        const y = padT + ((max - v) / span) * (h - padT - padB);
        return <g key={i}><line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" /><text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v.toFixed(maxRaw < 10 ? 2 : 0)}{valueSuffix}</text></g>;
      })}
      <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} d={area} fill={`url(#${gid})`} />
      <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.15, ease: "easeOut" }} d={d} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" filter="url(#chartShadow)" />
      {pts.map(([x, y], i) => i === pts.length - 1 || i === 0 || i === Math.floor(pts.length / 2) ? <motion.circle key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.65 + i * 0.015 }} cx={x} cy={y} r="4.8" fill="white" stroke={color} strokeWidth="3" /> : null)}
      {labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1).map((t, i) => {
        const idx = Math.min(labels.length - 1, i * Math.ceil(labels.length / 6));
        const x = padL + (idx * (w - padL - padR)) / (labels.length - 1);
        return <text key={`${t}-${i}`} x={x} y={h - 6} textAnchor="middle" fontSize="11" fill="#64748b">{t}</text>;
      })}
    </svg>
  );
}

function CurveChart({ curve, color = C.green }) {
  if (!curve?.length) return <div className="grid h-[270px] place-items-center rounded-xl bg-slate-50 text-sm font-semibold text-slate-400">No curve data</div>;

  const current = curve.map((x) => num(x.today));
  const previous = curve.map((x) => num(x.prior));
  const labels = curve.map((x) => x.tenor);
  const w = 640, h = 270, padL = 48, padR = 24, padT = 28, padB = 36;
  const all = [...current, ...previous];
  const min = Math.min(...all) - 0.25, max = Math.max(...all) + 0.25, span = max - min || 1;
  const point = (v, i) => [padL + (i * (w - padL - padR)) / (current.length - 1), padT + ((max - v) / span) * (h - padT - padB)];
  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${point(v, i)[0]},${point(v, i)[1]}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => min + (i * span) / 4);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[270px] w-full">
      <text x="10" y="18" fontSize="11" fontWeight="700" fill="#64748b">Yield (%)</text>
      {ticks.map((t) => {
        const y = padT + ((max - t) / span) * (h - padT - padB);
        return <g key={t}><line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{t.toFixed(2)}</text></g>;
      })}
      <motion.path initial={{ pathLength: 0, opacity: 0.5 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 1 }} d={path(previous)} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 4" />
      <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.05, delay: 0.1 }} d={path(current)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {current.map((v, i) => {
        const [x, y] = point(v, i);
        return <g key={labels[i]}><motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.08 }} cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" /><text x={x} y={y - 16} textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>{v.toFixed(2)}%</text><text x={x} y={h - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">{labels[i]}</text></g>;
      })}
    </svg>
  );
}

function WorldMapIntro({ data, onOpenUS }) {
  const [hover, setHover] = useState(null);
  const active = data.mapHotspots.find((h) => h.id === hover);

  return (
    <Card className="relative overflow-hidden p-5">
      <SectionTitle right={<div className="flex gap-4 rounded-xl border border-slate-100 bg-white px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm"><span className="text-emerald-600">● Up</span><span>● Flat</span><span className="text-red-500">● Down</span></div>}>GLOBAL EQUITY HEATMAP</SectionTitle>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-inner">
        <motion.img src={WORLD_MAP_ASSET} alt="Global equity heatmap world map" initial={{ opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }} className="absolute inset-0 h-full w-full object-contain" />
        {data.mapHotspots.map((h, idx) => {
          const activeHotspot = bool(h.is_active);
          const color = colorOf(h.color);
          return (
            <motion.button
              key={h.id}
              type="button"
              onMouseEnter={() => setHover(h.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => activeHotspot && onOpenUS()}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + idx * 0.05, type: "spring", stiffness: 180, damping: 16 }}
              whileHover={{ scale: 1.14 }}
              className={cn("absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white shadow-lg outline-none", activeHotspot ? "cursor-pointer" : "cursor-not-allowed opacity-80")}
              style={{ left: `${h.x_pct}%`, top: `${h.y_pct}%`, backgroundColor: color }}
            >
              <motion.span animate={activeHotspot ? { scale: [1, 1.8, 1], opacity: [0.55, 0, 0.55] } : {}} transition={{ duration: 2.2, repeat: Infinity }} className="absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="relative h-2.5 w-2.5 rounded-full bg-white" />
            </motion.button>
          );
        })}

        <AnimatePresence>
          {active && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.18 }} className="absolute w-[245px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur" style={{ left: `${active.x_pct}%`, top: `calc(${active.y_pct}% + 28px)`, transform: "translateX(-50%)" }}>
              <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-slate-900">{active.label}<SourceInfo url={active.source_url} /></div><div className="mt-1 text-xs text-slate-500">{active.index_name}</div></div><div className={cn("rounded-lg px-2 py-1 text-[10px] font-bold uppercase", bool(active.is_active) ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{bool(active.is_active) ? "Live" : "Placeholder"}</div></div>
              <div className={cn("mt-3 text-3xl font-bold", toneText[getTone(active.move)])}>{active.move}</div>
              <div className="mt-1 text-sm text-slate-500">Last: {active.value}</div>
              {bool(active.is_active) ? <div className="mt-3 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold uppercase text-emerald-700">Click to open S&P 500 detail</div> : <div className="mt-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-500">Detailed slide not configured</div>}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute bottom-5 left-5 rounded-xl border border-slate-100 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur">Hover a market for the tooltip. Click United States to open S&P 500 detail.</motion.div>
      </div>
    </Card>
  );
}

function SPIndustryBreakdown({ data }) {
  return (
    <Card className="p-5">
      <SectionTitle right={<div className="text-xs font-bold text-slate-400">Real move where sourced; gray = weight / N.A.</div>}>S&P 500 INDUSTRY BREAKDOWN</SectionTitle>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-4">
        {data.industryBreakdown.map((item, i) => {
          const tone = isNA(item.move) ? "neutral" : getTone(item.move);
          const width = getBarWidth(item.move, 5);
          const weightText = !isNA(item.weight) ? `Weight: ${item.weight}%` : "No weight";
          return (
            <motion.div key={item.industry} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -4, scale: 1.01 }} className={cn("min-h-[108px] rounded-xl border p-3", toneCard[tone])}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0 text-sm font-semibold leading-tight text-slate-800">{item.industry}</div><SourceInfo url={item.source_url} /></div>
              <div className={cn("mt-2 text-2xl font-bold", toneText[tone])}>{isNA(item.move) ? "N/A" : item.move}</div>
              {isNA(item.move) ? <div className="mt-2 text-xs font-semibold text-slate-500">{weightText}<br />No daily move sourced</div> : <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/90"><motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ delay: 0.2 + i * 0.03 }} className={cn("h-1.5 rounded-full", tone === "positive" ? "bg-emerald-500" : "bg-red-500")} /></div>}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

function MarketBreadthCard({ data }) {
  return (
    <Card className="p-5">
      <SectionTitle>MARKET BREADTH & LEADERSHIP</SectionTitle>
      <div className="text-xs font-semibold uppercase text-slate-500">Advancers vs Decliners</div>
      {data.breadthRows.map((r, idx) => {
        const share = r.advancers + r.decliners > 0 ? (r.advancers / (r.advancers + r.decliners)) * 100 : 0;
        return (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} key={r.name} className={cn("mt-3 grid grid-cols-[110px_1fr_64px_18px] items-center gap-3 text-sm", r.is_placeholder && "opacity-45 grayscale")}>
            <b>{r.name}</b><div className="flex h-2 overflow-hidden rounded-full bg-slate-100"><motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }} className="bg-emerald-500" /><div className="flex-1 bg-red-500" /></div><span className="text-right text-slate-600">{r.ratio_label}</span><SourceInfo url={r.source_url} />
          </motion.div>
        );
      })}
      <div className="mt-5 rounded-xl border border-slate-100 p-3"><div className="text-xs font-semibold uppercase text-slate-500">Focused read-through</div><div className="mt-2 text-sm text-slate-700">Breadth data is shown only where sourced. Placeholder rows are rendered gray and excluded from the signal.</div></div>
    </Card>
  );
}

function StocksHero({ data }) {
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.9fr)]"><SPIndustryBreakdown data={data} /><MarketBreadthCard data={data} /></div>;
}

function FXHero({ data }) {
  const currencies = data.fxHeatmap.currencies;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="p-5">
        <SectionTitle>FX RATES TABLE</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_20px] bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-500"><span>Pair</span><span>Last</span><span>Move</span><span>High</span><span>Low</span><span /></div>
          {data.fxRates.map((r) => {
            const tone = r.is_placeholder ? "neutral" : getTone(r.move);
            return <motion.div whileHover={{ backgroundColor: "#f8fafc" }} key={r.pair} className={cn("grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_20px] border-t border-slate-100 px-3 py-3 text-sm", r.is_placeholder && "opacity-45 grayscale")}><b>{r.pair}</b><span>{r.last}</span><span className={cn("font-bold", toneText[tone])}>{r.is_placeholder ? "Placeholder" : r.move}</span><span>{r.high}</span><span>{r.low}</span><SourceInfo url={r.source_url} /></motion.div>;
          })}
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">G10 strength vs USD</div>
          <div className="space-y-2">
            {data.fxStrength.map((r, i) => {
              const tone = getTone(r.move);
              const width = getBarWidth(r.move, 1);
              return <div key={r.currency} className="grid grid-cols-[42px_1fr_62px_18px] items-center gap-3 text-sm"><b>{r.currency}</b><div className="h-2.5 rounded-full bg-white"><motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ delay: i * 0.05 }} className={cn("h-2.5 rounded-full", tone === "positive" ? "bg-emerald-500" : tone === "negative" ? "bg-red-500" : "bg-slate-300")} /></div><b className={toneText[tone]}>{isNA(r.move) ? "N/A" : `${parseSignedValue(r.move) > 0 ? "+" : ""}${r.move}%`}</b><SourceInfo url={r.source_url} /></div>;
            })}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle sourceUrl={data.fxHeatmap.source_url} right={<span className="text-xs font-bold text-slate-400">Daily % change</span>}>G10 CROSS-RATE HEATMAP</SectionTitle>
        <div className="grid gap-1 text-center text-[11px]" style={{ gridTemplateColumns: `52px repeat(${currencies.length}, minmax(58px, 1fr))` }}>
          <div />
          {currencies.map((c) => <div key={c} className="py-1 font-bold text-slate-600">{c}</div>)}
          {currencies.map((row) => (
            <React.Fragment key={row}>
              <div className="py-2 text-left font-bold text-slate-700">{row}</div>
              {(data.fxHeatmap.rows[row] || []).map((v, i) => {
                const tone = getTone(v);
                const neutral = isNA(v) || v === "—";
                return <motion.div key={`${row}-${currencies[i]}`} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.015 }} whileHover={{ scale: 1.08, zIndex: 2 }} className={cn("rounded-md border px-1 py-2 font-bold", neutral ? "border-slate-100 bg-slate-50 text-slate-400" : tone === "negative" ? "border-red-100 bg-red-50 text-red-500" : "border-emerald-100 bg-emerald-50 text-emerald-600")}>{neutral ? "—" : v}</motion.div>;
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-center gap-3 text-[11px] font-semibold text-slate-500"><span>Stronger vs USD</span><div className="h-2 w-24 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-100" /><span>0</span><div className="h-2 w-24 rounded-full bg-gradient-to-r from-red-100 to-red-500" /><span>Weaker vs USD</span></div>
        <div className="mt-4 text-xs text-slate-400">AUD and NZD are hidden until sourced.</div>
      </Card>
    </div>
  );
}

function CommoditiesHero({ data }) {
  const [tab, setTab] = useState("% CHANGE");
  const grouped = groupBy(data.commodityTiles, "group");
  const groups = Object.keys(grouped);

  return (
    <Card className="p-5">
      <SectionTitle right={<div className="flex overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-1 text-xs font-bold text-slate-500">{["% CHANGE", "PRICE"].map((x) => <button key={x} onClick={() => setTab(x)} className={cn("rounded-lg px-4 py-2 transition", tab === x ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-900")}>{x}</button>)}</div>}>SECTOR PERFORMANCE</SectionTitle>
      <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-4">
        {groups.map((g) => (
          <div key={g} className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/70">
            <div className="border-b border-slate-100 bg-white px-3 py-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-600">{g}</div>
            <div className="grid grid-cols-2 gap-2 p-2">
              {grouped[g].map((it, i) => {
                const tone = getTone(it.move);
                return <motion.div key={it.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} whileHover={{ y: -3, scale: 1.015 }} className={cn("min-h-[82px] rounded-lg border p-3", it.span === 2 && "col-span-2", toneCard[tone])}><div className="flex items-start justify-between gap-2"><div className="text-xs font-semibold text-slate-800">{it.name}</div><SourceInfo url={it.source_url} /></div><div className="mt-1 text-xs font-bold text-slate-500">{it.price}</div><div className={cn("mt-1 text-lg font-extrabold", toneText[tone])}>{tab === "PRICE" ? it.price : isNA(it.move) ? "N/A" : it.move}</div></motion.div>;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs font-semibold text-slate-500"><span className="text-red-500">▼ Down</span><div className="h-3 w-40 rounded-full bg-gradient-to-r from-red-500 via-red-100 to-white" /><span>0</span><div className="h-3 w-40 rounded-full bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-700" /><span className="text-emerald-600">Up ▲</span></div>
    </Card>
  );
}

function BondsHero({ data }) {
  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,.62fr)_minmax(190px,.42fr)]">
      <Card className="p-5">
        <SectionTitle right={<div className="flex gap-4 text-xs font-semibold text-slate-500"><span className="text-emerald-600">● Today</span><span className="text-slate-400">● Prior close</span></div>}>US TREASURY CURVE</SectionTitle>
        <CurveChart curve={data.bondCurve} color={C.green} />
        <div className="mt-2 text-xs text-slate-400">Curve points are read from Excel. If sources have mixed dates, disclose this in the source notes.</div>
      </Card>

      <Card className="p-5">
        <SectionTitle right={<span className="text-xs font-bold text-slate-400">bp</span>}>DAILY MOVE BY TENOR</SectionTitle>
        <div className="space-y-2">
          {data.bondTenorMoves.map((r, i) => {
            const tone = r.bp > 0 ? "negative" : r.bp < 0 ? "positive" : "neutral";
            return <div key={r.tenor} className="grid grid-cols-[38px_1fr_48px_18px] items-center gap-3 text-sm"><b className="text-slate-700">{r.tenor}</b><div className={cn("relative h-7 overflow-hidden rounded-md", tone === "positive" ? "bg-emerald-50" : tone === "negative" ? "bg-red-50" : "bg-slate-50")}><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(Math.abs(r.bp) * 18, 100)}%` }} transition={{ delay: i * 0.04 }} className={cn("absolute right-0 h-full rounded-md", tone === "positive" ? "bg-gradient-to-l from-emerald-200 to-emerald-50" : tone === "negative" ? "bg-gradient-to-l from-red-200 to-red-50" : "bg-slate-200")} /></div><b className={cn("text-right", toneText[tone])}>{r.bp}</b><SourceInfo url={r.source_url} /></div>;
          })}
        </div>
      </Card>

      <div className="space-y-3">
        {data.bondMetricCards.map((r, i) => {
          const tone = r.positive ? "positive" : getTone(r.sub);
          return <motion.div key={r.title} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }} whileHover={{ y: -3 }} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"><div className="flex items-start justify-between gap-2"><div className="text-xs font-extrabold uppercase leading-4 text-slate-500">{r.title}</div><SourceInfo url={r.source_url} /></div><div className={cn("mt-2 text-2xl font-extrabold", tone === "positive" ? "text-emerald-600" : "text-slate-900")}>{r.value}</div><div className={cn("mt-1 text-xs font-bold", toneText[getTone(r.sub)])}>{r.sub}</div></motion.div>;
        })}
      </div>
    </div>
  );
}

function CryptoHero({ data, cfg }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card className="p-5">
        <SectionTitle>CRYPTO MARKET STRUCTURE</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-xs font-bold uppercase text-amber-700">Focus asset</div>
            <div className="mt-2 text-3xl font-extrabold text-slate-950">{cfg.focus.name}</div>
            <div className="mt-1 text-lg font-bold text-slate-700">{cfg.focus.value}</div>
            <div className={cn("mt-2 text-lg font-extrabold", toneText[getTone(cfg.focus.move)])}>{cfg.focus.move}</div>
            <SourceInfo url={cfg.focus.source_url} />
          </motion.div>
          <div className="space-y-3">
            {data.cryptoStructure.map((r, i) => {
              const muted = r.is_placeholder || isNA(r.value);
              return <motion.div key={r.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={cn("flex items-center justify-between rounded-xl border p-3", muted ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-100 bg-white")}><span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: muted ? "#cbd5e1" : r.color }} />{r.name}</span><span className="flex items-center gap-2 text-sm font-bold">{muted ? "N/A" : r.value}<SourceInfo url={r.source_url} /></span></motion.div>;
            })}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>BTC DERIVATIVES</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {data.cryptoDerivatives.map((r) => {
            const muted = r.is_placeholder || isNA(r.value);
            const tone = muted ? "neutral" : getTone(r.sub);
            return <motion.div whileHover={{ y: -3 }} key={r.title} className={cn("rounded-xl border p-4", muted ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-100 bg-white")}><div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold uppercase text-slate-500">{r.title}</div><SourceInfo url={r.source_url} /></div><div className="mt-2 text-xl font-bold">{muted ? "N/A" : r.value}</div><div className={cn("text-sm font-semibold", toneText[tone])}>{muted ? "Not sourced" : r.sub}</div>{!muted && <Spark up={tone !== "negative"} />}</motion.div>;
          })}
        </div>
      </Card>
    </div>
  );
}

function Hero({ cfg, data, openStocksDetail, stocksDetail }) {
  if (cfg.hero === "stocks" && !stocksDetail) return <WorldMapIntro data={data} onOpenUS={openStocksDetail} />;
  if (cfg.hero === "stocks") return <StocksHero data={data} />;
  if (cfg.hero === "fx") return <FXHero data={data} />;
  if (cfg.hero === "commodities") return <CommoditiesHero data={data} />;
  if (cfg.hero === "bonds") return <BondsHero data={data} />;
  return <CryptoHero data={data} cfg={cfg} />;
}

function MainChart({ cfg }) {
  const down = cfg.color === C.red;
  const chartSource = cfg.chart.find((x) => x.source_url)?.source_url || cfg.source_url;
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-slate-900">{cfg.title}<SourceInfo url={chartSource} /></div>
          <div className="mt-1 flex items-end gap-4"><span className="text-3xl font-bold text-slate-950">{cfg.value}</span><span className={down ? "text-lg font-bold text-red-500" : "text-lg font-bold text-emerald-600"}>{cfg.move}</span></div>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-500">{["1D", "5D", "1M", "YTD", "1Y", "5Y", "Max"].map((x, i) => <button key={x} className={i === 0 ? "border-b-2 border-amber-500 pb-2 text-slate-950" : "pb-2"}>{x}</button>)}<span>↗</span></div>
      </div>
      <LineSVG points={cfg.chart} color={cfg.color} />
      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/40 py-3 text-center lg:grid-cols-6">
        {cfg.stats.map((s) => <div key={s.label} className="px-2"><div className="flex justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}<SourceInfo url={s.source_url} /></div><div className="mt-1 text-sm font-semibold text-slate-800">{s.value}</div></div>)}
      </div>
    </Card>
  );
}

function NewsCard({ item }) {
  const href = primaryUrl(item.source_url);
  const inner = (
    <>
      <div className="mb-2 flex justify-between text-[10px] text-slate-400"><span>{item.source}</span><span>{item.time}</span></div>
      <div className="min-h-[54px] text-xs font-semibold leading-4 text-slate-800 group-hover:text-slate-950">{item.title}</div>
      <div className="mt-2 flex items-center justify-between"><span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">{item.tag}</span><span className={cn("text-[10px] font-bold", item.importance === "High" ? "text-amber-600" : "text-slate-400")}>{item.importance}</span></div>
    </>
  );

  if (!href) return <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">{inner}</div>;
  return <a href={href} target="_blank" rel="noreferrer" className="group rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">{inner}</a>;
}

function Insights({ cfg }) {
  const [open, setOpen] = useState(false);
  const shown = open ? cfg.news : cfg.news.slice(0, 3);

  return (
    <div className="w-[340px] shrink-0 space-y-4 overflow-y-auto p-4 pl-0">
      <Card className="p-5">
        <SectionTitle>WHY IT MOVED</SectionTitle>
        <div className="space-y-5">
          {cfg.why.map((w, i) => <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} key={w.title} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-base font-bold text-emerald-600">{i + 1}</span><div><div className="flex items-center gap-2 font-bold text-slate-900">{w.title}<SourceInfo url={w.source_url} /></div><div className="mt-1 text-sm leading-5 text-slate-600">{w.text}</div></div></motion.div>)}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>{cfg.snapshotTitle}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {cfg.snapshot.map((s) => {
            const tone = getTone(s.sub || s.value);
            const neutral = isNA(s.sub) || isNA(s.value);
            return <motion.div whileHover={{ y: -3 }} key={s.label} className={cn("rounded-xl border p-3 text-center shadow-sm", neutral ? toneCard.neutral : "border-slate-100 bg-white")}><div className="flex justify-center gap-1 text-[10px] font-bold uppercase leading-3 text-slate-500">{s.label}<SourceInfo url={s.source_url} /></div><div className="mt-2 text-lg font-bold text-slate-900">{s.value}</div><div className={cn("mt-1 text-xs font-semibold", toneText[tone])}>{s.sub}</div></motion.div>;
          })}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle sourceUrl={cfg.conclusions.source_url}>WHAT NEXT?</SectionTitle>
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">{cfg.conclusions.stance}</div>
        <ul className="space-y-2 text-sm text-slate-700">{cfg.conclusions.bullets.map((n) => <li key={n} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />{n}</li>)}</ul>
        <div className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-700">Presenter line: {cfg.conclusions.presenterLine}</div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between"><SectionTitle>TOP NEWS</SectionTitle><button onClick={() => setOpen(!open)} className="whitespace-nowrap text-sm font-bold text-amber-600">{open ? "Show less" : "View all"} ›</button></div>
        <AnimatePresence initial={false}><motion.div layout className="grid grid-cols-2 gap-2">{shown.map((n) => <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} key={n.title}><NewsCard item={n} /></motion.div>)}</motion.div></AnimatePresence>
      </Card>
    </div>
  );
}

function DeeperBackground({ cfg }) {
  const [mode, setMode] = useState("Context");
  const modes = ["Context", "Monitor", "Risks", "Speaker Notes", "Template"];
  const content = cfg.deeper || {};
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div><div className="text-sm font-bold uppercase tracking-wide text-slate-900">DEEPER BACKGROUND TEMPLATE</div><div className="mt-1 text-sm text-slate-500">Second layer: context, risks, monitoring points and speaking notes.</div></div>
        <div className="flex gap-2 rounded-xl bg-slate-50 p-1">{modes.map((x) => <button key={x} onClick={() => setMode(x)} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition", mode === x ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900")}>{x}</button>)}</div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {(content[mode] || []).map((item, i) => <div key={`${mode}-${i}`} className={cn("rounded-xl border p-4", mode === "Risks" ? "border-red-100 bg-red-50/60" : mode === "Monitor" ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100 bg-slate-50/70")}><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">{mode} {(content[mode] || []).length > 1 ? i + 1 : ""}<SourceInfo url={item.source_url} /></div><div className="text-sm font-semibold leading-5 text-slate-800">{item.text}</div></div>)}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function Page({ cfg, data }) {
  const [stocksDetail, setStocksDetail] = useState(false);
  const showDetail = cfg.key !== "Stocks" || stocksDetail;
  return (
    <motion.div key={cfg.market} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }} className="flex h-[calc(100vh-76px)] overflow-hidden bg-slate-50/60">
      <Sidebar cfg={cfg} />
      <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4">
        {cfg.key === "Stocks" && stocksDetail && <button onClick={() => setStocksDetail(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50">← Back to global map</button>}
        <Hero cfg={cfg} data={data} stocksDetail={stocksDetail} openStocksDetail={() => setStocksDetail(true)} />
        {showDetail && <><MainChart cfg={cfg} /><DeeperBackground cfg={cfg} /></>}
        <div className="flex items-center justify-center gap-4 pb-6 pt-1 text-sm font-semibold uppercase tracking-[0.35em] text-slate-400"><span className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white shadow-sm">⌄</span>Scroll down for deeper breakdown</div>
      </main>
      <Insights cfg={cfg} />
    </motion.div>
  );
}

export default function MorningMeetingDeck() {
  const [active, setActive] = useState("Stocks");
  const [marketData, setMarketData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadExcelData()
      .then((d) => { if (!cancelled) { setMarketData(d); setLoadError(null); } })
      .catch((err) => { if (!cancelled) { setMarketData(null); setLoadError(err?.message || "Failed to load Excel data file"); } });
    return () => { cancelled = true; };
  }, []);

  const cfg = useMemo(() => marketData ? buildSlide(marketData, active) : null, [marketData, active]);

  if (!marketData || !cfg) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50 p-8 text-slate-900">
        <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="text-xl font-bold">Morning Meeting data is not loaded</div>
          <div className="mt-3 text-sm leading-6 text-slate-600">The dashboard renders market data only from Excel. Put the workbook here:</div>
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">public/data/morning_meeting_data.xlsx</div>
          {loadError && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{loadError}</div>}
          <div className="mt-4 text-sm text-slate-500">After changing Excel, save it and hard-refresh the browser. The fetch URL includes a timestamp, so stale browser cache should not be used.</div>
        </div>
      </div>
    );
  }

  return <div className="h-screen overflow-hidden bg-white text-slate-900"><Header active={active} setActive={setActive} /><AnimatePresence mode="wait"><Page key={active} cfg={cfg} data={marketData} /></AnimatePresence></div>;
}
