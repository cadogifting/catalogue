/* CADO catalogue, version 3. Same engine as version 2: reads window.CADO (data.js, written by
   tools/build_data.py) and window.CADO_CONFIG (config.js); every product fact comes from data.js.
   Routes: #/ and #/c/<collection>[/<section>]   collection home
           #/p/<CAD-id>                           product page
           #/selection                            selection and request
           #/s/<code>                             shared selection, loaded then shown
   Photographs fill their frames. fit() crops each one from the box round the piece in data.js, and
   the rows are laid out so that every frame has a shape its photo can fill without cutting the piece. */
(() => {
"use strict";
const CFG = window.CADO_CONFIG || {}, D = window.CADO, DATA = CFG.data || "data/";
const EMAIL = CFG.email || "info@cadogifting.com";
const app = document.getElementById("app");
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = n => Number(n).toLocaleString("en-GB");
const aed = n => "AED " + fmt(n);
const full = c => [c.title, c.year].filter(Boolean).join(" ");
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = n => WORDS[n] || fmt(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const fold = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* Collections. data.js holds one today; a later build can write D.collections with the same shape. */
const COLLECTIONS = (D.collections || [{
  key: slug(full(D.collection)), ...D.collection,
  cover: D.cover, tiers: D.tiers, themes: D.themes, products: D.products
}]);
COLLECTIONS.forEach(c => c.products.forEach(p => { p._c = c; }));
const ALL = COLLECTIONS.flatMap(c => c.products);
const byId = id => ALL.find(p => p.id === id);
const tierOf = p => p._c.tiers.find(t => t.key === p.tier);
const themeOf = p => p._c.themes.find(t => t.key === p.theme);
const hasPrice = p => Array.isArray(p.tiers) && p.tiers.length > 0 && p.price != null;
const unitFor = (p, q) => { if (!hasPrice(p)) return null; let u = p.tiers[0].price; for (const t of p.tiers) if (q >= t.min) u = t.price; return u; };
const topPrice = p => hasPrice(p) ? Math.max(...p.tiers.map(t => t.price)) : null;
const minOf = p => Math.max(p.min || 1, 1);
const span = t => t.max ? `${fmt(t.min)} to ${fmt(t.max)} pieces` : `${fmt(t.min)} pieces or more`;
const pcs = n => `${fmt(n)} ${n === 1 ? "piece" : "pieces"}`;
const no = p => `No. ${p.ref}`;
const img = id => `${DATA}images/${id}.jpg`;
const occLabel = o => o.replace(/\bGifting\b/, "gifting");
/* Display order within a collection: by tier, then by price, then by catalogue number. */
const byPrice = (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9) || a.ref.localeCompare(b.ref);
const ordered = c => c.tiers.flatMap(t => c.products.filter(p => p.tier === t.key).sort(byPrice))
  .concat(c.products.filter(p => !c.tiers.some(t => t.key === p.tier)));
function tierRange(c, t){
  const i = c.tiers.indexOf(t), prev = i > 0 ? c.tiers[i - 1].below : null;
  if (t.below == null) return prev == null ? "All budgets" : `AED ${fmt(prev)} and above`;
  return prev == null ? `Under AED ${fmt(t.below)}` : `AED ${fmt(prev)} to ${fmt(t.below)}`;
}

/* Photographs. The shapes a photo can fill without cutting the piece: from lo (narrowest) to hi
   (widest), worked out from the photo's own shape and the box round the piece. */
function shape(p){
  const i = p.img || {}, P = i.w && i.h ? i.w / i.h : 4 / 3, b = i.box || [0, 0, 1, 1];
  const lo = P * (b[2] - b[0]), hi = P / (b[3] - b[1]);
  return {P, b, lo: clamp(lo, .5, P), hi: clamp(hi, P, 3.2)};
}
const prefer = (p, r) => { const s = shape(p); return clamp(r, s.lo, s.hi); };
function photo(p, attrs = ""){
  if (!p.img) return `<span class="no-photo">Photograph to follow</span>`;
  const s = shape(p);
  return `<img src="${img(p.id)}" data-p="${s.P.toFixed(4)}" data-box="${s.b.join(",")}" data-bg="${p.img.bg || ""}" width="${p.img.w}" height="${p.img.h}" ${attrs}>`;
}
/* Crop a photo to its frame: keep the box round the piece whole, and centre it where possible. */
function fit(im){
  const P = +im.dataset.p, b = (im.dataset.box || "0,0,1,1").split(",").map(Number);
  const w = im.clientWidth, h = im.clientHeight;
  if (!P || !w || !h) return;
  const r = w / h, frame = im.parentElement;
  const keep = r < P ? Math.min(1, (r / P) / (b[2] - b[0])) : r > P ? Math.min(1, (P / r) / (b[3] - b[1])) : 1;
  const bg = im.dataset.bg || "", rgb = /^#[0-9a-f]{6}$/i.test(bg) ? [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16)) : null;
  if (keep < .9 && rgb && .299 * rgb[0] + .587 * rgb[1] + .114 * rgb[2] > 205){
    im.style.objectFit = "contain"; im.style.objectPosition = "50% 50%"; frame.style.background = bg; return;
  }
  im.style.objectFit = ""; frame.style.background = "";
  const axis = (size, a, z) => {
    if (size >= 1) return 50;
    const lo = Math.max(0, z - size), hi = Math.min(a, 1 - size), c = (a + z) / 2 - size / 2;
    const start = lo <= hi ? clamp(c, lo, hi) : clamp(c, 0, 1 - size);
    return start / (1 - size) * 100;
  };
  const x = r < P ? axis(r / P, b[0], b[2]) : 50, y = r > P ? axis(P / r, b[1], b[3]) : 50;
  im.style.objectPosition = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
}
const fitAll = (root = document) => $$("img[data-box]", root).forEach(fit);

/* Grid: every card the same size and shape, two across on a phone, three on a tablet, four on a
   desktop. When a single card would be left alone in the last row, the piece with the widest photo
   takes two columns instead. */
function mode(){
  const w = window.innerWidth;
  return {max: w < 720 ? 2 : w < 1024 ? 3 : 4};
}
function gridHTML(list, qty){
  const n = list.length, cols = mode().max;
  const wide = cols > 1 && n > 1 && n % cols === 1 ? list.reduce((a, p) => shape(p).lo > shape(a).lo ? p : a, list[0]) : null;
  return `<div class="grid" style="--cols:${cols}">${list.map(p => cardHTML(p, qty, p === wide)).join("")}</div>`;
}
/* Shapes for one row of photos (used by the desktop cover collage): each photo gets a shape it can
   fill without cutting the piece, and together they fill the row. */
function rowFit(items, S){
  const sh = items.map(p => shape(p)), pref = sh.map(s => clamp(1.3, s.lo, s.hi));
  const lo = sh.reduce((a, s) => a + s.lo, 0), hi = sh.reduce((a, s) => a + s.hi, 0), sp = pref.reduce((a, b) => a + b, 0);
  const T = clamp(S, lo, hi);
  const r = sh.map((s, k) => T >= sp ? pref[k] + (s.hi - pref[k]) * (hi > sp ? (T - sp) / (hi - sp) : 0)
                                     : pref[k] - (pref[k] - s.lo) * (sp > lo ? (sp - T) / (sp - lo) : 0));
  return {T, r};
}

/* Selection: id -> {q, logo, pack}, kept in this browser. Request details are never stored. */
const KEY = "cado.selection.v3";
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: keep in memory */ } },
  drop(k){ try { localStorage.removeItem(k); } catch (e) { /* nothing to remove */ } }
};
store.drop("cado.request.v1");   // request details an earlier version kept; no longer stored
store.drop("cado.finder.v1");    // the finder now lives in the shop bar and is not stored
const item = (q, logo = true, pack = false) => ({q, logo, pack});
let sel = new Map((store.get(KEY, []) || []).filter(([id, q]) => byId(id) && q > 0).map(([id, q, f = "l"]) => [id, item(q, f.includes("l"), f.includes("p"))]));
const flags = it => (it.logo ? "l" : "") + (it.pack ? "p" : "");
function saveSel(){ store.set(KEY, [...sel].map(([id, it]) => [id, it.q, flags(it)])); updCount(); }
function updCount(){
  const n = sel.size;
  $("#count").textContent = n;
  $(".bar-sel").setAttribute("aria-label", `Your selection, ${n} ${n === 1 ? "gift" : "gifts"}`);
}
const shareCode = () => [...sel].map(([id, it]) => `${parseInt(id.slice(4), 10)}x${it.q}${flags(it)}`).join(".");
const shareUrl = () => `${location.origin}${location.pathname}#/s/${shareCode()}`;
function importCode(code){
  const m = new Map();
  code.split(".").forEach(part => {
    const g = part.match(/^(\d+)x(\d+)([lp]*)$/); if (!g) return;
    const id = "CAD-" + g[1].padStart(5, "0"), q = parseInt(g[2], 10);
    if (byId(id) && q > 0) m.set(id, item(Math.min(q, 100000), g[3].includes("l"), g[3].includes("p")));
  });
  return m;
}
const selTotal = () => [...sel].reduce((s, [id, it]) => s + (unitFor(byId(id), it.q) || 0) * it.q, 0);
const optText = it => `${it.logo ? "with our logo" : "without a logo"}, ${it.pack ? "custom packaging" : "standard packaging"}`;

/* Request reference: one per request, shown to the buyer and written into the request. */
const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRef(){
  const a = new Uint32Array(6); (window.crypto || {getRandomValues: x => x.map(() => Math.random() * 4e9)}).getRandomValues(a);
  return "CADO-" + [...a].map(v => REF_CHARS[v % REF_CHARS.length]).join("");
}
let reqRef = newRef();

/* Shared markup */
function priceHTML(p, big){
  if (!hasPrice(p)) return `<p class="pr"><b>Price on request</b></p>`;
  if (p.tiers.length === 1 || !big) return `<p class="pr num"><b>${p.tiers.length > 1 ? "From " : ""}${aed(p.price)}</b><span>per gift</span></p>`;
  return `<ul class="pr-tiers num">${p.tiers.map(t => `<li><b>${aed(t.price)}</b><span>${span(t)}</span></li>`).join("")}</ul>`;
}
const addLabel = id => sel.has(id) ? "In your selection" : "Add to selection";
function addBtn(p, q){ return `<button type="button" class="tbtn add${sel.has(p.id) ? " is-in" : ""}" data-add="${p.id}" data-qty="${q}">${addLabel(p.id)}</button>`; }
function addDot(p, q){
  const on = sel.has(p.id);
  return `<button type="button" class="add-dot${on ? " is-in" : ""}" data-add="${p.id}" data-qty="${q}" aria-label="${on ? "In your selection" : "Add to selection"}: ${esc(p.name)}" title="${on ? "In your selection" : "Add to selection"}">${on ? "✓" : "+"}</button>`;
}
function cardHTML(p, qty, wide){
  const q = Math.max(qty || 0, minOf(p)), u = unitFor(p, q);
  const est = qty && u ? `<p class="card-est num">${fmt(q)} × ${aed(u)} = <b>${aed(q * u)}</b></p>` : "";
  const price = !hasPrice(p) ? "Price on request" : qty ? aed(u) : `${p.tiers.length > 1 ? "From " : ""}${aed(p.price)}`;
  return `<article class="card${wide ? " wide" : ""}">
    <a class="ph" href="#/p/${p.id}" tabindex="-1" aria-hidden="true">${photo(p, 'alt="" loading="lazy"')}</a>
    ${addDot(p, q)}
    <div class="card-body">
      <h3 class="card-name"><a href="#/p/${p.id}">${esc(p.name)}</a></h3>
      <p class="card-meta num"><b>${price}</b> <span class="nw">· min. ${fmt(minOf(p))}</span> <span class="nw">· ${no(p)}</span></p>
      ${est}
    </div>
  </article>`;
}
function stepHTML(id, q, min, small){
  return `<div class="step${small ? " small" : ""}">
    <button type="button" data-step="-1" data-for="${id}" aria-label="Fewer">−</button>
    <input class="num" type="number" inputmode="numeric" min="${min}" step="1" value="${q}" data-qty-for="${id}" aria-label="Quantity">
    <button type="button" data-step="1" data-for="${id}" aria-label="More">+</button>
  </div>`;
}
function optsHTML(id, it){
  return `<div class="checks" role="group" aria-label="Options for this gift">
    <label class="check"><input type="checkbox" data-opt="logo" data-for="${id}"${it.logo ? " checked" : ""}>With our logo</label>
    <label class="check"><input type="checkbox" data-opt="pack" data-for="${id}"${it.pack ? " checked" : ""}>Custom packaging</label>
  </div>`;
}
const select = (name, label, opts, val) => `<label class="field"><span>${label}</span><select class="select" name="${name}">
  ${opts.map(([v, t]) => `<option value="${esc(v)}"${String(val) === String(v) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;

/* Header navigation */
function renderNav(c, active){
  $("#bar-nav").innerHTML = [["collection", "The collection"], ["finder", "Gifts for your list"]]
    .map(([k, t]) => `<a href="#/c/${c.key}/${k}"${active === k ? ' aria-current="true"' : ""}>${t}</a>`).join("")
    + (CFG.pdf ? `<a href="${esc(CFG.pdf)}" target="_blank" rel="noopener">PDF</a>` : "");
}

/* Opening collage: the first photo across the top, the others in one full row beneath. Every
   frame takes a shape its photo allows, so no piece is cut. */
function collageHTML(c, cov){
  const pics = (c.cover.collage || []).map(byId).filter(Boolean);
  if (pics.length < 2) return `<a class="ph" href="#/p/${cov.id}" aria-label="${esc(cov.name)}" style="aspect-ratio:${prefer(cov, 1.25).toFixed(4)}">${photo(cov, `alt="${esc(cov.alt)}" fetchpriority="high"`)}</a>`;
  const [top, ...rest] = pics, {T, r} = rowFit(rest, 3.4), n = rest.length;
  const link = (p, style) => `<a class="ph" href="#/p/${p.id}" aria-label="${esc(p.name)}" style="${style}">${photo(p, `alt="${esc(p.alt)}"${p === top ? ' fetchpriority="high"' : ""}`)}</a>`;
  return link(top, `aspect-ratio:${prefer(top, 2.2).toFixed(4)}`)
    + `<div class="collage-row">${rest.map((p, k) => link(p, `flex:0 0 calc((100% - var(--cg) * ${n - 1}) * ${(r[k] / T).toFixed(5)});aspect-ratio:${r[k].toFixed(4)}`)).join("")}</div>`;
}

/* Collection home: a short cover, one shop bar, then the products. The finder (number of people)
   lives in the shop bar; on a phone the filters open in a sheet. */
let browse = {q: "", people: "", tier: "", occ: "", theme: "", sort: ""};
function renderHome(c){
  const cov = byId(c.cover.opening) || byId(c.cover.image) || c.products[0];
  const prices = c.products.filter(hasPrice), lo = Math.min(...prices.map(p => p.price)), hi = Math.max(...prices.map(topPrice));
  const occs = [...new Set(c.products.flatMap(p => p.occasions || []))];
  const delivIncl = c.products.some(p => /included/i.test(p.spec?.Delivery || ""));
  app.innerHTML = `
  <section class="cover" aria-labelledby="cover-h"><div class="cover-grid">
    <div class="cover-text">
      <p class="run"><span>CADO corporate gifts</span><span>${esc(c.eyebrow || "")}</span></p>
      <div class="cover-title"><img class="cover-mono" src="assets/monogram-creme.svg" alt="" width="40" height="52">
        <h1 id="cover-h">${esc(c.title)} <span class="thin">${esc(c.year)}</span></h1></div>
      <p class="lede">${esc(c.line)}</p>
    </div>
    <div class="cover-collage">${collageHTML(c, cov)}</div>
  </div></section>

  <div class="shop" id="collection"><div class="wrap">
    <form class="tools" id="tools" role="search" onsubmit="return false">
      <label class="field search"><span class="vh">Search</span><input class="input" type="search" name="q" placeholder="Search name, contents or number" value="${esc(browse.q)}" autocomplete="off"></label>
      <button type="button" class="filters-btn" id="filters-btn" aria-expanded="false" aria-controls="sheet">Filters <span class="num" id="filters-n"></span></button>
      <div class="sheet" id="sheet" role="group" aria-label="Filters">
        <div class="sheet-head"><b>Filters</b><button type="button" class="tbtn" data-sheet-close>Done</button></div>
        <label class="field people"><span>Number of people</span><input class="input num" name="people" type="number" inputmode="numeric" min="1" placeholder="Number of people" value="${esc(browse.people)}"></label>
        ${select("tier", "Budget per gift", [["", "Any budget"]].concat(c.tiers.map(t => [t.key, tierRange(c, t)])), browse.tier)}
        ${select("occ", "Occasion", [["", "All occasions"]].concat(occs.map(o => [o, occLabel(o)])), browse.occ)}
        ${select("theme", "Theme", [["", "All themes"]].concat(c.themes.map(t => [t.key, t.title])), browse.theme)}
        ${select("sort", "Order", [["", "By budget"], ["asc", "Price, low to high"], ["desc", "Price, high to low"]], browse.sort)}
        <button type="button" class="btn wide sheet-show" data-sheet-close>Show gifts</button>
      </div>
    </form>
  </div></div>
  <div class="wrap">
    <p class="facts-line num">AED ${fmt(lo)} to ${fmt(hi)} per gift, excluding VAT · Your logo on every piece</p>
    <div class="tools-sum" id="tools-sum" aria-live="polite"></div>
  </div>
  <div id="tiers"></div>

  <section class="closing" aria-labelledby="closing-h"><div class="wrap closing-in">
    <div><h2 id="closing-h">Your selection, <b>quoted</b></h2>
      <p>Send CADO the pieces and quantities you have in mind. We reply with a quotation for your logo, packaging, delivery and timing. Nothing is ordered until you approve it.</p>
      <p class="muted">Prices are per gift, in AED, excluding VAT. Minimum quantities are shown on each piece. Delivery is ${delivIncl ? "included within the UAE where shown, otherwise quoted with your order" : "quoted with your order"}.</p></div>
    <div class="closing-acts">
      <a class="btn" href="#/selection">View your selection</a>
      ${CFG.pdf ? `<a class="arrow" href="${esc(CFG.pdf)}" target="_blank" rel="noopener">The collection as a PDF</a>` : ""}
    </div>
  </div></section>`;
  renderBrowse(c);
}

/* Search, number of people, budget, occasion, theme and order */
function matches(p, q){
  if (!q) return true;
  const n = q.match(/^(?:no\.?\s*)?(?:cad-?)?0*(\d{1,5})$/i);
  if (n) return parseInt(p.ref, 10) === parseInt(n[1], 10);
  const hay = fold([p.name, p.line, p.category, ...(p.description || []), p.spec?.Contents, p.spec?.Finish, p.spec?.Presentation, themeOf(p)?.title, p.id, no(p)].join(" "));
  return fold(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function renderBrowse(c){
  const box = $("#tiers"); if (!box) return;
  const q = browse.q.trim(), people = parseInt(browse.people, 10) || 0;
  const filtered = !!(q || people || browse.tier || browse.occ || browse.theme);
  const base = c.products.filter(p => matches(p, q) && (!browse.tier || p.tier === browse.tier) && (!browse.occ || (p.occasions || []).includes(browse.occ)) && (!browse.theme || p.theme === browse.theme));
  const shown = base.filter(p => !people || minOf(p) <= people), larger = base.length - shown.length;
  const dir = browse.sort === "desc" ? -1 : 1, tiers = browse.sort === "desc" ? [...c.tiers].reverse() : c.tiers;
  const parts = tiers.map(t => {
    const items = shown.filter(p => p.tier === t.key).sort((a, b) => dir * byPrice(a, b));
    if (!items.length) return "";
    return `<section class="tier" id="tier-${t.key}" aria-labelledby="tier-${t.key}-h">
      <header class="band-tier"><div class="wrap band-in"><h2 id="tier-${t.key}-h">${esc(t.title)}</h2><p class="num">${tierRange(c, t)}</p></div></header>
      <div class="wrap">${gridHTML(items, people)}</div>
    </section>`;
  }).join("");
  box.innerHTML = parts || `<div class="wrap none"><p>Nothing matches ${q ? `“${esc(q)}”` : "this choice"}.</p><button type="button" class="tbtn" data-clear-browse>Show the whole collection</button></div>`;
  const t = c.tiers.find(x => x.key === browse.tier), th = c.themes.find(x => x.key === browse.theme);
  const what = [q ? `“${q}”` : "", people ? `for ${fmt(people)} people` : "", t ? tierRange(c, t) : "", browse.occ ? occLabel(browse.occ) : "", th ? th.title : ""].filter(Boolean);
  $("#tools-sum").innerHTML = filtered
    ? `<p><b class="num">${shown.length ? cap(word(shown.length)) : "No"} ${shown.length === 1 ? "gift" : "gifts"}</b>: ${esc(what.join(", "))}.${larger ? ` ${cap(word(larger))} more ${larger === 1 ? "needs" : "need"} a larger order.` : ""}${people ? " Totals are shown on each piece." : ""}</p><button type="button" class="tbtn" data-clear-browse>Clear</button>`
    : "";
  const active = [people, browse.tier, browse.occ, browse.theme, browse.sort].filter(Boolean).length;
  $("#filters-n").textContent = active ? `(${active})` : "";
  requestAnimationFrame(() => fitAll(box));
}
function sheet(open){
  document.body.classList.toggle("sheet-open", open);
  const b = $("#filters-btn"); if (b) b.setAttribute("aria-expanded", String(open));
}

/* Product page */
function renderProduct(p){
  const c = p._c, t = tierOf(p), th = themeOf(p), list = ordered(c), i = list.indexOf(p);
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const it = sel.get(p.id) || item(minOf(p));
  const spec = Object.assign({}, p.spec);
  const delivery = spec.Delivery; delete spec.Delivery;
  const rows = [["Contents", spec.Contents], ["Size", spec.Size], ["Finish", spec.Finish], ["Presentation", spec.Presentation],
    ["Your logo", "Available, quoted with your order"], ["Delivery", delivery]].filter(([, v]) => v);
  const also = list.filter(x => x.tier === p.tier && x.id !== p.id).slice(0, mode().max);
  app.innerHTML = `<div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb"><a href="#/c/${c.key}">${esc(full(c))}</a>${t ? `<a href="#/c/${c.key}/tier-${t.key}">${esc(t.title)}</a>` : ""}</nav>
    <article class="pp">
      <figure class="pp-fig">
        ${p.img ? `<img src="${img(p.id)}" alt="${esc(p.alt)}" width="${p.img.w}" height="${p.img.h}">` : photo(p)}
        <figcaption>Images show the standard design. Your gifts are finished with your logo.</figcaption>
      </figure>
      <div class="pp-info">
        <p class="pp-no num">${no(p)}${th ? ` · ${esc(th.title)}` : ""}</p>
        <h1>${esc(p.name)}</h1>
        <p class="lede">${esc(p.line)}</p>
        <div class="pp-price">${priceHTML(p, true)}</div>
        <p class="pp-terms num">Per gift, in AED, excluding VAT. Minimum ${pcs(minOf(p))}.</p>
        ${p.note ? `<p class="pp-note">${esc(p.note)}</p>` : ""}
        <div class="qty-row">${stepHTML(p.id, it.q, minOf(p))}
          <button type="button" class="btn" data-add="${p.id}" data-from="pp">${sel.has(p.id) ? "Update your selection" : "Add to selection"}</button></div>
        <div class="pp-opts">${optsHTML(p.id, it)}</div>
        <p class="total num" id="pp-total" aria-live="polite"></p>
        <dl class="spec">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        ${p.description?.length ? `<div class="about"><h2>About this piece</h2>${p.description.map(x => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
      </div>
    </article>
    <nav class="pp-nav" aria-label="More pieces">
      <a href="#/p/${prev.id}"><span>Previous</span><b>${esc(prev.name)}</b></a>
      <a href="#/p/${next.id}"><span>Next</span><b>${esc(next.name)}</b></a>
    </nav>
    ${also.length ? `<section class="also"><h2>Also ${t ? esc(t.title.charAt(0).toLowerCase() + t.title.slice(1)) : "in this collection"}</h2>${gridHTML(also)}</section>` : ""}
  </div>`;
  updPPTotal();
  requestAnimationFrame(() => fitAll(app));
}
function updPPTotal(){
  const inp = $("[data-qty-for]", $(".qty-row") || document), out = $("#pp-total");
  if (!inp || !out) return;
  const p = byId(inp.dataset.qtyFor), n = parseInt(inp.value, 10) || 0, u = unitFor(p, n);
  if (n < minOf(p)) { out.innerHTML = `<span class="warn">The minimum for this piece is ${pcs(minOf(p))}.</span>`; return; }
  if (u == null) { out.textContent = `${pcs(n)}. Price on request.`; return; }
  const better = p.tiers.find(t => t.min > n && t.price < u);
  out.innerHTML = `${fmt(n)} × ${aed(u)} = <b>${aed(n * u)}</b>, excluding VAT.${better ? ` From ${fmt(better.min)} pieces, ${aed(better.price)} each.` : ""}`;
}

/* Selection and request. What the buyer types is held only while the page is open. */
let notice = "", formMem = {}, lastRequest = "";
function renderSelection(){
  const n = sel.size, v = k => esc(formMem[k] || "");
  const emirates = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "More than one emirate"];
  const lines = [...sel].map(([id, it]) => {
    const p = byId(id), u = unitFor(p, it.q), low = it.q < minOf(p);
    return `<li class="line">
      <a class="ph" href="#/p/${p.id}" tabindex="-1" aria-hidden="true">${photo(p, 'alt=""')}</a>
      <div><p class="line-name"><a href="#/p/${p.id}">${esc(p.name)}</a></p>
        <p class="line-meta num">${no(p)} · ${u != null ? `${aed(u)} per gift` : "Price on request"}</p></div>
      <p class="line-total num">${u != null ? aed(u * it.q) : "On request"}</p>
      <div class="line-ctl">${stepHTML(p.id, it.q, minOf(p), true)}<button type="button" class="tbtn" data-rm="${p.id}">Remove</button></div>
      <div class="line-opts">${optsHTML(p.id, it)}</div>
      ${low ? `<p class="line-warn warn">The minimum for this piece is ${pcs(minOf(p))}.</p>` : ""}
    </li>`;
  }).join("");
  const pieces = [...sel.values()].reduce((a, it) => a + it.q, 0);
  const por = [...sel.keys()].some(id => !hasPrice(byId(id)));
  app.innerHTML = `<section class="sec"><div class="wrap">
    <div class="sec-head"><div><h1>Your selection</h1>
      <p>Set quantities and options for each gift, then send the selection to CADO for a quotation.</p></div></div>
    ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ""}
    <div class="sel-grid">
      <div>
        ${n ? `<ul class="lines">${lines}</ul>
        <div class="sum"><span>Indicative total</span><b class="num">${aed(selTotal())}</b></div>
        <p class="sum-note num">${cap(word(n))} ${n === 1 ? "gift" : "gifts"}, ${pcs(pieces)}. AED, excluding VAT${por ? ", plus pieces priced on request" : ""}. Your quotation confirms prices and adds logo, packaging and delivery.</p>
        <div class="sel-acts">
          <button type="button" class="tbtn" id="share">Copy a link to this selection</button>
          <button type="button" class="tbtn" id="print">Print a summary</button>
          <button type="button" class="tbtn muted" id="clear">Clear the selection</button>
        </div>
        <div class="share-box" id="share-box" hidden><input class="input" id="share-url" readonly aria-label="Link to this selection"></div>`
        : `<div class="empty"><p>Nothing chosen yet. Add pieces from the collection, or tell us how many people in the filters, then come back here to send your request.</p>
          <div class="acts"><a class="btn" href="#/c/${COLLECTIONS[0].key}/collection">See the collection</a></div></div>`}
      </div>
      <form class="request" id="request" novalidate autocomplete="on">
        <h2>Request a quotation</h2>
        <p>Your selection is attached. CADO replies by email.</p>
        <label class="field"><span>Company</span><input class="input" name="company" autocomplete="organization" required value="${v("company")}"></label>
        <div class="two">
          <label class="field"><span>Your name</span><input class="input" name="name" autocomplete="name" required value="${v("name")}"></label>
          <label class="field"><span>Phone</span><input class="input" name="phone" type="tel" autocomplete="tel" inputmode="tel" value="${v("phone")}"></label>
        </div>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" required value="${v("email")}"></label>
        <label class="field"><span>Delivery emirate</span><select class="select" name="emirate"><option value="">Choose an emirate</option>
          ${emirates.map(e => `<option${formMem.emirate === e ? " selected" : ""}>${e}</option>`).join("")}</select></label>
        <label class="field"><span>Notes</span><textarea class="input" name="notes" rows="3" placeholder="Anything CADO should know, such as a message card or a mix of pieces">${v("notes")}</textarea></label>
        <div class="req-acts">
          <button type="submit" class="btn wide"${n ? "" : " disabled"}>Send request to CADO</button>
          <button type="button" class="tbtn" id="copy-req"${n ? "" : " disabled"}>Copy the request instead</button>
        </div>
        <div id="req-done" aria-live="polite"></div>
        <p class="req-small">Sending opens an email to ${esc(EMAIL)} with your request written out. Nothing is ordered until you approve a quotation. What you type here is not saved in this browser.</p>
      </form>
    </div>
  </div></section>`;
  notice = "";
  requestAnimationFrame(() => fitAll(app));
}
function formData(){ const f = $("#request"); return f ? Object.fromEntries(new FormData(f)) : formMem; }
function requestText(f){
  const cols = [...new Set([...sel.keys()].map(id => { const c = byId(id)._c; return full(c); }))].join(", ");
  const lines = [...sel].map(([id, it]) => { const p = byId(id), u = unitFor(p, it.q);
    return `- ${no(p)} ${p.name} (${p.id}): ${fmt(it.q)} × ${u != null ? `${aed(u)} = ${aed(u * it.q)}` : "price on request"}; ${optText(it)}`; });
  return [
    `Request for a quotation, reference ${reqRef}`, `Collection: ${cols}`, "",
    `Company: ${f.company || ""}`, `Name: ${f.name || ""}`, `Email: ${f.email || ""}`, `Phone: ${f.phone || "-"}`,
    `Delivery emirate: ${f.emirate || "-"}`, "",
    "Pieces:", ...lines, "",
    `Indicative total: ${aed(selTotal())}, excluding VAT`, "",
    `Notes: ${f.notes || "-"}`, "",
    `Selection link: ${shareUrl()}`
  ].join("\n");
}
async function copyText(t){
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (x) { ok = false; }
    ta.remove(); return ok;
  }
}
function forget(){ formMem = {}; const f = $("#request"); if (f) f.reset(); }
function reqDone(html){ const d = $("#req-done"); if (d) d.innerHTML = `<div class="req-done">${html}</div>`; }
async function sendRequest(){
  const form = $("#request");
  if (!sel.size) return;
  if (!form.reportValidity()) return;
  const low = [...sel].filter(([id, it]) => it.q < minOf(byId(id)));
  if (low.length){ toast(`Please raise ${esc(byId(low[0][0]).name)} to its minimum of ${minOf(byId(low[0][0]))}.`); return; }
  const f = formData(), text = requestText(f), ref = reqRef;
  lastRequest = text;
  if (CFG.requestEndpoint){
    try {
      const payload = {...f, ref, items: [...sel].map(([id, it]) => ({id, ref: byId(id).ref, name: byId(id).name, qty: it.q, logo: it.logo, packaging: it.pack, unit: unitFor(byId(id), it.q)})),
        total: selTotal(), link: shareUrl(), text};
      const r = await fetch(CFG.requestEndpoint, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(payload)});
      if (!r.ok) throw new Error(r.status);
      forget(); reqRef = newRef();
      reqDone(`<p>Thank you. Your request has reached CADO, and we reply by email to ${esc(f.email)}.</p><p>Your reference</p><p class="req-ref">${ref}</p>`);
      return;
    } catch (e) { /* fall through to email */ }
  }
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Quotation request ${ref}: ${f.company}`)}&body=${encodeURIComponent(text)}`;
  forget();
  reqDone(`<p>Your email app should now show the request, addressed to ${esc(EMAIL)}. Please press send there.</p>
    <p>Your reference</p><p class="req-ref">${ref}</p>
    <p>If nothing opened, <button type="button" class="tbtn" data-copy-last>copy the request</button> and email it to ${esc(EMAIL)}.</p>`);
}

/* One-page print summary of the selection */
function buildPrintSummary(){
  const f = formData();
  const rows = [...sel].map(([id, it]) => { const p = byId(id), u = unitFor(p, it.q);
    return `<tr><td><img src="${img(p.id)}" alt=""></td><td>${no(p)}</td><td>${esc(p.name)}<div class="o">${cap(optText(it))}</div></td><td class="r">${fmt(it.q)}</td><td class="r">${u != null ? aed(u) : "On request"}</td><td class="r">${u != null ? aed(u * it.q) : ""}</td></tr>`; }).join("");
  $("#print-summary").innerHTML = `
    <div class="ps-head"><div><img src="assets/wordmark-coal.svg" alt="CADO"><h1>Selection summary</h1></div>
      <p>Reference ${reqRef}${f.company ? "<br>" + esc(f.company) : ""}${f.name ? "<br>" + esc(f.name) : ""}</p></div>
    <table class="ps-table num"><thead><tr><th></th><th>No.</th><th>Piece</th><th class="r">Qty</th><th class="r">Per gift</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="ps-total num"><span>Indicative total, excluding VAT</span><b>${aed(selTotal())}</b></div>
    <p class="ps-note">Prices are per gift, in AED, excluding VAT, and indicative until CADO sends a quotation. The quotation adds your logo, packaging and delivery. Images show the standard design.</p>
    <div class="ps-foot"><span>CADO · ${esc(EMAIL)}</span><span>${esc(shareUrl())}</span></div>`;
}
window.addEventListener("beforeprint", () => {
  const on = document.body.dataset.route === "selection" && sel.size > 0;
  document.body.classList.toggle("print-sel", on);
  if (on) buildPrintSummary();
});
window.addEventListener("afterprint", () => document.body.classList.remove("print-sel"));

/* Feedback */
let toastTimer;
function toast(html){
  const t = $("#toast"); t.innerHTML = html; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 3600);
}
function bump(){ const b = $(".bar-sel"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
function refreshAddButtons(){
  $$(".add[data-add]").forEach(b => { const on = sel.has(b.dataset.add); b.classList.toggle("is-in", on); b.textContent = addLabel(b.dataset.add); });
  $$(".add-dot[data-add]").forEach(b => { const on = sel.has(b.dataset.add), n = byId(b.dataset.add).name;
    b.classList.toggle("is-in", on); b.textContent = on ? "✓" : "+"; b.title = on ? "In your selection" : "Add to selection"; b.setAttribute("aria-label", `${b.title}: ${n}`); });
}

/* Events */
document.addEventListener("click", async e => {
  const add = e.target.closest("[data-add]");
  if (add){
    const p = byId(add.dataset.add);
    if (add.dataset.from === "pp"){
      const q = Math.max(parseInt($("[data-qty-for]", $(".qty-row")).value, 10) || minOf(p), minOf(p));
      const o = Object.fromEntries($$("[data-opt]", $(".pp-opts")).map(x => [x.dataset.opt, x.checked]));
      sel.set(p.id, item(q, o.logo, o.pack)); saveSel(); bump(); renderProduct(p);
      toast(`${esc(p.name)}: ${pcs(q)} in your selection. <a href="#/selection">View selection</a>`);
      return;
    }
    if (sel.has(p.id)){ location.hash = "#/selection"; return; }
    sel.set(p.id, item(Math.max(parseInt(add.dataset.qty, 10) || minOf(p), minOf(p)))); saveSel(); bump(); refreshAddButtons();
    toast(`${esc(p.name)} added. <a href="#/selection">View selection</a>`);
    return;
  }
  const st = e.target.closest("[data-step]");
  if (st){
    const inp = $(`[data-qty-for="${st.dataset.for}"]`, st.parentElement), min = +inp.min || 1;
    inp.value = Math.max((parseInt(inp.value, 10) || min) + +st.dataset.step, min);
    inp.dispatchEvent(new Event("change", {bubbles: true}));
    return;
  }
  const rm = e.target.closest("[data-rm]");
  if (rm){ sel.delete(rm.dataset.rm); saveSel(); renderSelection(); return; }
  if (e.target.closest("#filters-btn")){ sheet(!document.body.classList.contains("sheet-open")); return; }
  if (e.target.closest("[data-sheet-close]")){ sheet(false); $("#tiers")?.scrollIntoView(); return; }
  if (e.target.closest("[data-clear-browse]")){ browse = {q: "", people: "", tier: "", occ: "", theme: "", sort: ""}; $$("#tools input, #tools select").forEach(x => { x.value = ""; }); renderBrowse(currentCollection()); return; }
  if (e.target.closest("#share")){
    const url = shareUrl(), ok = await copyText(url);
    const box = $("#share-box"); box.hidden = false; $("#share-url").value = url;
    toast(ok ? "Link copied. Anyone with it sees this selection." : "Copy the link below to share this selection.");
    return;
  }
  if (e.target.closest("#print")){ window.print(); return; }
  if (e.target.closest("#clear")){ if (confirm("Clear every piece from your selection?")){ sel.clear(); saveSel(); reqRef = newRef(); renderSelection(); } return; }
  if (e.target.closest("[data-copy-last]")){
    const ok = await copyText(lastRequest);
    toast(ok ? `Request copied. Paste it into an email to ${esc(EMAIL)}.` : "Your browser blocked copying. Please write to " + esc(EMAIL) + ".");
    return;
  }
  if (e.target.closest("#copy-req")){
    const form = $("#request"); if (!form.reportValidity()) return;
    const ok = await copyText(requestText(formData()));
    toast(ok ? `Request copied, reference ${reqRef}. Paste it into an email to ${esc(EMAIL)}.` : "Your browser blocked copying. Please select the text by hand.");
    return;
  }
});
document.addEventListener("change", e => {
  const inp = e.target.closest("[data-qty-for]");
  if (inp){
    const id = inp.dataset.qtyFor, q = Math.max(parseInt(inp.value, 10) || 0, 0);
    if (document.body.dataset.route === "selection"){
      if (q > 0){ sel.get(id).q = q; saveSel(); } renderSelection();
      const again = $(`[data-qty-for="${id}"]`); if (again) again.focus();
    } else updPPTotal();
    return;
  }
  const opt = e.target.closest("[data-opt]");
  if (opt){
    const it = sel.get(opt.dataset.for);
    if (it){ it[opt.dataset.opt] = opt.checked; saveSel(); }
    return;
  }
  if (e.target.closest("#tools")){
    const f = new FormData($("#tools")); browse = {q: f.get("q") || "", people: f.get("people") || "", tier: f.get("tier") || "", occ: f.get("occ") || "", theme: f.get("theme") || "", sort: f.get("sort") || ""};
    renderBrowse(currentCollection());
    return;
  }
  if (e.target.closest("#request")) formMem = formData();
});
let searchTimer;
document.addEventListener("input", e => {
  if (e.target.closest(".qty-row [data-qty-for]")) updPPTotal();
  if (e.target.closest("#tools") && (e.target.name === "q" || e.target.name === "people")){
    clearTimeout(searchTimer); const name = e.target.name, val = e.target.value;
    searchTimer = setTimeout(() => { browse[name] = val; renderBrowse(currentCollection()); }, 160);
  }
  if (e.target.closest("#request")) formMem = formData();
});
document.addEventListener("submit", e => { if (e.target.id === "request"){ e.preventDefault(); sendRequest(); } });
window.addEventListener("storage", e => { if (e.key === KEY){ sel = new Map((store.get(KEY, []) || []).map(([id, q, f = "l"]) => [id, item(q, f.includes("l"), f.includes("p"))])); updCount(); } });

/* Layout follows the screen: rows are rebuilt when the screen crosses a breakpoint, photos refit always. */
let lastMax = mode().max, resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (mode().max !== lastMax){ lastMax = mode().max; const y = window.scrollY; document.body.dataset.route = ""; route(); window.scrollTo(0, y); }
    fitAll();
  }, 120);
});
window.addEventListener("load", () => fitAll());
document.addEventListener("load", e => { if (e.target.matches?.("img[data-box]")) fit(e.target); }, true);
window.addEventListener("scroll", () => $("#bar").classList.toggle("scrolled", window.scrollY > 8), {passive: true});

/* Routing */
let homeKey = null;
function currentCollection(){ return COLLECTIONS.find(c => c.key === homeKey) || COLLECTIONS[0]; }
function route(){
  const h = decodeURIComponent(location.hash.slice(1)) || "/";
  let m;
  if ((m = h.match(/^\/s\/([\dxlp.]+)/))){
    const shared = importCode(m[1]);
    if (shared.size){ sel = shared; saveSel(); notice = "This is a shared selection. It is now saved in this browser, and you can change it before sending."; }
    location.replace("#/selection"); return;
  }
  if ((m = h.match(/^\/p\/(CAD-\d+)/)) && byId(m[1])){
    const p = byId(m[1]);
    document.body.dataset.route = "product"; homeKey = null; renderNav(p._c); renderProduct(p);
    document.title = `${p.name} · CADO`; window.scrollTo(0, 0); return;
  }
  if (h.startsWith("/selection")){
    document.body.dataset.route = "selection"; homeKey = null; renderNav(COLLECTIONS[0]); renderSelection();
    document.title = "Your selection · CADO"; window.scrollTo(0, 0); return;
  }
  m = h.match(/^\/c\/([^/]+)(?:\/([\w-]+))?/);
  const c = (m && COLLECTIONS.find(x => x.key === m[1])) || COLLECTIONS[0], sec = m && m[2];
  if (document.body.dataset.route !== "home" || homeKey !== c.key){ document.body.dataset.route = "home"; homeKey = c.key; renderHome(c); }
  renderNav(c, sec && !sec.startsWith("tier-") ? sec : (sec ? "collection" : ""));
  document.title = `CADO · ${full(c)} collection`;
  if (sec === "finder"){ $("#collection").scrollIntoView(); sheet(window.innerWidth < 720); setTimeout(() => $("#tools [name=people]")?.focus(), 50); requestAnimationFrame(() => fitAll()); return; }
  const target = sec && document.getElementById(sec);
  if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  requestAnimationFrame(() => fitAll());
}
window.addEventListener("hashchange", route);
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("sheet-open")) sheet(false); });
$("#preview-tag").hidden = !CFG.preview;
$("#foot-mail").href = `mailto:${EMAIL}`; $("#foot-mail").textContent = EMAIL;
if (CFG.pdf){ const a = $("#foot-pdf"); a.href = CFG.pdf; a.hidden = false; }
updCount();
route();
})();
