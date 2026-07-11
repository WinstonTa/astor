// Builds a fully self-contained static HTML document for the "Save as HTML"
// button — no React/Tailwind at runtime, so styles are inlined and the
// scroll-reveal effect is replicated with a small vanilla IntersectionObserver
// script. Visual language intentionally mirrors GroceryReportView.tsx.
import type { IGroceryReport } from "./useRunStream";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildStandaloneHtml(report: IGroceryReport): string {
  const theme = report.tripTheme ? escapeHtml(report.tripTheme) : "Grocery Report";
  const generatedAt = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const itemCards = report.items
    .map(
      (item, i) => `
      <article class="card" style="--i:${i}">
        <div class="card-img"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.itemName)}" loading="lazy" /></div>
        <div class="card-body">
          <h3>${escapeHtml(item.itemName)}</h3>
          <div class="card-price">${escapeHtml(item.estimatedPriceDisplay)}</div>
          ${item.sizeDisplay ? `<div class="card-size">${escapeHtml(item.sizeDisplay)}</div>` : ""}
        </div>
      </article>`,
    )
    .join("\n");

  const ledgerRows = [
    ["Estimated total", report.estimatedTotalDisplay],
    ["Best stores for this run", report.bestStores.join(", ") || "—"],
    ["Related meals to explore", report.relatedMeals.join(", ") || "—"],
  ]
    .map(
      ([label, value]) => `
        <div class="ledger-row">
          <span class="ledger-label">${escapeHtml(label)}</span>
          <span class="ledger-fill"></span>
          <span class="ledger-value">${escapeHtml(value)}</span>
        </div>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${theme} — Grocery Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root {
    --obsidian: #0b0a09;
    --obsidian-2: #131110;
    --panel: #171513;
    --hairline: rgba(240,232,220,0.1);
    --bone: #f2ead9;
    --bone-dim: #b9b0a0;
    --bone-faint: #746c60;
    --brass: #cc9a4e;
    --brass-bright: #e8b96a;
    --phosphor: #7dffb0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--obsidian);
    background-image:
      radial-gradient(60% 50% at 15% 0%, rgba(204,154,78,0.14), transparent 60%),
      radial-gradient(45% 40% at 100% 20%, rgba(125,255,176,0.06), transparent 60%);
    color: var(--bone);
    font-family: "Instrument Sans", -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 72px 28px 96px; }
  .eyebrow {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--brass-bright);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .eyebrow::before { content: ""; width: 22px; height: 1px; background: var(--brass-bright); }
  h1 {
    font-family: "Fraunces", serif;
    font-style: italic;
    font-weight: 500;
    font-size: clamp(40px, 7vw, 76px);
    line-height: 1.02;
    margin: 18px 0 20px;
    letter-spacing: -0.01em;
  }
  .narrative {
    font-family: "Fraunces", serif;
    font-size: 19px;
    line-height: 1.6;
    color: var(--bone-dim);
    max-width: 640px;
    border-left: 2px solid var(--brass);
    padding-left: 20px;
    margin: 0 0 8px;
  }
  .meta { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--bone-faint); margin-top: 10px; }
  .section-label {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--bone-faint);
    margin: 64px 0 22px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .section-label::after { content: ""; flex: 1; height: 1px; background: var(--hairline); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 18px;
  }
  .card {
    border: 1px solid var(--hairline);
    background: linear-gradient(180deg, rgba(23,21,19,0.72), rgba(23,21,19,0.55));
    border-radius: 16px;
    overflow: hidden;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s cubic-bezier(.16,1,.3,1), transform 0.6s cubic-bezier(.16,1,.3,1);
    transition-delay: calc(var(--i) * 40ms);
  }
  .card.in-view { opacity: 1; transform: translateY(0); }
  .card-img { aspect-ratio: 4/3; background: var(--obsidian-2); overflow: hidden; }
  .card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .card-body { padding: 14px 16px 18px; }
  .card-body h3 { margin: 0 0 6px; font-size: 14px; font-weight: 500; color: var(--bone); }
  .card-price { font-family: "IBM Plex Mono", monospace; font-size: 15px; color: var(--brass-bright); }
  .card-size { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--bone-faint); margin-top: 4px; }
  .ledger {
    border: 1px solid var(--hairline);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(23,21,19,0.72), rgba(23,21,19,0.55));
    padding: 8px 26px;
  }
  .ledger-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 18px 0;
    border-bottom: 1px solid var(--hairline);
  }
  .ledger-row:last-child { border-bottom: none; }
  .ledger-label { font-family: "IBM Plex Mono", monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--bone-faint); white-space: nowrap; }
  .ledger-fill { flex: 1; border-bottom: 1px dotted var(--hairline); transform: translateY(-4px); }
  .ledger-value { font-family: "Fraunces", serif; font-size: 17px; color: var(--bone); text-align: right; max-width: 60%; }
  footer { margin-top: 72px; text-align: center; font-family: "IBM Plex Mono", monospace; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--bone-faint); }
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">Grocery Report · Astor</div>
  <h1>${theme}</h1>
  ${report.narrative ? `<p class="narrative">"${escapeHtml(report.narrative)}"</p>` : ""}
  <div class="meta">Generated ${generatedAt} — estimates only, not live store pricing</div>

  <div class="section-label">Shopping List</div>
  <div class="grid">${itemCards}</div>

  <div class="section-label">Field Notes</div>
  <div class="ledger">${ledgerRows}</div>

  <footer>Astor Grocery Runner — prices and availability are AI estimates, not live store data</footer>
</div>
<script>
  var els = document.querySelectorAll('.card');
  var io = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.15 });
  els.forEach(function(el) { io.observe(el); });
</script>
</body>
</html>`;
}

export function downloadHtmlFile(report: IGroceryReport): void {
  const html = buildStandaloneHtml(report);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (report.tripTheme || "grocery-report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.href = url;
  a.download = `${slug || "grocery-report"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
