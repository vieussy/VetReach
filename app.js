'use strict';
/* =========================================================
   VetReach — application logic (vanilla JavaScript)
   1 Catalog & demo data   2 Helpers   3 State & persistence
   4 Planning engine       5 UI pieces 6 Views
   7 Dialogs               8 Actions & events   9 Boot
   ========================================================= */

/* ---------- 1. Catalog & demo data ---------- */
const STORE_KEY = 'vetreach-state-v1';
const THEME_KEY = 'vetreach-theme';
const WINDOW_DAYS = 10; // planning window: next 10 working days
const HOLIDAY_NAMES = {
  '2026-11-30': 'Bonifacio Day', '2026-12-08': 'Immaculate Conception', '2026-12-24': 'Christmas Eve',
  '2026-12-25': 'Christmas Day', '2026-12-30': 'Rizal Day', '2026-12-31': 'New Year’s Eve',
};
const HOLIDAYS = Object.keys(HOLIDAY_NAMES);

const CATEGORIES = {
  companion: { label: 'Companion', icon: 'paw', noun: 'dogs & cats', blurb: 'Vaccines, deworming, spay & neuter' },
  livestock: { label: 'Livestock', icon: 'cow', noun: 'head of livestock', blurb: 'Deworming, consults, insemination' },
  poultry:   { label: 'Poultry',   icon: 'hen', noun: 'birds', blurb: 'Vaccination & health checks' },
};
const QUALS = { para: 'Animal health technician', vet: 'Licensed veterinarian', surgery: 'Surgical team', ai: 'AI technician' };

// perDay = animals one team can serve per day; cost = base + perHead × animals + travel × days
const SERVICES = [
  { id: 'rabies',   name: 'Rabies vaccination',          cat: 'companion', qual: 'para',    supply: 'rabiesVax', perAnimal: 1,    perDay: 150,  base: 1500, perHead: 15 },
  { id: 'dewormC',  name: 'Pet deworming',               cat: 'companion', qual: 'para',    supply: 'dewormTab', perAnimal: 1,    perDay: 200,  base: 1000, perHead: 8 },
  { id: 'spay',     name: 'Spay & neuter',               cat: 'companion', qual: 'surgery', supply: 'surgKit',   perAnimal: 1,    perDay: 20,   base: 2500, perHead: 300 },
  { id: 'dewormL',  name: 'Livestock deworming',         cat: 'livestock', qual: 'para',    supply: 'dewormL',   perAnimal: 1,    perDay: 80,   base: 1200, perHead: 25 },
  { id: 'consultL', name: 'Livestock consultation',      cat: 'livestock', qual: 'vet',     supply: 'medPack',   perAnimal: 0.1,  perDay: 60,   base: 1500, perHead: 20 },
  { id: 'ai',       name: 'Artificial insemination',     cat: 'livestock', qual: 'ai',      supply: 'straw',     perAnimal: 1,    perDay: 15,   base: 2000, perHead: 350 },
  { id: 'vaxP',     name: 'Poultry vaccination',         cat: 'poultry',   qual: 'para',    supply: 'ncdVax',    perAnimal: 1,    perDay: 1000, base: 1000, perHead: 2 },
  { id: 'consultP', name: 'Poultry health consultation', cat: 'poultry',   qual: 'vet',     supply: 'medPack',   perAnimal: 0.02, perDay: 500,  base: 1200, perHead: 3 },
];
const TRAVEL = { 1: 500, 2: 1000, 3: 2000 }; // ₱ per day, by road access
const ACCESS = { 1: 'Easy road access', 2: 'Moderate access', 3: 'Remote · needs 4×4' };

// Priority factors. Weights are prototype assumptions the administrator can adjust.
const FACTORS = [
  { k: 'demand', label: 'Demand',        tone: 'peach',    desc: 'Animals in the request, compared with the largest request of the same kind.' },
  { k: 'gap',    label: 'Coverage gap',  tone: 'sage',     desc: 'Days since the barangay last had an outreach visit (capped at one year).' },
  { k: 'wait',   label: 'Waiting time',  tone: 'butter',   desc: 'Days since the request was filed (capped at 90 days).' },
  { k: 'access', label: 'Accessibility', tone: 'lavender', desc: 'Harder-to-reach barangays are usually underserved, so they get extra weight.' },
];

function seedState() {
  const r = (id, brgy, service, animals, requestedOn, prefFrom = '', prefTo = '') => ({ id, brgy, service, animals, requestedOn, prefFrom, prefTo });
  return {
    version: 1,
    settings: { municipality: 'Mabini Verde', province: 'Nueva Laguna', startDate: '2026-11-23', weights: { demand: 35, gap: 25, wait: 20, access: 20 } },
    barangays: [
      { id: 'pob', name: 'Poblacion',     access: 1, lastVisitDays: 45,  pop: { companion: 1450, livestock: 120, poultry: 2600 } },
      { id: 'sro', name: 'San Roque',     access: 1, lastVisitDays: 130, pop: { companion: 980,  livestock: 310, poultry: 4200 } },
      { id: 'mal', name: 'Malinao',       access: 2, lastVisitDays: 210, pop: { companion: 760,  livestock: 540, poultry: 3100 } },
      { id: 'bsi', name: 'Bagong Silang', access: 2, lastVisitDays: 95,  pop: { companion: 820,  livestock: 430, poultry: 1800 } },
      { id: 'kal', name: 'Kalayaan',      access: 3, lastVisitDays: 420, pop: { companion: 410,  livestock: 690, poultry: 1500 } },
      { id: 'tub', name: 'Tubigan',       access: 3, lastVisitDays: 300, pop: { companion: 350,  livestock: 820, poultry: 2200 } },
      { id: 'scz', name: 'Santa Cruz',    access: 1, lastVisitDays: 30,  pop: { companion: 1120, livestock: 90,  poultry: 3400 } },
    ],
    teams: [
      { id: 'sam', name: 'Team Sampaguita', lead: 'Dr. Ana Reyes, DVM',   members: 'Dr. Ana Reyes and two animal health technicians', quals: ['vet', 'para', 'surgery'], off: ['2026-12-01'] },
      { id: 'nar', name: 'Team Narra',      lead: 'Dr. Jose Santos, DVM', members: 'Dr. Jose Santos and one animal health technician', quals: ['vet', 'para'], off: ['2026-11-26'] },
      { id: 'mol', name: 'Team Molave',     lead: 'Mark Dela Cruz',       members: 'Mark Dela Cruz and two animal health technicians', quals: ['para'], off: ['2026-11-27'] },
      { id: 'ila', name: 'Team Ilang-Ilang', lead: 'Liza Ramos',          members: 'Liza Ramos (AI technician) and one assistant', quals: ['ai'], off: ['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-27', '2026-12-02', '2026-12-04', '2026-12-07'] },
    ],
    vehicles: [
      { id: 'van1', name: 'Service Van 1', offroad: false, off: [] },
      { id: 'van2', name: 'Service Van 2', offroad: false, off: ['2026-11-26', '2026-11-27'] },
      { id: 'p4x4', name: '4×4 Pickup',    offroad: true,  off: ['2026-12-07'] },
    ],
    supplies: [
      { id: 'rabiesVax', name: 'Anti-rabies vaccine',   unit: 'doses',   qty: 800 },
      { id: 'dewormTab', name: 'Pet dewormer',          unit: 'tablets', qty: 400 },
      { id: 'surgKit',   name: 'Spay & neuter kit',     unit: 'kits',    qty: 40 },
      { id: 'dewormL',   name: 'Livestock dewormer',    unit: 'doses',   qty: 150 },
      { id: 'medPack',   name: 'Veterinary medicine pack', unit: 'packs', qty: 20 },
      { id: 'straw',     name: 'Semen straw',           unit: 'straws',  qty: 30 },
      { id: 'ncdVax',    name: 'Poultry vaccine (NCD)', unit: 'doses',   qty: 3000 },
    ],
    budget: { total: 90000 },
    requests: [
      r('r1', 'pob', 'rabies', 300, '2026-10-20', '2026-11-23', '2026-11-27'),
      r('r2', 'sro', 'rabies', 260, '2026-10-05'),
      r('r3', 'mal', 'rabies', 220, '2026-09-28', '2026-12-01', '2026-12-04'),
      r('r4', 'kal', 'rabies', 180, '2026-09-10'),
      r('r5', 'bsi', 'spay', 30, '2026-10-12', '2026-11-24', '2026-11-27'),
      r('r6', 'scz', 'spay', 25, '2026-11-02', '2026-12-01', '2026-12-04'),
      r('r7', 'pob', 'dewormC', 250, '2026-11-05'),
      r('r8', 'tub', 'dewormL', 120, '2026-09-15'),
      r('r9', 'kal', 'consultL', 50, '2026-10-01'),
      r('r10', 'mal', 'ai', 12, '2026-10-18'),
      r('r11', 'tub', 'ai', 10, '2026-10-25'),
      r('r12', 'bsi', 'ai', 8, '2026-11-10'),
      r('r13', 'sro', 'vaxP', 1500, '2026-10-28'),
      r('r14', 'scz', 'vaxP', 1200, '2026-11-12', '2026-11-23', '2026-11-27'),
      r('r15', 'mal', 'consultP', 400, '2026-11-01'),
    ],
    plan: null,    // { status: 'suggested' | 'approved', activities, reasons, stale, generatedAt }
    history: [],   // plan snapshots for undo
    log: [{ at: new Date().toISOString(), text: 'Fictional demo data loaded for Mabini Verde' }],
    resolved: 0,   // conflicts resolved through replanning
  };
}

/* ---------- 2. Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const peso = (n) => '₱' + Math.round(n).toLocaleString('en-PH');
const num = (n) => Math.round(n).toLocaleString('en-PH');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pct = (a, b) => (b > 0 ? clamp((a / b) * 100, 0, 100) : 0);
const withArticle = (s) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s.toLowerCase();
const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// Dates are ISO strings (YYYY-MM-DD) handled in UTC so time zones never shift them.
const toDate = (s) => new Date(s + 'T00:00:00Z');
const isoOf = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const fmt = (s, opt = { weekday: 'short', month: 'short', day: 'numeric' }) => (s ? toDate(s).toLocaleDateString('en-PH', { ...opt, timeZone: 'UTC' }) : '');
const fmtTime = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function planningDays() {
  const days = [];
  for (let d = state.settings.startDate; days.length < WINDOW_DAYS; d = addDays(d, 1)) {
    const wd = toDate(d).getUTCDay();
    if (wd > 0 && wd < 6 && !HOLIDAYS.includes(d)) days.push(d);
  }
  return days;
}

const find = (list, id) => list.find((x) => x.id === id);
const req = (id) => find(state.requests, id);
const svc = (r) => find(SERVICES, r.service);
const brgy = (r) => find(state.barangays, r.brgy);
const team = (id) => find(state.teams, id);
const vehicle = (id) => find(state.vehicles, id);
const supply = (id) => find(state.supplies, id);
const activityFor = (r) => state.plan?.activities.find((a) => a.requestId === r.id);

/** What a request needs: supply quantity, number of team-days and estimated cost. */
function needs(r) {
  const s = svc(r);
  const days = Math.max(1, Math.ceil(r.animals / s.perDay));
  return { supply: s.supply, qty: Math.ceil(r.animals * s.perAnimal), days, cost: s.base + s.perHead * r.animals + TRAVEL[brgy(r).access] * days };
}

/* ---------- 3. State & persistence ---------- */
let state = load();
const ui = {
  route: null, filter: 'all', search: '', flash: null, justGenerated: null, dragId: null,
  planView: 'list',                                       // Plan page: 'list' or 'calendar'
  resTab: 'teams',                                        // Resources page tab
  cal: { view: 'month', day: state.settings.startDate },  // selected calendar day and range
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.version === 1 && Array.isArray(saved.requests) && Array.isArray(saved.teams)) return saved;
  } catch (e) { /* corrupted or blocked storage — fall back to demo data */ }
  return seedState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save in this browser — changes will be lost on refresh.', { tone: 'alert' }); }
}
function addLog(text) {
  state.log.push({ at: new Date().toISOString(), text });
  state.log = state.log.slice(-30);
}
function pushHistory() {
  state.history.push(JSON.stringify(state.plan));
  state.history = state.history.slice(-15);
}
/** Resource or request edits after planning: keep the plan but flag it, and re-check it live. */
function markStale() { if (state.plan) state.plan.stale = true; }

/* ---------- 4. Planning engine ---------- */

/** Transparent priority score (0–100) for every request: weighted sum of four normalised factors. */
function scoreRequests() {
  const w = state.settings.weights;
  const totalW = FACTORS.reduce((s, f) => s + w[f.k], 0) || 1;
  const ref = state.settings.startDate;
  const maxByCat = {};
  state.requests.forEach((r) => { const c = svc(r).cat; maxByCat[c] = Math.max(maxByCat[c] || 0, r.animals); });
  const out = {};
  for (const r of state.requests) {
    const b = brgy(r);
    const f = {
      demand: r.animals / maxByCat[svc(r).cat],
      gap: Math.min(b.lastVisitDays / 365, 1),
      wait: clamp(daysBetween(r.requestedOn, ref) / 90, 0, 1),
      access: (b.access - 1) / 2,
    };
    const parts = {};
    FACTORS.forEach(({ k }) => { parts[k] = (w[k] * f[k] / totalW) * 100; });
    out[r.id] = { parts, total: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)) };
  }
  return out;
}

/** Days an activity occupies, or null if it does not fit inside the planning window. */
function spanOf(a, days = planningDays()) {
  const r = req(a.requestId);
  const i = days.indexOf(a.start);
  const n = r ? needs(r).days : 1;
  return i < 0 || i + n > days.length ? null : days.slice(i, i + n);
}

/**
 * Find conflict-free (team, vehicle, start day) slots for a request, given existing activities.
 * Preferred dates come first; teams with fewer qualifications are tried first so specialists stay free;
 * ordinary vans are used before the 4×4, which is saved for remote barangays.
 */
function findSlots(r, acts, limit = 1) {
  const days = planningDays(), n = needs(r).days, b = brgy(r), s = svc(r);
  const busy = new Set();
  acts.forEach((a) => (spanOf(a, days) || []).forEach((d) => { busy.add('t' + a.teamId + d); busy.add('v' + a.vehicleId + d); }));
  const inPref = (d) => (!r.prefFrom || d >= r.prefFrom) && (!r.prefTo || d <= r.prefTo);
  const starts = days.slice(0, days.length - n + 1).map((d, i) => ({ d, i })).sort((x, y) => inPref(y.d) - inPref(x.d) || x.i - y.i);
  const teams = state.teams.filter((t) => t.quals.includes(s.qual)).sort((x, y) => x.quals.length - y.quals.length);
  const vans = state.vehicles.filter((v) => b.access < 3 || v.offroad).sort((x, y) => x.offroad - y.offroad);
  const out = [];
  for (const { d, i } of starts) {
    const span = days.slice(i, i + n);
    for (const t of teams) {
      if (span.some((x) => t.off.includes(x) || busy.has('t' + t.id + x))) continue;
      const v = vans.find((v) => !span.some((x) => v.off.includes(x) || busy.has('v' + v.id + x)));
      if (!v) continue;
      out.push({ teamId: t.id, vehicleId: v.id, start: d, preferred: inPref(d) });
      if (out.length >= limit) return out;
      break; // one option per day keeps suggestions varied
    }
  }
  return out;
}

/** Greedy planner: highest priority first; each request takes the first feasible slot within remaining supplies and budget. */
function generatePlan() {
  const scores = scoreRequests();
  const order = [...state.requests].sort((a, b) => scores[b.id].total - scores[a.id].total);
  const left = Object.fromEntries(state.supplies.map((s) => [s.id, s.qty]));
  let budget = state.budget.total;
  const activities = [], reasons = {};
  for (const r of order) {
    const s = svc(r), n = needs(r), sup = supply(n.supply);
    let reason = '';
    if (!state.teams.some((t) => t.quals.includes(s.qual))) reason = `No qualified team — this needs ${withArticle(QUALS[s.qual])}`;
    else if (left[n.supply] < n.qty) reason = `Not enough supplies — ${sup.name.toLowerCase()}: needs ${num(n.qty)} ${sup.unit}, only ${num(left[n.supply])} left`;
    else if (budget < n.cost) reason = `Not enough budget — needs ${peso(n.cost)}, ${peso(budget)} left`;
    else {
      const [slot] = findSlots(r, activities);
      if (!slot) reason = brgy(r).access === 3 ? 'No available team with a 4×4 vehicle on the same open dates' : 'No available team on open dates';
      else { activities.push({ id: uid(), requestId: r.id, ...slot }); left[n.supply] -= n.qty; budget -= n.cost; }
    }
    if (reason) reasons[r.id] = reason;
  }
  return { status: 'suggested', generatedAt: new Date().toISOString(), activities, reasons, stale: false };
}

/** Check every rule for a set of activities. Returns issues per activity plus plan-wide issues. */
function validate(acts) {
  const days = planningDays(), issues = {}, global = [], use = {}, slots = {};
  let cost = 0;
  const add = (id, msg) => { if (!issues[id].includes(msg)) issues[id].push(msg); };
  for (const a of acts) {
    issues[a.id] = [];
    const r = req(a.requestId);
    if (!r) { add(a.id, 'This request was removed'); continue; }
    const s = svc(r), b = brgy(r), t = team(a.teamId), v = vehicle(a.vehicleId), n = needs(r), span = spanOf(a, days);
    use[n.supply] = (use[n.supply] || 0) + n.qty;
    cost += n.cost;
    if (!t.quals.includes(s.qual)) add(a.id, `${t.name} isn't qualified for ${s.name.toLowerCase()} — it needs ${withArticle(QUALS[s.qual])}`);
    if (b.access === 3 && !v.offroad) add(a.id, `${b.name} needs a 4×4 vehicle — ${v.name} can't reach it`);
    if (!span) { add(a.id, n.days > 1 ? `This ${n.days}-day visit runs past the planning window` : 'Date is outside the planning window'); continue; }
    for (const d of span) {
      if (t.off.includes(d)) add(a.id, `${t.name} is unavailable on ${fmt(d)}`);
      if (v.off.includes(d)) add(a.id, `${v.name} is unavailable on ${fmt(d)}`);
      (slots['t|' + t.id + '|' + d] ||= []).push(a);
      (slots['v|' + v.id + '|' + d] ||= []).push(a);
    }
  }
  for (const [key, list] of Object.entries(slots)) {
    if (list.length < 2) continue;
    const [kind, , d] = key.split('|');
    list.forEach((a) => {
      const others = list.filter((o) => o !== a).map((o) => brgy(req(o.requestId)).name).join(', ');
      const who = kind === 't' ? team(a.teamId).name : vehicle(a.vehicleId).name;
      add(a.id, `${who} is double-booked on ${fmt(d)} (also with ${others})`);
    });
  }
  for (const [sid, used] of Object.entries(use)) {
    const s = supply(sid);
    if (used <= s.qty) continue;
    global.push(`Not enough supplies: ${s.name} — the plan needs ${num(used)} ${s.unit}, ${num(s.qty)} in stock`);
    acts.forEach((a) => { const r = req(a.requestId); if (r && svc(r).supply === sid) add(a.id, `Not enough ${s.name.toLowerCase()} in stock`); });
  }
  if (cost > state.budget.total) global.push(`Over budget by ${peso(cost - state.budget.total)} (plan costs ${peso(cost)})`);
  const count = Object.values(issues).filter((l) => l.length).length;
  return { issues, global, use, cost, count, ok: count === 0 && global.length === 0 };
}

/* ---------- 5. UI pieces ---------- */
const catBadge = (c) => `<span class="cat cat-${c}" title="${CATEGORIES[c].label}">${icon(CATEGORIES[c].icon)}<span class="sr-only">${CATEGORIES[c].label}</span></span>`;

function requestStatus(r) {
  if (!state.plan) return { key: 'pending', label: 'Awaiting plan', ic: 'clock' };
  const a = activityFor(r);
  if (!a) return { key: 'unscheduled', label: 'Not scheduled', ic: 'alert' };
  return state.plan.status === 'approved'
    ? { key: 'approved', label: 'Approved · ' + fmt(a.start, { month: 'short', day: 'numeric' }), ic: 'shield' }
    : { key: 'scheduled', label: 'Planned · ' + fmt(a.start, { month: 'short', day: 'numeric' }), ic: 'calendar' };
}
const statusChip = (s) => `<span class="status st-${s.key}">${icon(s.ic)}${esc(s.label)}</span>`;

function meter(label, used, total, unit = '') {
  const over = used > total;
  const [u, t] = unit === '₱' ? [peso(used), peso(total)] : [num(used), `${num(total)} ${esc(unit)}`];
  return `<div class="meter ${over ? 'over' : ''}">
    <div class="meter-top"><span>${esc(label)}</span><b class="num">${over ? icon('alert') : ''} ${u} / ${t}</b></div>
    <div class="meter-bar" role="img" aria-label="${esc(label)}: ${u} of ${t} used${over ? ', over the limit' : ''}"><i style="width:${pct(used, total)}%"></i></div>
  </div>`;
}

function select(name, label, options, value, cls = '') {
  return `<label class="field ${cls}"><span>${label}</span><select class="input" name="${name}">${options
    .map(([v, t]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

const pageHead = (title, sub, actions = '') => `<header class="page-head">
  <div><h1 tabindex="-1">${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
  ${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;

// Small hand-made illustrations (inline SVG so they follow the theme)
const ART = {
  village: `<svg class="art" viewBox="0 0 360 210" aria-hidden="true">
    <circle class="f-butter" cx="292" cy="54" r="28"/>
    <path class="f-matcha" opacity=".75" d="M0 138 Q80 86 170 124 T360 112 V210 H0z"/>
    <g transform="translate(58 92)"><path class="f-peach" d="M-4 18 18 0 40 18z"/><rect class="f-paper" x="2" y="18" width="32" height="24" rx="2"/><rect class="f-blue" x="13" y="26" width="10" height="16" rx="2"/></g>
    <g transform="translate(118 84)"><path class="f-sage" d="M-6 22 22 0 50 22z"/><rect class="f-butter" x="2" y="22" width="40" height="22" rx="2"/><path class="s-ink" stroke-width="2" d="M8 44v8M36 44v8"/><rect class="f-paper" x="16" y="28" width="12" height="9" rx="2"/></g>
    <g transform="translate(232 82)"><circle class="f-sage" cx="0" cy="0" r="16"/><circle class="f-sage" cx="14" cy="8" r="12"/><rect class="f-ink" x="4" y="14" width="4" height="22" rx="2"/></g>
    <path class="f-sage" d="M0 168 Q110 128 220 160 T360 150 V210 H0z"/>
    <path class="s-paper" fill="none" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" d="M20 196 C120 170 200 196 340 168"/>
    <g transform="translate(150 138)">
      <rect class="f-blue" x="0" y="6" width="76" height="34" rx="10"/><path class="f-blue" d="M60 6h10l14 16v18H60z"/>
      <rect class="f-paper" x="64" y="11" width="12" height="10" rx="2"/>
      <g class="f-ink"><circle cx="18" cy="17" r="2.2"/><circle cx="24" cy="13" r="2.2"/><circle cx="30" cy="13" r="2.2"/><circle cx="36" cy="17" r="2.2"/><ellipse cx="27" cy="25" rx="6" ry="5"/></g>
      <circle class="f-ink" cx="18" cy="42" r="7"/><circle class="f-ink" cx="66" cy="42" r="7"/><circle class="f-paper" cx="18" cy="42" r="2.5"/><circle class="f-paper" cx="66" cy="42" r="2.5"/>
    </g>
    <g transform="translate(262 160)"><ellipse class="f-peach" cx="14" cy="12" rx="14" ry="8"/><circle class="f-peach" cx="30" cy="4" r="7"/><path class="f-ink" d="M33 -2 l5 -4 -1 7z"/><path class="s-ink" stroke-width="3" stroke-linecap="round" d="M4 18v6M22 18v6M0 9q-6-4-4-10"/><circle class="f-ink" cx="32" cy="3" r="1.3"/></g>
  </svg>`,
  van: `<svg viewBox="0 0 260 130" aria-hidden="true">
    <path class="f-matcha" opacity=".7" d="M0 92 Q70 60 140 84 T260 76 V130 H0z"/><path class="f-sage" d="M0 108 Q90 86 170 104 T260 98 V130 H0z"/>
    <circle class="f-butter" cx="208" cy="34" r="18"/>
    <g transform="translate(84 62)"><rect class="f-blue" x="0" y="6" width="76" height="34" rx="10"/><path class="f-blue" d="M60 6h10l14 16v18H60z"/><rect class="f-paper" x="64" y="11" width="12" height="10" rx="2"/>
    <g class="f-ink"><circle cx="18" cy="17" r="2.2"/><circle cx="24" cy="13" r="2.2"/><circle cx="30" cy="13" r="2.2"/><circle cx="36" cy="17" r="2.2"/><ellipse cx="27" cy="25" rx="6" ry="5"/></g>
    <circle class="f-ink" cx="18" cy="42" r="7"/><circle class="f-ink" cx="66" cy="42" r="7"/></g>
  </svg>`,
};

/* ---------- 6. Views ---------- */
const NAV = [
  { id: 'overview', label: 'Home', icon: 'home' },
  { id: 'communities', label: 'Requests', icon: 'pin' },
  { id: 'resources', label: 'Resources', icon: 'package' },
  { id: 'planner', label: 'Plan', icon: 'calendar' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
];

/** Calendar helpers: Sunday-first month grid, month shifting, and every plan visit grouped by day. */
function monthMatrix(ym) {
  const first = ym + '-01', start = addDays(first, -toDate(first).getUTCDay());
  const last = addDays(shiftMonth(ym, 1) + '-01', -1), end = addDays(last, 6 - toDate(last).getUTCDay());
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function shiftMonth(ym, n) { const d = toDate(ym + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return isoOf(d).slice(0, 7); }
function todayIso() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
function eventsByDay() {
  const days = planningDays(), map = {}, p = state.plan;
  if (!p) return map;
  const v = validate(p.activities);
  p.activities.forEach((a) => {
    const r = req(a.requestId);
    if (!r) return;
    (spanOf(a, days) || [a.start]).forEach((d, i) => (map[d] ||= []).push({ a, r, cont: i > 0, issue: (v.issues[a.id] || []).length > 0 }));
  });
  return map;
}

/** Home: a greeting, the three steps of the job with one main action, and only what needs attention. */
function renderOverview() {
  const p = state.plan, v = p ? validate(p.activities) : null;
  const acts = p ? p.activities.filter((a) => req(a.requestId)) : [];
  const total = state.requests.length, planned = acts.length, waiting = total - planned;
  const conflicts = v ? v.count + v.global.length : 0;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Magandang umaga' : hour < 18 ? 'Magandang hapon' : 'Magandang gabi';
  const brgyCount = new Set(state.requests.map((r) => r.brgy)).size;

  // Step 3 follows where the plan stands, and always offers exactly one next action
  const step3 = !p
    ? { text: 'VetReach matches each request with a qualified team, a vehicle, supplies and budget.', btn: `<button class="btn primary" id="tour-generate" data-action="generate">${icon('paw')} Generate plan</button>` }
    : conflicts
      ? { text: `${conflicts} conflict${conflicts === 1 ? '' : 's'} to fix before you can approve.`, btn: `<a class="btn primary" id="tour-generate" href="#/planner">${icon('alert')} Fix in Plan</a>` }
      : p.status !== 'approved'
        ? { text: `${planned} of ${total} requests are scheduled. The plan is ready for your approval.`, btn: `<a class="btn primary" id="tour-generate" href="#/planner">${icon('shield')} Review &amp; approve</a>` }
        : { text: `Approved. ${planned} of ${total} requests are scheduled.`, btn: `<a class="btn secondary" id="tour-generate" href="#/planner">${icon('calendar')} View plan</a>` };
  const approved = p?.status === 'approved';

  const upcoming = [...acts].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const attention = [];
  if (conflicts) attention.push(`<li class="notice bad">${icon('alert')}<div><b>${conflicts} conflict${conflicts === 1 ? '' : 's'}</b> in the plan. <a href="#/planner">Fix ${conflicts === 1 ? 'it' : 'them'}</a></div></li>`);
  if (p?.stale) attention.push(`<li class="notice warn">${icon('refresh')}<div>Requests or resources changed after the plan was made. <a href="#/planner">Check the plan</a></div></li>`);
  if (p && waiting) attention.push(`<li class="notice warn">${icon('info')}<div><b>${waiting} request${waiting === 1 ? '' : 's'}</b> couldn't be scheduled. <a href="#/planner">See why</a></div></li>`);

  return `
  <section class="welcome">
    <div>
      <span class="fiction-tag">${icon('info')} Fictional demo data</span>
      <h1 tabindex="-1">Hello, ${esc(state.settings.municipality)}.</h1>
      <p>${greet}! Plan veterinary outreach visits for your barangays in three steps.</p>
    </div>
    ${ART.village}
  </section>

  <ol class="steps" id="tour-steps">
    <li><span class="step-num">1</span><div><h2>Review requests</h2><p>${total} requests from ${brgyCount} barangays.</p></div>
      <a class="btn secondary" href="#/communities">Requests ${icon('arrow')}</a></li>
    <li><span class="step-num">2</span><div><h2>Check resources</h2><p>${state.teams.length} teams, ${state.vehicles.length} vehicles and a ${peso(state.budget.total)} budget.</p></div>
      <a class="btn secondary" href="#/resources">Resources ${icon('arrow')}</a></li>
    <li class="main ${approved ? 'done' : ''}"><span class="step-num">${approved ? icon('check') : 3}</span><div><h2>Make the plan</h2><p>${step3.text}</p></div>${step3.btn}</li>
  </ol>

  <div class="duo">
    <section class="panel">
      <h2 class="panel-title">Coming up</h2>
      ${upcoming.length ? `<ol class="timeline">${upcoming.map((a) => {
        const r = req(a.requestId);
        return `<li><span class="date-blob"><b>${toDate(a.start).getUTCDate()}</b><span>${fmt(a.start, { month: 'short' })}</span></span>
          <div><h3>${esc(brgy(r).name)}</h3><p class="small muted">${esc(svc(r).name)} · ${esc(team(a.teamId).name)}</p></div></li>`;
      }).join('')}</ol><a class="link-arrow" href="#/planner" style="margin-top:12px">See the full plan ${icon('arrow')}</a>`
      : `<p class="muted">Visits appear here once you generate a plan.</p>`}
    </section>
    <section class="panel">
      <h2 class="panel-title">Needs attention</h2>
      ${attention.length ? `<ul class="stack" style="list-style:none;margin:0;padding:0">${attention.join('')}</ul>`
        : `<p class="muted">${p ? 'Nothing right now. The plan is in good shape.' : 'Nothing yet. Generate a plan to get started.'}</p>`}
    </section>
  </div>`;
}

function renderCommunities() {
  const w = state.settings.weights;
  return `
  ${pageHead('Requests', `What each barangay asked for, highest priority first. ${state.requests.length} requests from ${state.barangays.length} barangays (fictional data).`,
    `<button class="btn primary" data-action="new-request">${icon('plus')} Add request</button>`)}
  <div class="toolbar">
    <label class="search"><span class="sr-only">Search by barangay</span>${icon('search')}<input class="input" id="req-search" type="search" placeholder="Search barangay…" value="${esc(ui.search)}"></label>
    <div class="segmented" role="group" aria-label="Filter by animal category">
      ${[['all', 'All'], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])].map(([k, l]) => `<button type="button" data-action="filter" data-filter="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join('')}
    </div>
  </div>
  <div id="req-list" class="req-list">${renderRequestList()}</div>

  <details class="disclosure section" ${ui.prioOpen ? 'open' : ''} id="prio-details">
    <summary><span class="disc-ic">${icon('chart')}</span><span><b>How priority is decided</b><small>See each barangay's score and adjust the weights. Optional.</small></span>${icon('chev-right', 'chev')}</summary>
    <div class="prio-layout" style="margin-top:16px">
      <form class="panel weights" id="weights" onsubmit="return false">
        ${FACTORS.map((f) => `<div class="weight">
          <label for="w-${f.k}"><span><i class="swatch t-${f.tone}"></i>${f.label}</span><output id="o-${f.k}" class="num">${w[f.k]}</output></label>
          <input id="w-${f.k}" type="range" min="0" max="50" step="5" value="${w[f.k]}" data-weight="${f.k}" aria-describedby="d-${f.k}">
          <small id="d-${f.k}">${f.desc}</small></div>`).join('')}
        <p class="notice info small">${icon('info')}<span>These weights are prototype assumptions, not research findings. A score only orders requests for scheduling — it is not a measure of a community's worth.</span></p>
      </form>
      <div id="prio-list">${renderPriorities()}</div>
    </div>
  </details>`;
}

function renderRequestList() {
  const scores = scoreRequests(), q = ui.search.trim().toLowerCase();
  const list = state.requests
    .filter((r) => (ui.filter === 'all' || svc(r).cat === ui.filter) && brgy(r).name.toLowerCase().includes(q))
    .sort((a, b) => scores[b.id].total - scores[a.id].total);
  if (!list.length) {
    return `<div class="empty panel">${ART.van}<h3>No matching requests</h3><p>${state.requests.length ? 'Try another barangay name or category.' : 'All clear for now. New community requests will appear here.'}</p></div>`;
  }
  return list.map((r) => {
    const s = svc(r), b = brgy(r);
    const pref = r.prefFrom || r.prefTo ? `Prefers ${fmt(r.prefFrom, { month: 'short', day: 'numeric' }) || 'any'} – ${fmt(r.prefTo, { month: 'short', day: 'numeric' }) || 'any'}` : 'Any date';
    return `<article class="req-row">
      ${catBadge(s.cat)}
      <div class="req-main"><h3>${esc(b.name)}</h3><p>${esc(s.name)} · ${num(r.animals)} ${CATEGORIES[s.cat].noun}</p><p class="small muted">${pref} · Filed ${fmt(r.requestedOn, { month: 'short', day: 'numeric' })}</p></div>
      <div class="score" title="Priority score out of 100"><b>${scores[r.id].total}</b><span>priority</span></div>
      ${statusChip(requestStatus(r))}
      <div class="row-actions">
        <button class="icon-btn" data-action="edit-request" data-id="${r.id}" aria-label="Edit ${esc(b.name)} ${esc(s.name)} request">${icon('pencil')}</button>
        <button class="icon-btn" data-action="delete-request" data-id="${r.id}" aria-label="Remove ${esc(b.name)} ${esc(s.name)} request">${icon('trash')}</button>
      </div>
    </article>`;
  }).join('');
}

function renderPriorities() {
  const scores = scoreRequests();
  const rows = state.barangays.map((b) => {
    const rs = state.requests.filter((r) => r.brgy === b.id);
    const top = rs.map((r) => ({ r, s: scores[r.id] })).sort((x, y) => y.s.total - x.s.total)[0];
    return { b, rs, top };
  }).sort((x, y) => (y.top?.s.total ?? -1) - (x.top?.s.total ?? -1));
  return `<div class="legend" style="margin-bottom:10px">${FACTORS.map((f) => `<span class="t-${f.tone}"><i></i>${f.label}</span>`).join('')}</div>
  <div class="brgy-grid">${rows.map(({ b, rs, top }) => `
    <article class="brgy">
      <div class="brgy-top"><div><h3>${esc(b.name)}</h3><p class="small muted">${ACCESS[b.access]}</p></div>
        <div class="score"><b>${top ? top.s.total : '—'}</b><span>top score</span></div></div>
      ${top ? `<div class="stackbar" role="img" aria-label="${FACTORS.map((f) => `${f.label} ${Math.round(top.s.parts[f.k])}`).join(', ')}">${FACTORS.map((f) => `<i class="t-${f.tone}" style="width:${top.s.parts[f.k]}%"></i>`).join('')}</div>
      <p class="small muted">${FACTORS.map((f) => `${f.label} ${Math.round(top.s.parts[f.k])}`).join(' · ')}</p>` : '<p class="small muted">No pending requests.</p>'}
      <div class="facts"><span>${rs.length} request${rs.length === 1 ? '' : 's'}</span><span>Last visit ${b.lastVisitDays} days ago</span><span>${num(b.pop.companion)} pets · ${num(b.pop.livestock)} livestock · ${num(b.pop.poultry)} poultry</span></div>
    </article>`).join('')}</div>`;
}

function availStrip(kind, item, busyDays) {
  return `<div class="days" role="group" aria-label="${esc(item.name)} availability">${planningDays().map((d) => {
    const off = item.off.includes(d);
    return `<button type="button" class="day ${off ? 'off' : ''} ${busyDays.has(d) ? 'busy' : ''}" data-action="toggle-day" data-kind="${kind}" data-id="${item.id}" data-day="${d}"
      aria-pressed="${!off}" aria-label="${fmt(d)}: ${off ? 'unavailable' : 'available'}${busyDays.has(d) ? ', has a planned visit' : ''}">
      <span>${fmt(d, { weekday: 'short' }).slice(0, 2)}</span><b>${toDate(d).getUTCDate()}</b></button>`;
  }).join('')}</div>`;
}

function renderResources() {
  const p = state.plan, v = p ? validate(p.activities) : null, days = planningDays();
  const busy = (key, id) => new Set((p?.activities || []).filter((a) => a[key] === id).flatMap((a) => spanOf(a, days) || []));
  const cost = v ? v.cost : 0;
  const tab = ui.resTab;
  const TABS = [['teams', 'Teams', 'users'], ['vehicles', 'Vehicles', 'truck'], ['supplies', 'Supplies & budget', 'package']];
  let body;
  if (tab === 'teams') {
    body = `<p class="hint">Tap a day to mark a team unavailable. A dot means a visit is planned that day.</p>
    <div class="res-grid">${state.teams.map((t) => {
      const planned = (p?.activities || []).filter((a) => a.teamId === t.id).length;
      return `<article class="res-card">
        <header><div><h3>${esc(t.name)}</h3><p class="small muted">${esc(t.lead)}</p></div><span class="chip tint t-blue">${planned} visit${planned === 1 ? '' : 's'}</span></header>
        <div class="field-label">Qualifications</div>
        <div class="chips">${Object.entries(QUALS).map(([k, l]) => `<label class="toggle-chip"><input type="checkbox" data-change="team-qual" data-id="${t.id}" value="${k}" ${t.quals.includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <div class="field-label">Availability</div>
        ${availStrip('team', t, busy('teamId', t.id))}
      </article>`;
    }).join('')}</div>`;
  } else if (tab === 'vehicles') {
    body = `<p class="hint">Remote barangays can only be reached with a 4×4. Tap a day to mark a vehicle unavailable.</p>
    <div class="res-grid">${state.vehicles.map((x) => `<article class="res-card">
      <header><div><h3>${icon('truck')} ${esc(x.name)}</h3><p class="small muted">${x.offroad ? 'Can reach remote barangays' : 'Paved and gravel roads'}</p></div>${x.offroad ? '<span class="badge-4x4">4×4</span>' : ''}</header>
      ${availStrip('vehicle', x, busy('vehicleId', x.id))}
    </article>`).join('')}</div>`;
  } else {
    body = `<div class="rep-grid" style="margin-top:0">
      <section class="panel">
        <div class="section-head"><h2>Supplies</h2><p>${p ? 'Bars show what the plan uses.' : 'Generate a plan to see usage.'}</p></div>
        ${state.supplies.map((s) => `<div class="supply-row">
          <div><b>${esc(s.name)}</b><p class="small muted">${SERVICES.filter((x) => x.supply === s.id).map((x) => x.name).join(', ')}</p></div>
          <label class="qty"><span class="sr-only">${esc(s.name)} in stock</span><input class="input" type="number" min="0" step="1" inputmode="numeric" value="${s.qty}" data-change="supply-qty" data-id="${s.id}"><span class="small muted">${s.unit}</span></label>
          ${meter('Used by plan', v?.use[s.id] || 0, s.qty, s.unit)}
        </div>`).join('')}
      </section>
      <section class="panel">
        <div class="section-head"><h2>Budget</h2></div>
        <label class="field"><span>Outreach budget for this period (₱)</span><input class="input" type="number" min="0" step="1000" inputmode="numeric" value="${state.budget.total}" data-change="budget"></label>
        <div style="margin-top:16px">${meter('Estimated plan cost', cost, state.budget.total, '₱')}</div>
        <p class="small muted" style="margin-top:12px">${cost > state.budget.total ? `${icon('alert')} Over budget by ${peso(cost - state.budget.total)}. ` : p ? `${peso(state.budget.total - cost)} left after the plan. ` : ''}Activity cost = service base fee + cost per animal + travel per day (₱${TRAVEL[1]} easy, ₱${TRAVEL[2]} moderate, ₱${TRAVEL[3]} remote).</p>
      </section>
    </div>`;
  }
  return `
  ${pageHead('Resources', 'What your office has for the next two weeks. Changes save automatically and are checked against the plan.')}
  <div class="tabs" role="tablist" aria-label="Resource type">${TABS.map(([k, l, ic]) => `<button type="button" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="res-panel" data-action="res-tab" data-tab="${k}">${icon(ic)}${l}</button>`).join('')}</div>
  <div id="res-panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</div>`;
}

function activityCard(a, issues, days) {
  const r = req(a.requestId);
  if (!r) return '';
  const s = svc(r), b = brgy(r), n = needs(r);
  const pref = (!r.prefFrom || a.start >= r.prefFrom) && (!r.prefTo || (spanOf(a, days) || []).at(-1) <= r.prefTo);
  return `<article class="act ${issues.length ? 'has-issue' : ''} ${ui.flash === a.id ? 'flash' : ''}" id="act-${a.id}">
    ${catBadge(s.cat)}
    <div>
      <h4>${esc(b.name)}</h4>
      <p>${esc(s.name)} · ${num(r.animals)} ${CATEGORIES[s.cat].noun}</p>
      <div class="meta"><span>${icon('users')}${esc(team(a.teamId).name)}</span><span>${icon('truck')}${esc(vehicle(a.vehicleId).name)}</span><span>${n.days > 1 ? `${n.days}-day visit · ` : ''}${peso(n.cost)}</span></div>
      ${!pref || b.access === 3 ? `<div class="tags">${!pref ? '<span class="chip tint t-butter">Outside preferred dates</span>' : ''}${b.access === 3 ? '<span class="chip tint t-lavender">Remote barangay</span>' : ''}</div>` : ''}
      ${issues.length ? `<ul class="issues">${issues.map((m) => `<li>${icon('alert')}<span>${esc(m)}</span></li>`).join('')}</ul>` : ''}
    </div>
    <button class="btn secondary sm" data-action="edit-activity" data-id="${a.id}" aria-label="Change ${esc(b.name)} ${esc(s.name)} assignment">${icon('pencil')} Change</button>
  </article>`;
}

function renderPlanner() {
  const p = state.plan, days = planningDays();
  const when = `${fmt(days[0], { month: 'long', day: 'numeric' })} – ${fmt(days.at(-1), { month: 'long', day: 'numeric', year: 'numeric' })} · ${WINDOW_DAYS} working days`;
  if (!p) {
    return `${pageHead('Plan', when)}
    <div class="panel empty">${ART.van}<h3>No plan yet</h3>
      <p>VetReach will rank ${state.requests.length} requests by priority, then match them with qualified teams, vehicles, supplies and budget.</p>
      <button class="btn primary" data-action="generate">${icon('paw')} Generate plan</button></div>`;
  }
  const v = validate(p.activities);
  const unscheduled = state.requests.filter((r) => !activityFor(r));
  const approved = p.status === 'approved';
  const status = `<span class="status st-${approved ? 'approved' : 'scheduled'}">${icon(approved ? 'shield' : 'clock')}${approved ? 'Approved' : 'Suggested · not yet approved'}</span>`;
  const actions = `
    <div class="segmented" role="group" aria-label="Show the plan as">${[['list', 'List'], ['calendar', 'Calendar']].map(([k, l]) => `<button type="button" data-action="plan-view" data-view="${k}" aria-pressed="${ui.planView === k}">${l}</button>`).join('')}</div>
    <button class="btn ghost" data-action="undo" ${state.history.length ? '' : 'disabled'}>${icon('undo')} Undo</button>
    <button class="btn secondary" data-action="generate">${icon('refresh')} Regenerate</button>
    ${approved ? '' : `<button class="btn primary" data-action="approve" ${v.ok ? '' : 'disabled aria-describedby="approve-why"'}>${icon('shield')} Approve</button>`}`;

  const top = `${pageHead('Plan', `${status} <span class="when">${when}</span>`, actions)}
  ${ui.justGenerated ? `<div class="panel success-card pop-in"><span class="check-badge">${icon('check')}</span><div><h2>Plan ready</h2>
    <p class="muted">${ui.justGenerated.scheduled} of ${ui.justGenerated.total} requests are scheduled across ${ui.justGenerated.barangays} barangays. ${ui.justGenerated.total - ui.justGenerated.scheduled ? 'The rest are listed under “Couldn’t schedule” with the reason.' : ''} Review it, adjust anything, then approve.</p></div></div>` : ''}
  <div class="stack" style="margin-bottom:16px" aria-live="polite">
    ${p.stale ? `<div class="notice warn">${icon('refresh')}<div><b>Requests or resources changed since this plan was made.</b> The checks below use the latest data. Regenerate for a fresh suggestion, or fix items one by one.</div></div>` : ''}
    ${!v.ok ? `<div class="notice bad" id="approve-why">${icon('alert')}<div><b>${v.count ? `${v.count} visit${v.count === 1 ? ' has' : 's have'} a conflict.` : 'The plan has a conflict.'}</b> Fix ${v.count + v.global.length === 1 ? 'it' : 'them'} before approving.${v.global.length ? `<ul>${v.global.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}</div></div>` : ''}
  </div>`;

  if (ui.planView === 'calendar') return top + renderCalendarBody();

  const byDay = Object.fromEntries(days.map((d) => [d, { starts: [], cont: [] }]));
  p.activities.forEach((a) => (spanOf(a, days) || [a.start]).forEach((d, i) => byDay[d] && byDay[d][i ? 'cont' : 'starts'].push(a)));
  const outside = p.activities.filter((a) => !spanOf(a, days));

  return `${top}
  <div class="plan-layout">
    <section aria-label="Schedule by day">
      ${days.map((d) => {
        const g = byDay[d], n = g.starts.length + g.cont.length;
        return `<div class="daygroup"><div class="day-head"><h3>${fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })}</h3><span>${n ? `${n} team${n === 1 ? '' : 's'} out` : ''}</span></div>
          <div class="acts">${g.starts.map((a) => activityCard(a, v.issues[a.id] || [], days)).join('')}
          ${g.cont.map((a) => { const r = req(a.requestId); return r ? `<div class="act cont">${icon('arrow')}<p class="small muted">${esc(brgy(r).name)} · ${esc(svc(r).name)} continues — ${esc(team(a.teamId).name)}</p></div>` : ''; }).join('')}
          ${n ? '' : '<p class="day-empty">Open day — no visits planned.</p>'}</div></div>`;
      }).join('')}
      ${outside.length ? `<div class="daygroup"><div class="day-head"><h3>Outside the planning window</h3></div><div class="acts">${outside.map((a) => activityCard(a, v.issues[a.id] || [], days)).join('')}</div></div>` : ''}
    </section>
    <aside class="side-col">
      <section class="panel">
        <div class="section-head"><h2>Couldn’t schedule</h2><span class="status ${unscheduled.length ? 'st-warn' : 'st-ok'}">${unscheduled.length} of ${state.requests.length}</span></div>
        ${unscheduled.length ? `<div class="unsched">${unscheduled.map((r) => `<div class="unsched-item">
          <div style="display:flex;gap:10px;align-items:center">${catBadge(svc(r).cat)}<div><b>${esc(brgy(r).name)}</b><p class="small muted">${esc(svc(r).name)} · ${num(r.animals)} ${CATEGORIES[svc(r).cat].noun}</p></div></div>
          <p class="reason">${icon('alert')}<span>${esc(p.reasons[r.id] || 'Added after this plan was generated')}</span></p>
          <div><button class="btn secondary sm" data-action="schedule-request" data-id="${r.id}">${icon('search')} Find a slot</button></div></div>`).join('')}</div>`
        : `<p class="muted">Every request has a slot.</p>`}
      </section>
      <section class="panel stack">
        ${meter('Budget', v.cost, state.budget.total, '₱')}
        <details class="disclosure-sm"><summary>Supplies used</summary><div class="stack" style="margin-top:10px">${Object.entries(v.use).map(([id, used]) => meter(supply(id).name, used, supply(id).qty, supply(id).unit)).join('')}</div></details>
        <details class="disclosure-sm"><summary>How the planner works</summary><ol class="howto-list">
          <li>Scores every request (see Requests › How priority is decided).</li>
          <li>Goes through requests from highest to lowest score.</li>
          <li>Skips a request if supplies or budget can't cover it.</li>
          <li>Takes the first open day (preferred dates first) with a qualified, available team and a suitable vehicle.</li>
          <li>Lists anything it can't place, with the reason, so you decide.</li>
        </ol><p class="small muted" style="margin-top:8px">A simple, explainable method: a good starting point, not a guaranteed best plan. Nothing is final until you approve it.</p></details>
      </section>
    </aside>
  </div>`;
}

function renderReports() {
  const p = state.plan, days = planningDays();
  const acts = p ? p.activities.filter((a) => req(a.requestId)) : [];
  const v = validate(acts);
  const scheduledIds = new Set(acts.map((a) => a.requestId));
  const animals = acts.reduce((s, a) => s + req(a.requestId).animals, 0);
  const covered = new Set(acts.map((a) => req(a.requestId).brgy)).size;
  const svcRows = SERVICES.map((s) => {
    const rs = state.requests.filter((r) => r.service === s.id);
    const want = rs.reduce((t, r) => t + r.animals, 0), got = rs.filter((r) => scheduledIds.has(r.id)).reduce((t, r) => t + r.animals, 0);
    return { s, want, got };
  }).filter((x) => x.want);
  const sorted = [...acts].sort((a, b) => a.start.localeCompare(b.start));
  return `
  ${pageHead('Reports', p ? `${p.status === 'approved' ? 'Approved' : 'Suggested'} plan · generated ${fmtTime(p.generatedAt)}` : 'Generate a plan to fill these reports.',
    `<button class="btn secondary" data-action="export-csv" ${acts.length ? '' : 'disabled'}>${icon('download')} Export CSV</button><button class="btn primary" data-action="print">${icon('printer')} Print report</button>`)}
  <p class="print-only small">VetReach outreach report · ${esc(state.settings.municipality)}, ${esc(state.settings.province)} (fictional data) · ${fmt(days[0], { month: 'long', day: 'numeric' })} – ${fmt(days.at(-1), { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="kpis">
    <div><b>${acts.length}</b><span>Scheduled activities</span></div>
    <div><b>${scheduledIds.size}/${state.requests.length}</b><span>Requests covered</span></div>
    <div><b>${num(animals)}</b><span>Animals to be served</span></div>
    <div><b>${peso(v.cost)}</b><span>Estimated cost of ${peso(state.budget.total)}</span></div>
    <div><b>${state.resolved}</b><span>Conflicts resolved</span></div>
  </div>
  <div class="rep-grid">
    <section class="panel">
      <div class="section-head"><h2>Service distribution</h2><div class="legend"><span class="t-lavender"><i style="background:color-mix(in srgb,var(--lavender) 85%,var(--surface))"></i>Requested</span><span class="t-sage"><i></i>Scheduled</span></div></div>
      <div class="bars">${svcRows.map(({ s, want, got }) => `<div class="bar-row"><span>${esc(s.name)}</span>
        <div class="bar-track" role="img" aria-label="${esc(s.name)}: ${num(got)} of ${num(want)} animals scheduled"><i class="req" style="width:100%"></i><i class="sch" style="width:${pct(got, want)}%"></i></div>
        <span class="num small">${num(got)} / ${num(want)}</span></div>`).join('')}</div>
    </section>
    <section class="panel stack">
      <h2>Resource utilization</h2>
      ${meter('Budget', v.cost, state.budget.total, '₱')}
      ${state.teams.map((t) => {
        const open = days.filter((d) => !t.off.includes(d)).length;
        const used = acts.filter((a) => a.teamId === t.id).reduce((s, a) => s + needs(req(a.requestId)).days, 0);
        return meter(t.name, used, open, 'team-days');
      }).join('')}
      ${state.supplies.filter((s) => v.use[s.id]).map((s) => meter(s.name, v.use[s.id], s.qty, s.unit)).join('')}
    </section>
  </div>
  <section class="panel section">
    <h2 style="margin-bottom:10px">Barangay coverage</h2>
    <table class="table stack-sm"><thead><tr><th>Barangay</th><th class="r">Requests</th><th class="r">Scheduled</th><th class="r">Animals served</th><th>Coverage</th></tr></thead><tbody>
    ${state.barangays.map((b) => {
      const rs = state.requests.filter((r) => r.brgy === b.id), sc = rs.filter((r) => scheduledIds.has(r.id));
      const st = !rs.length ? ['st-pending', 'No requests'] : sc.length === rs.length ? ['st-ok', 'Fully covered'] : sc.length ? ['st-warn', 'Partly covered'] : ['st-bad', 'No visit scheduled'];
      return `<tr><td data-label="Barangay"><b>${esc(b.name)}</b></td><td class="r" data-label="Requests">${rs.length}</td><td class="r" data-label="Scheduled">${sc.length}</td><td class="r" data-label="Animals served">${num(sc.reduce((t, r) => t + r.animals, 0))}</td><td data-label="Coverage"><span class="status ${st[0]}">${st[1]}</span></td></tr>`;
    }).join('')}</tbody></table>
  </section>
  <section class="panel section">
    <h2 style="margin-bottom:10px">Schedule</h2>
    ${sorted.length ? `<table class="table stack-sm"><thead><tr><th>Date</th><th>Barangay</th><th>Service</th><th>Team</th><th>Vehicle</th><th class="r">Est. cost</th></tr></thead><tbody>
    ${sorted.map((a) => { const r = req(a.requestId), n = needs(r); return `<tr><td data-label="Date">${fmt(a.start)}${n.days > 1 ? ` <span class="muted">(${n.days} days)</span>` : ''}</td><td data-label="Barangay">${esc(brgy(r).name)}</td><td data-label="Service">${esc(svc(r).name)}</td><td data-label="Team">${esc(team(a.teamId).name)}</td><td data-label="Vehicle">${esc(vehicle(a.vehicleId).name)}</td><td class="r" data-label="Est. cost">${peso(n.cost)}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="muted">No activities scheduled yet.</p>'}
  </section>
  <section class="panel section">
    <h2 style="margin-bottom:10px">Unscheduled requests</h2>
    ${p && state.requests.some((r) => !scheduledIds.has(r.id)) ? `<table class="table stack-sm"><thead><tr><th>Barangay</th><th>Service</th><th class="r">Animals</th><th>Reason</th></tr></thead><tbody>
    ${state.requests.filter((r) => !scheduledIds.has(r.id)).map((r) => `<tr><td data-label="Barangay">${esc(brgy(r).name)}</td><td data-label="Service">${esc(svc(r).name)}</td><td class="r" data-label="Animals">${num(r.animals)}</td><td data-label="Reason">${esc(p.reasons[r.id] || 'Added after the plan was generated')}</td></tr>`).join('')}
    </tbody></table>` : `<p class="muted">${p ? 'None — every request is scheduled.' : 'No plan yet.'}</p>`}
  </section>
  <details class="disclosure section no-print">
    <summary><span class="disc-ic">${icon('clock')}</span><span><b>Change log</b><small>The last ${Math.min(state.log.length, 30)} changes made in this browser</small></span>${icon('chev-right', 'chev')}</summary>
    <ul class="log">${state.log.slice().reverse().map((l) => `<li><div>${esc(l.text)}<time datetime="${esc(l.at)}">${fmtTime(l.at)}</time></div></li>`).join('')}</ul>
  </details>`;
}

/* Calendar: month / week / day views of the plan. Visits can be dragged to another day. */
function dayInfo(d, days = planningDays()) {
  const wd = toDate(d).getUTCDay(), inWin = days.includes(d);
  return { inWin, holiday: HOLIDAY_NAMES[d] || '', closed: wd === 0 || wd === 6 || HOLIDAYS.includes(d) };
}

function evChip(e, detailed = false) {
  const s = svc(e.r), b = brgy(e.r);
  const label = `${b.name}, ${s.name}${e.cont ? ' (continued)' : ''}, ${team(e.a.teamId).name}${e.issue ? '. Has a conflict' : ''}${e.cont ? '' : '. Drag to another day to move it'}`;
  return `<span class="ev cat-${s.cat} ${e.cont ? 'cont' : ''} ${e.issue ? 'issue' : ''}" ${e.cont ? '' : `draggable="true" data-drag="${e.a.id}"`} title="${esc(label)}">
    ${icon(e.issue ? 'alert' : e.cont ? 'arrow' : CATEGORIES[s.cat].icon)}<span>${esc(b.name)}${detailed ? ` · ${esc(s.name)}` : ''}</span>${detailed ? `<span class="muted" style="font-weight:500;width:100%">${esc(team(e.a.teamId).name)}</span>` : ''}</span>`;
}

/** Details of one day: its visits (with Change buttons), who is unavailable, and a quick way to schedule. */
function dayDetail(d) {
  const p = state.plan, days = planningDays(), info = dayInfo(d, days), list = eventsByDay()[d] || [];
  const v = p ? validate(p.activities) : null;
  const parts = [];
  if (info.holiday) parts.push(`<div class="notice info">${icon('calendar')}<div><b>${esc(info.holiday)}</b> · public holiday, no outreach.</div></div>`);
  else if (info.closed) parts.push(`<p class="muted small">Weekend. No outreach is planned on weekends.</p>`);
  else if (!info.inWin) parts.push(`<p class="muted small">Outside the planning window (${fmt(days[0], { month: 'short', day: 'numeric' })} – ${fmt(days.at(-1), { month: 'short', day: 'numeric' })}).</p>`);

  if (!p && info.inWin) parts.push(`<div class="empty" style="padding:16px 8px">${ART.van}<p>No plan yet. Generate one to fill the calendar.</p><button class="btn primary sm" data-action="generate">${icon('paw')} Generate plan</button></div>`);
  if (list.length) {
    parts.push(list.map((e) => {
      const s = svc(e.r), b = brgy(e.r), n = needs(e.r), span = spanOf(e.a, days) || [e.a.start], issues = v.issues[e.a.id] || [];
      return `<article class="ev-detail ${issues.length ? 'issue' : ''}">
        <div style="display:flex;gap:10px;align-items:center">${catBadge(s.cat)}<div style="flex:1;min-width:0"><h3 style="font-size:.95rem">${esc(b.name)}</h3><p class="small muted">${esc(s.name)} · ${num(e.r.animals)} ${CATEGORIES[s.cat].noun}</p></div></div>
        <div class="row"><span class="ic-circle">${icon('clock')}</span>${n.days > 1 ? `Day ${span.indexOf(d) + 1} of ${n.days} · ${fmt(span[0], { month: 'short', day: 'numeric' })} – ${fmt(span.at(-1), { month: 'short', day: 'numeric' })}` : 'Full-day visit'}</div>
        <div class="row"><span class="ic-circle">${icon('users')}</span>${esc(team(e.a.teamId).name)}</div>
        <div class="row"><span class="ic-circle">${icon('truck')}</span>${esc(vehicle(e.a.vehicleId).name)}</div>
        <div class="row"><span class="ic-circle">${icon('pin')}</span>${esc(ACCESS[b.access])}</div>
        ${issues.length ? `<ul class="issues">${issues.map((m) => `<li>${icon('alert')}<span>${esc(m)}</span></li>`).join('')}</ul>` : ''}
        <button class="btn soft sm" data-action="edit-activity" data-id="${e.a.id}" aria-label="Change ${esc(b.name)} ${esc(s.name)} assignment">${icon('pencil')} Change</button>
      </article>`;
    }).join(''));
  } else if (p && info.inWin) parts.push(`<p class="muted small">No visits on this day yet.</p>`);

  if (info.inWin) {
    const offT = state.teams.filter((t) => t.off.includes(d)), offV = state.vehicles.filter((x) => x.off.includes(d));
    if (offT.length || offV.length) parts.push(`<div><div class="field-label" style="margin-bottom:6px">Unavailable</div><div class="off-list">${[...offT, ...offV].map((x) => `<span class="chip tint t-lavender">${esc(x.name)}</span>`).join('')}</div></div>`);
    const waiting = p ? state.requests.filter((r) => !activityFor(r)) : [];
    if (waiting.length) parts.push(`<button class="btn secondary sm" data-action="schedule-on" data-day="${d}">${icon('plus')} Schedule a request on this day</button>`);
  }
  return parts.join('');
}

/** The Plan page's calendar view (month / week / day). Visits can be dragged to another day. */
function renderCalendarBody() {
  const c = ui.cal, p = state.plan, days = planningDays(), ev = eventsByDay(), today = todayIso();
  const month = c.day.slice(0, 7);
  const weekStart = addDays(c.day, -toDate(c.day).getUTCDay());
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const label = c.view === 'month' ? fmt(month + '-01', { month: 'long', year: 'numeric' })
    : c.view === 'week' ? `${fmt(week[0], { month: 'short', day: 'numeric' })} – ${fmt(week[6], { month: 'short', day: 'numeric' })}`
    : fmt(c.day, { weekday: 'short', month: 'short', day: 'numeric' });
  const dayLabel = (d, n, info) => `${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}${n ? `, ${n} visit${n === 1 ? '' : 's'}` : ''}${info.holiday ? `, ${info.holiday}` : ''}`;

  let board;
  if (c.view === 'month') {
    board = `<div class="cal-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('')}
      ${monthMatrix(month).map((d) => {
        const info = dayInfo(d, days), list = ev[d] || [];
        const cls = ['cal-cell', d.slice(0, 7) !== month && 'other', info.closed && 'closed', d === today && 'today', d === c.day && 'sel'].filter(Boolean).join(' ');
        return `<div class="${cls}" data-action="cal-select" data-day="${d}" ${info.inWin ? 'data-drop="1"' : ''}>
          <div class="cal-top"><button type="button" class="cal-num" data-action="cal-select" data-day="${d}" aria-pressed="${d === c.day}" aria-label="${dayLabel(d, list.length, info)}">${toDate(d).getUTCDate()}</button>${info.holiday ? `<span class="cal-tag">${esc(info.holiday)}</span>` : ''}</div>
          <div class="cal-events">${list.slice(0, 3).map((e) => evChip(e)).join('')}${list.length > 3 ? `<span class="ev-more">+${list.length - 3} more</span>` : ''}</div>
          <div class="cal-dots" aria-hidden="true">${list.slice(0, 4).map((e) => `<i class="cat-${svc(e.r).cat}"></i>`).join('')}</div>
        </div>`;
      }).join('')}</div>`;
  } else if (c.view === 'week') {
    board = `<div class="cal-week">${week.map((d) => {
      const info = dayInfo(d, days), list = ev[d] || [];
      return `<div class="wk-col ${info.closed ? 'closed' : ''} ${d === c.day ? 'sel' : ''}" data-action="cal-select" data-day="${d}" ${info.inWin ? 'data-drop="1"' : ''}>
        <button type="button" class="wk-head" data-action="cal-select" data-day="${d}" aria-pressed="${d === c.day}" aria-label="${dayLabel(d, list.length, info)}"><span>${fmt(d, { weekday: 'short' })}</span><b>${toDate(d).getUTCDate()}</b>${info.holiday ? `<span>${esc(info.holiday)}</span>` : ''}</button>
        ${list.map((e) => evChip(e, true)).join('') || (info.inWin && !info.closed ? '<span class="small muted">Open</span>' : '')}
      </div>`;
    }).join('')}</div>`;
  } else {
    board = `<h2 style="margin-bottom:12px">${fmt(c.day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2><div class="stack" style="gap:12px">${dayDetail(c.day)}</div>`;
  }

  const unscheduled = p ? state.requests.filter((r) => !activityFor(r)) : [];
  const side = c.view === 'day'
    ? `<section class="panel events-card"><div class="section-head"><h2>Waiting for a slot</h2><span class="small muted">${unscheduled.length} request${unscheduled.length === 1 ? '' : 's'}</span></div>
        ${unscheduled.length ? `<div class="unsched">${unscheduled.map((r) => `<div class="unsched-item"><div style="display:flex;gap:10px;align-items:center">${catBadge(svc(r).cat)}<div><b>${esc(brgy(r).name)}</b><p class="small muted">${esc(svc(r).name)}</p></div></div>
          <p class="reason">${icon('alert')}<span>${esc(p.reasons[r.id] || 'Added after this plan was generated')}</span></p>
          <div><button class="btn secondary sm" data-action="schedule-request" data-id="${r.id}">${icon('search')} Find a slot</button></div></div>`).join('')}</div>` : '<p class="muted small">Every request has a slot.</p>'}</section>`
    : `<section class="panel events-card" aria-live="polite"><div class="section-head"><h2>${fmt(c.day, { weekday: 'long', month: 'short', day: 'numeric' })}</h2></div>${dayDetail(c.day)}</section>`;

  return `
  <div class="cal-layout">
    <section class="panel cal-board" aria-label="Calendar">
      <div class="cal-toolbar">
        <div class="segmented" role="group" aria-label="Calendar range">${[['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(([k, l]) => `<button type="button" data-action="cal-view" data-view="${k}" aria-pressed="${c.view === k}">${l}</button>`).join('')}</div>
        <div class="cal-nav">
          <button class="icon-btn" data-action="cal-step" data-dir="-1" aria-label="Previous ${c.view}">${icon('chev-left')}</button>
          <b aria-live="polite">${label}</b>
          <button class="icon-btn" data-action="cal-step" data-dir="1" aria-label="Next ${c.view}">${icon('chev-right')}</button>
          <button class="btn ghost sm" data-action="cal-start">Plan start</button>
        </div>
      </div>
      ${c.view !== 'day' ? `<p class="hint">Drag a visit to another day to move it, or pick a day and press Change. Every move is checked first.</p>` : ''}
      ${board}
      ${c.view !== 'day' ? `<div class="cal-legend" aria-hidden="true"><span><i style="background:var(--peach)"></i>Companion</span><span><i style="background:var(--sage)"></i>Livestock</span><span><i style="background:var(--butter)"></i>Poultry</span><span><i class="lg-closed"></i>Weekend / holiday</span><span>${icon('alert')} Has a conflict</span></div>` : ''}
    </section>
    <aside>${side}</aside>
  </div>`;
}

/** Drag-and-drop move from the calendar: apply directly if valid, otherwise open the editor to explain. */
function moveActivity(id, day) {
  const a = state.plan?.activities.find((x) => x.id === id);
  if (!a || a.start === day) return;
  const r = req(a.requestId);
  const res = previewChange(a, { ...a, start: day }, { keep: null, rescueId: uid() });
  ui.cal.day = day;
  if (!res.blocked) {
    pushHistory();
    state.plan.activities = res.acts;
    afterPlanEdit(`Moved ${brgy(r).name} · ${svc(r).name} to ${fmt(day)} (calendar)`);
    render();
    toast(`${brgy(r).name} moved to ${fmt(day)}`, { undo: true, tone: 'calendar' });
  } else {
    render();
    openActivityEditor({ actId: id, start: day });
  }
}

const VIEWS = { overview: renderOverview, communities: renderCommunities, resources: renderResources, planner: renderPlanner, reports: renderReports };

function render() {
  let route = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (route === 'calendar') { // old link: the calendar now lives inside Plan
    ui.planView = 'calendar'; route = 'planner';
    history.replaceState(null, '', '#/planner');
  }
  const current = VIEWS[route] ? route : 'overview';
  const view = $('#view');
  view.innerHTML = VIEWS[current]();
  document.querySelectorAll('.nav-link').forEach((a) => {
    if (a.dataset.route === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${NAV.find((n) => n.id === current).label} · VetReach`;
  if (ui.route !== current) {
    view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
    clearTimeout(ui.enterTimer); // animate page changes only, not every re-render
    ui.enterTimer = setTimeout(() => view.classList.remove('enter'), 450);
    if (ui.route) { window.scrollTo(0, 0); $('h1', view)?.focus({ preventScroll: true }); }
    ui.route = current;
  }
  if (ui.flash) { document.getElementById('act-' + ui.flash)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); ui.flash = null; }
}

/** Re-render and return focus to the same control (keeps keyboard users in place). */
function rerender(focusSelector) {
  render();
  if (focusSelector) $(focusSelector)?.focus();
}

/* ---------- 7. Dialogs & toasts ---------- */
const modal = $('#modal');
function openModal(html) { modal.returnValue = ''; modal.innerHTML = html; modal.showModal(); }
modal.addEventListener('close', () => { modal.innerHTML = ''; });

function confirmDialog({ title, body, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    openModal(`<form method="dialog" class="dlg"><div class="dlg-head"><h2 id="dlg-title">${title}</h2></div><p>${body}</p>
      <div class="dlg-actions"><button class="btn ghost" value="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" value="yes">${confirm}</button></div></form>`);
    modal.addEventListener('close', () => resolve(modal.returnValue === 'yes'), { once: true });
  });
}

function toast(text, { undo = false, tone = 'check' } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(tone)}<span>${esc(text)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
  if (undo) el.querySelector('button').addEventListener('click', () => { actions.undo(); el.remove(); });
  const box = $('#toasts');
  while (box.children.length > 1) box.firstElementChild.remove(); // show at most two at once
  box.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, undo ? 6000 : 3200);
}

function openRequestForm(id) {
  const r = id ? req(id) : { brgy: state.barangays[0].id, service: 'rabies', animals: 100, prefFrom: '', prefTo: '', requestedOn: state.settings.startDate };
  const svcOptions = Object.entries(CATEGORIES).map(([c, cat]) => `<optgroup label="${cat.label}">${SERVICES.filter((s) => s.cat === c).map((s) => `<option value="${s.id}" ${s.id === r.service ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>`).join('');
  openModal(`<form class="dlg" id="req-form" novalidate>
    <div class="dlg-head"><div><h2 id="dlg-title">${id ? 'Edit request' : 'New outreach request'}</h2><p>What the barangay asked for. The planner uses this to estimate supplies, days and cost.</p></div>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
    <div class="form-grid">
      ${select('brgy', 'Barangay', state.barangays.map((b) => [b.id, b.name]), r.brgy)}
      <label class="field"><span>Service</span><select class="input" name="service">${svcOptions}</select></label>
      <label class="field"><span>Estimated number of animals</span><input class="input" name="animals" type="number" min="1" max="20000" step="1" inputmode="numeric" value="${r.animals}" aria-describedby="err-animals" required><small class="err" id="err-animals"></small></label>
      <label class="field"><span>Date filed</span><input class="input" name="requestedOn" type="date" value="${r.requestedOn}" aria-describedby="err-requestedOn" required><small class="err" id="err-requestedOn"></small></label>
      <label class="field"><span>Preferred from <span class="muted">(optional)</span></span><input class="input" name="prefFrom" type="date" value="${r.prefFrom}"></label>
      <label class="field"><span>Preferred until <span class="muted">(optional)</span></span><input class="input" name="prefTo" type="date" value="${r.prefTo}" aria-describedby="err-prefTo"><small class="err" id="err-prefTo"></small></label>
    </div>
    <p class="small muted" id="req-hint"></p>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">${icon('check')} ${id ? 'Save changes' : 'Add request'}</button></div>
  </form>`);
  const form = $('#req-form'), el = form.elements;
  const hint = () => {
    const animals = parseInt(el.animals.value, 10);
    if (!(animals > 0)) { $('#req-hint').textContent = ''; return; }
    const n = needs({ ...r, brgy: el.brgy.value, service: el.service.value, animals });
    $('#req-hint').textContent = `Estimate: ${n.days} team-day${n.days > 1 ? 's' : ''}, ${num(n.qty)} ${supply(n.supply).unit} (${supply(n.supply).name.toLowerCase()}), about ${peso(n.cost)}.`;
  };
  form.addEventListener('input', hint); hint();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = { brgy: el.brgy.value, service: el.service.value, animals: Number(el.animals.value), requestedOn: el.requestedOn.value, prefFrom: el.prefFrom.value, prefTo: el.prefTo.value };
    const errors = {};
    if (!Number.isInteger(data.animals) || data.animals < 1 || data.animals > 20000) errors.animals = 'Enter a whole number from 1 to 20,000.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.requestedOn)) errors.requestedOn = 'Choose the date the request was filed.';
    if (data.prefFrom && data.prefTo && data.prefTo < data.prefFrom) errors.prefTo = 'This must be on or after the “Preferred from” date.';
    ['animals', 'requestedOn', 'prefTo'].forEach((k) => { $('#err-' + k).textContent = errors[k] || ''; el[k].setAttribute('aria-invalid', errors[k] ? 'true' : 'false'); });
    const firstBad = Object.keys(errors)[0];
    if (firstBad) { el[firstBad].focus(); return; }
    const label = `${find(state.barangays, data.brgy).name} · ${find(SERVICES, data.service).name}`;
    if (id) Object.assign(r, data); else state.requests.push({ id: uid(), ...data });
    addLog(id ? `Edited request: ${label}` : `Added request: ${label}`);
    markStale(); save(); modal.close(); render();
    toast(id ? 'Request updated' : 'Request added');
  });
}

/**
 * Preview the consequences of changing (or adding) one activity before committing it.
 * Returns the new activity list, whether it is blocked, and HTML describing the effects.
 */
function previewChange(original, draft, ctx) {
  const plan = state.plan, before = validate(plan.activities);
  const acts = [...plan.activities.filter((a) => a.id !== draft.id), { ...draft }];
  const lost = original && original.requestId !== draft.requestId ? req(original.requestId) : null;
  const rescue = lost ? findSlots(lost, acts)[0] : null;
  const rescueAct = rescue && { id: ctx.rescueId, requestId: lost.id, ...rescue };
  // Offer to keep the displaced barangay covered; pre-tick it only if it fits supplies and budget
  if (rescue && ctx.keep === null) ctx.keep = validate([...acts, rescueAct]).global.every((m) => validate(acts).global.includes(m));
  if (rescue && ctx.keep) acts.push(rescueAct);
  const after = validate(acts);
  const perActivity = (m) => !m.startsWith('Not enough '); // supply shortages are reported once, plan-wide
  const own = (after.issues[draft.id] || []).filter(perActivity);
  // Effects on other activities (double-bookings are already named in this activity's own messages)
  const ripple = Object.entries(after.issues).filter(([id]) => id !== draft.id)
    .flatMap(([id, list]) => list.filter((m) => perActivity(m) && !m.includes('double-booked') && !(before.issues[id] || []).includes(m)).map((m) => `${brgy(req(acts.find((a) => a.id === id).requestId)).name}: ${m}`));
  const newGlobal = after.global.filter((m) => !before.global.includes(m));
  const problems = [...own, ...ripple, ...newGlobal];
  const unchanged = original && ['requestId', 'start', 'teamId', 'vehicleId'].every((k) => original[k] === draft[k]);
  const r = req(draft.requestId), b = brgy(r), s = svc(r);

  // Valid alternatives for the same request, checked against every rule
  let options = [];
  if (problems.length) {
    const rest = acts.filter((a) => a.id !== draft.id);
    const isOriginal = (o) => original && original.requestId === draft.requestId && ['start', 'teamId', 'vehicleId'].every((k) => o[k] === original[k]);
    options = findSlots(r, rest, 8).filter((o) => {
      if (isOriginal(o)) return false;
      const test = validate([...rest, { ...draft, ...o }]);
      return !test.issues[draft.id].filter(perActivity).length && test.global.every((m) => before.global.includes(m));
    }).slice(0, 3);
  }

  const notes = [];
  if (lost) {
    const lb = brgy(lost), still = acts.some((a) => a.id !== ctx.rescueId && req(a.requestId).brgy === lb.id);
    notes.push(`<div class="notice warn">${icon('alert')}<div><b>${still ? `${esc(lb.name)}'s ${esc(svc(lost).name.toLowerCase())} request will lose its slot.` : `${esc(lb.name)} will no longer have a scheduled ${esc(svc(lost).name.toLowerCase())} visit.`}</b>
      ${rescue ? ` Consider assigning another available team:<label class="check-line" style="margin-top:8px"><input type="checkbox" name="keep" ${ctx.keep ? 'checked' : ''}><span>Keep ${esc(lb.name)} covered — ${esc(team(rescue.teamId).name)} on ${fmt(rescue.start)} with ${esc(vehicle(rescue.vehicleId).name)}</span></label>`
      : ' No other team is free for it right now, so it will move to “Couldn’t schedule”.'}</div></div>`);
  }
  if (!original || lost) notes.push(`<div class="notice ok">${icon('check')}<div>${esc(b.name)} gains a ${esc(s.name.toLowerCase())} visit on ${fmt(draft.start)}.</div></div>`);
  if (original && original.start !== draft.start && !lost) notes.push(`<div class="notice info">${icon('calendar')}<div>Moves from ${fmt(original.start)} to ${fmt(draft.start)}.</div></div>`);

  const status = unchanged ? `<p class="muted small">Pick a different request, date, team or vehicle to preview the effect.</p>`
    : problems.length ? `<div class="notice bad">${icon('alert')}<div><b>This change can't be applied yet.</b><ul>${problems.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
        ${options.length ? `<p style="margin-top:8px">Valid alternatives for ${esc(b.name)}:</p><div class="option-list">${options.map((o, i) => `<button type="button" class="btn secondary sm" data-local="use" data-i="${i}">${icon('check')} ${esc(team(o.teamId).name)} · ${fmt(o.start)} · ${esc(vehicle(o.vehicleId).name)}</button>`).join('')}</div>`
        : '<p style="margin-top:8px">No conflict-free alternative right now. Try freeing a team or adding supplies in Resources.</p>'}</div></div>`
    : `<div class="notice ok pop-in">${icon('check')}<div><b>Looks good — no conflicts.</b> Plan cost after this change: ${peso(after.cost)} of ${peso(state.budget.total)}.</div></div>`;

  return { acts, blocked: unchanged || problems.length > 0, hadProblems: problems.length > 0, options, lost, rescued: !!(rescue && ctx.keep), before, after, html: status + notes.join('') };
}

function openActivityEditor({ actId, reqId, start }) {
  const plan = state.plan, days = planningDays();
  const original = actId ? plan.activities.find((a) => a.id === actId) : null;
  const first = req(original ? original.requestId : reqId);
  // If no slot satisfies every rule, start from a sensible guess and let the preview explain what's missing
  const fallback = {
    teamId: (state.teams.find((t) => t.quals.includes(svc(first).qual)) || state.teams[0]).id,
    vehicleId: (state.vehicles.find((v) => v.offroad === (brgy(first).access === 3)) || state.vehicles[0]).id,
    start: days[0],
  };
  // `start` comes from the calendar (a dropped visit, or "schedule on this day")
  const slot = start ? (findSlots(first, plan.activities, 10).find((o) => o.start === start) || { ...(findSlots(first, plan.activities)[0] || fallback), start })
    : (findSlots(first, plan.activities)[0] || fallback);
  const draft = original ? { ...original, ...(start ? { start } : {}) } : { id: uid(), requestId: first.id, ...slot };
  const ctx = { keep: null, rescueId: uid(), sawConflict: false }; // keep: null = not decided yet
  const reqChoices = state.requests.filter((r) => r.id === draft.requestId || !activityFor(r));
  let result;

  openModal(`<form class="dlg" id="act-form" onsubmit="return false">
    <div class="dlg-head"><div><h2 id="dlg-title">${original ? 'Change assignment' : 'Schedule a request'}</h2><p>Every change is checked against qualifications, availability, vehicles, supplies and budget before you apply it.</p></div>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>
    <div class="form-grid">
      ${select('requestId', original ? 'Request served by this visit' : 'Request', reqChoices.map((r) => [r.id, `${brgy(r).name} — ${svc(r).name} (${num(r.animals)})`]), draft.requestId, 'full')}
      ${select('start', 'Start date', days.map((d) => [d, fmt(d)]), draft.start)}
      ${select('teamId', 'Team', state.teams.map((t) => [t.id, `${t.name} (${t.quals.map((q) => QUALS[q].split(' ')[0]).join(', ') || 'no qualifications'})`]), draft.teamId)}
      ${select('vehicleId', 'Vehicle', state.vehicles.map((v) => [v.id, v.name + (v.offroad ? ' · 4×4' : '')]), draft.vehicleId, 'full')}
    </div>
    <section class="preview" id="preview" aria-live="polite"></section>
    <div class="dlg-actions">
      ${original ? `<button type="button" class="text-btn danger-text" data-local="remove">Remove from plan</button>` : ''}<span class="spacer"></span>
      <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
      <button type="button" class="btn primary" data-local="apply">${icon('check')} Apply change</button>
    </div></form>`);

  const form = $('#act-form'), el = form.elements;
  const update = () => {
    ['requestId', 'start', 'teamId', 'vehicleId'].forEach((k) => { draft[k] = el[k].value; });
    result = previewChange(original, draft, ctx);
    if (result.hadProblems) ctx.sawConflict = true;
    $('#preview').innerHTML = result.html;
    $('[data-local="apply"]', form).disabled = result.blocked;
  };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'keep') ctx.keep = e.target.checked;
    if (e.target.name === 'requestId') ctx.keep = null;
    update();
  });
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-local]');
    if (!btn) return;
    if (btn.dataset.local === 'use') {
      const o = result.options[Number(btn.dataset.i)];
      el.start.value = o.start; el.teamId.value = o.teamId; el.vehicleId.value = o.vehicleId;
      update(); $('[data-local="apply"]', form).focus();
    } else if (btn.dataset.local === 'remove') {
      pushHistory();
      plan.activities = plan.activities.filter((a) => a.id !== original.id);
      plan.reasons[original.requestId] = 'Removed from the plan by an administrator';
      afterPlanEdit(`Removed ${brgy(req(original.requestId)).name} · ${svc(req(original.requestId)).name} from the plan`);
      modal.close(); render(); toast('Activity removed from the plan', { undo: true });
    } else if (btn.dataset.local === 'apply' && !result.blocked) {
      pushHistory();
      plan.activities = result.acts;
      delete plan.reasons[draft.requestId];
      if (result.lost) { if (result.rescued) delete plan.reasons[result.lost.id]; else plan.reasons[result.lost.id] = 'Its slot was given to another request by an administrator'; }
      const resolved = ctx.sawConflict || result.after.count + result.after.global.length < result.before.count + result.before.global.length;
      if (resolved) state.resolved += 1;
      const r = req(draft.requestId);
      afterPlanEdit(`${resolved ? 'Resolved a conflict — ' : ''}${original ? 'Changed' : 'Scheduled'} ${brgy(r).name} · ${svc(r).name}: ${team(draft.teamId).name}, ${fmt(draft.start)}`);
      ui.flash = draft.id;
      modal.close(); render(); toast(resolved ? 'Conflict resolved — plan updated' : 'Plan updated', { undo: true });
    }
  });
  update();
}

/** Shared bookkeeping after any manual plan edit. Editing an approved plan returns it to "suggested". */
function afterPlanEdit(text) {
  if (state.plan.status === 'approved') { state.plan.status = 'suggested'; text += ' (plan returned to suggested — approve again when ready)'; }
  ui.justGenerated = null;
  addLog(text);
  save();
}

/* ---------- 8. Actions & events ---------- */
const actions = {
  'toggle-theme'() {
    const dark = currentTheme() === 'dark';
    document.documentElement.classList.add('theming');
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark'); } catch (e) { /* storage blocked: theme lasts this visit */ }
    setTimeout(() => document.documentElement.classList.remove('theming'), 320);
    paintThemeButtons();
  },
  async 'reset-demo'() {
    if (!(await confirmDialog({ title: 'Reset demo data?', body: 'This replaces all requests, resources and plans with the original fictional demo data. It cannot be undone.', confirm: 'Reset', danger: true }))) return;
    state = seedState(); ui.filter = 'all'; ui.search = ''; ui.justGenerated = null;
    ui.cal = { view: 'month', day: state.settings.startDate }; ui.planView = 'list'; ui.resTab = 'teams';
    save(); render(); toast('Demo data restored');
  },
  'close-modal'() { modal.close(); },
  async generate() {
    if (state.plan?.status === 'approved' && !(await confirmDialog({ title: 'Replace the approved plan?', body: 'A new suggested plan will replace the approved one. You can undo this from the Plan page.', confirm: 'Generate new plan' }))) return;
    pushHistory();
    state.plan = generatePlan();
    const acts = state.plan.activities;
    ui.justGenerated = { scheduled: acts.length, total: state.requests.length, barangays: new Set(acts.map((a) => req(a.requestId).brgy)).size };
    addLog(`Generated a plan: ${acts.length} of ${state.requests.length} requests scheduled`);
    save();
    if (location.hash !== '#/planner') location.hash = '#/planner'; else render();
    toast('Plan generated', { undo: true, tone: 'paw' });
  },
  approve() {
    if (!state.plan || !validate(state.plan.activities).ok) return;
    pushHistory();
    Object.assign(state.plan, { status: 'approved', stale: false, approvedAt: new Date().toISOString() });
    ui.justGenerated = null;
    addLog('Approved the outreach plan'); save(); render(); toast('Plan approved', { tone: 'shield' });
  },
  undo() {
    if (!state.history.length) return;
    state.plan = JSON.parse(state.history.pop());
    ui.justGenerated = null;
    addLog('Undid the last plan change'); save(); render(); toast('Change undone', { tone: 'undo' });
  },
  'new-request'() { openRequestForm(); },
  'edit-request'({ id }) { openRequestForm(id); },
  async 'delete-request'({ id }) {
    const r = req(id), label = `${brgy(r).name} · ${svc(r).name}`, planned = activityFor(r);
    if (!(await confirmDialog({ title: 'Remove this request?', body: `${esc(label)} will be removed${planned ? ', along with its planned visit' : ''}. This cannot be undone.`, confirm: 'Remove', danger: true }))) return;
    state.requests = state.requests.filter((x) => x.id !== id);
    if (state.plan) { state.plan.activities = state.plan.activities.filter((a) => a.requestId !== id); delete state.plan.reasons[id]; state.history = []; }
    addLog(`Removed request: ${label}`); save(); render(); toast('Request removed');
  },
  filter({ filter }) { ui.filter = filter; rerender(`[data-action="filter"][data-filter="${filter}"]`); },
  'toggle-day'({ kind, id, day }) {
    const item = kind === 'team' ? team(id) : vehicle(id);
    const off = item.off.includes(day);
    changeResource(() => { item.off = off ? item.off.filter((d) => d !== day) : [...item.off, day]; },
      `${item.name} marked ${off ? 'available' : 'unavailable'} on ${fmt(day)}`, `[data-action="toggle-day"][data-id="${id}"][data-day="${day}"]`);
  },
  'edit-activity'({ id }) { openActivityEditor({ actId: id }); },
  'schedule-request'({ id }) { openActivityEditor({ reqId: id }); },
  'schedule-on'({ day }) {
    const r = state.requests.find((x) => !activityFor(x));
    if (r) openActivityEditor({ reqId: r.id, start: day });
  },
  'plan-view'({ view }) { ui.planView = view; rerender(`[data-action="plan-view"][data-view="${view}"]`); },
  'res-tab'({ tab }) { ui.resTab = tab; rerender(`[data-action="res-tab"][data-tab="${tab}"]`); },
  'cal-select'({ day }) {
    if (ui.cal.day === day) return;
    ui.cal.day = day;
    rerender(`[data-day="${day}"].cal-num, [data-day="${day}"].wk-head`);
  },
  'cal-view'({ view }) { ui.cal.view = view; rerender(`[data-action="cal-view"][data-view="${view}"]`); },
  'cal-step'({ dir }) {
    const n = Number(dir), c = ui.cal;
    c.day = c.view === 'month' ? shiftMonth(c.day.slice(0, 7), n) + '-01' : addDays(c.day, c.view === 'week' ? 7 * n : n);
    rerender(`[data-action="cal-step"][data-dir="${dir}"]`);
  },
  'cal-start'() { ui.cal.day = planningDays()[0]; rerender('[data-action="cal-start"]'); },
  'start-tour'() { startTour(); },
  print() { window.print(); },
  'export-csv'() {
    const rows = [['Date', 'Days', 'Barangay', 'Service', 'Animals', 'Team', 'Vehicle', 'Estimated cost (PHP)']];
    [...state.plan.activities].filter((a) => req(a.requestId)).sort((a, b) => a.start.localeCompare(b.start)).forEach((a) => {
      const r = req(a.requestId), n = needs(r);
      rows.push([a.start, n.days, brgy(r).name, svc(r).name, r.animals, team(a.teamId).name, vehicle(a.vehicleId).name, n.cost]);
    });
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'vetreach-schedule.csv' });
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Schedule exported as CSV', { tone: 'download' });
  },
};

/** Apply a resource edit, save, flag the plan, and tell the user whether it created or cleared conflicts. */
function changeResource(mutate, logText, focusSelector) {
  const conflicts = () => { const v = validate(state.plan.activities); return v.count + v.global.length; };
  const before = state.plan ? conflicts() : 0;
  mutate();
  addLog(logText); markStale(); save(); rerender(focusSelector);
  const delta = state.plan ? conflicts() - before : 0;
  if (delta > 0) toast(`Saved — ${delta} new conflict${delta === 1 ? '' : 's'} in the plan. Check the Plan page.`, { tone: 'alert' });
  else if (delta < 0) toast(`Saved — ${-delta} conflict${delta === -1 ? '' : 's'} cleared.`);
  else toast('Resources updated');
}

const changeHandlers = {
  'team-qual'(el) {
    const t = team(el.dataset.id);
    changeResource(() => { t.quals = el.checked ? [...new Set([...t.quals, el.value])] : t.quals.filter((q) => q !== el.value); },
      `${t.name}: ${QUALS[el.value]} ${el.checked ? 'added' : 'removed'}`, `[data-change="team-qual"][data-id="${t.id}"][value="${el.value}"]`);
  },
  'supply-qty'(el) {
    const s = supply(el.dataset.id), v = Number(el.value);
    if (el.value === '' || !Number.isInteger(v) || v < 0) { el.value = s.qty; return toast('Enter a whole number of 0 or more.', { tone: 'alert' }); }
    changeResource(() => { s.qty = v; }, `${s.name} stock set to ${num(v)} ${s.unit}`);
  },
  budget(el) {
    const v = Number(el.value);
    if (el.value === '' || !Number.isFinite(v) || v < 0) { el.value = state.budget.total; return toast('Enter a budget of ₱0 or more.', { tone: 'alert' }); }
    changeResource(() => { state.budget.total = Math.round(v); }, `Outreach budget set to ${peso(v)}`);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  e.preventDefault();
  actions[el.dataset.action](el.dataset, el);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) changeHandlers[el.dataset.change](el);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'req-search') { ui.search = e.target.value; $('#req-list').innerHTML = renderRequestList(); }
  if (e.target.dataset.weight) {
    state.settings.weights[e.target.dataset.weight] = Number(e.target.value);
    $('#o-' + e.target.dataset.weight).textContent = e.target.value;
    $('#prio-list').innerHTML = renderPriorities();
    $('#req-list').innerHTML = renderRequestList();
    save();
  }
});
window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#/planner')) ui.justGenerated = null; // keep the "Plan ready" card when generate navigates here
  render();
});
window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); render(); } });

// Remember whether "How priority is decided" is open across re-renders
document.addEventListener('toggle', (e) => { if (e.target.id === 'prio-details') ui.prioOpen = e.target.open; }, true);

// Calendar drag-and-drop (mouse). Keyboard and touch users move visits with the "Change" button.
const clearDrop = (keep) => document.querySelectorAll('.drop-ok').forEach((x) => { if (x !== keep) x.classList.remove('drop-ok'); });
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest?.('[data-drag]');
  if (!el) return;
  ui.dragId = el.dataset.drag;
  e.dataTransfer.setData('text/plain', el.dataset.drag);
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('dragging');
});
document.addEventListener('dragover', (e) => {
  if (!ui.dragId) return;
  const cell = e.target.closest?.('[data-drop]');
  clearDrop(cell);
  if (!cell) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  cell.classList.add('drop-ok');
});
document.addEventListener('drop', (e) => {
  const cell = e.target.closest?.('[data-drop]'), id = ui.dragId;
  if (!cell || !id) return;
  e.preventDefault();
  ui.dragId = null;
  moveActivity(id, cell.dataset.day);
});
document.addEventListener('dragend', () => {
  ui.dragId = null;
  clearDrop();
  document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging'));
});

/* ---------- Guided tour (shown on first visit, replay from the help button) ---------- */
const TOUR_KEY = 'vetreach-tour-v2';
const TOUR = [
  { title: 'Welcome to VetReach', art: true,
    body: 'VetReach helps a municipal veterinary office plan outreach visits to barangays. This quick tour takes 30 seconds. Everything uses fictional demo data, so feel free to try things.' },
  { target: '#tour-steps', title: 'Three steps, top to bottom',
    body: 'Review what barangays requested, check the teams, vehicles, supplies and budget you have, then make the plan.' },
  { target: '#tour-generate', title: () => (state.plan ? 'Your plan' : 'One click makes a plan'),
    body: () => (state.plan ? 'Open the current plan from here. The button changes as the plan moves along: fix, approve, view.'
      : 'VetReach ranks the requests and matches each one with a qualified team, vehicle, supplies and budget. Nothing is final until you approve it.') },
  { target: '#side-nav, #bottom-nav', title: 'Five pages',
    body: 'Home, Requests, Resources, Plan and Reports. In Plan you can switch between a list and a calendar, and drag visits to other days. Changes save automatically.' },
  { target: '.side-foot [data-action="start-tour"], .topbar [data-action="start-tour"]', title: 'You’re all set',
    body: () => `Replay this tour any time from here. ${state.plan ? 'Try opening the plan as a calendar next.' : 'Start by pressing Generate plan.'}` },
];
const tour = { i: 0, el: $('#tour'), lastFocus: null, open: false };
const val = (x) => (typeof x === 'function' ? x() : x);
/** First matching element that is actually on screen (sidebar on desktop, bottom bar on phones). */
const visibleEl = (sel) => [...document.querySelectorAll(sel)].find((el) => el.getClientRects().length && el.getBoundingClientRect().width > 0);

function startTour() {
  if (tour.open) return;
  if (!location.hash.startsWith('#/overview') && location.hash) location.hash = '#/overview';
  if (modal.open) modal.close();
  Object.assign(tour, { i: 0, open: true, lastFocus: document.activeElement });
  tour.el.hidden = false;
  document.querySelector('.shell').inert = true;
  $('#bottom-nav').inert = true;
  requestAnimationFrame(paintTour);
}
function endTour() {
  tour.open = false;
  tour.el.hidden = true;
  tour.el.innerHTML = '';
  document.querySelector('.shell').inert = false;
  $('#bottom-nav').inert = false;
  try { localStorage.setItem(TOUR_KEY, 'done'); } catch (e) { /* storage blocked: tour may show again next visit */ }
  (tour.lastFocus && document.contains(tour.lastFocus) ? tour.lastFocus : $('#view')).focus?.();
}
function paintTour() {
  const s = TOUR[tour.i], n = TOUR.length, last = tour.i === n - 1;
  const target = s.target ? visibleEl(s.target) : null;
  tour.el.innerHTML = `${target ? '<div class="tour-spot"></div>' : '<div class="tour-shade"></div>'}
    <div class="tour-card ${target ? '' : 'center'}" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      ${s.art ? `<div class="tour-art">${ART.village}</div>` : ''}
      <p class="eyebrow">Step ${tour.i + 1} of ${n}</p>
      <h2 id="tour-title">${esc(val(s.title))}</h2>
      <p id="tour-body">${esc(val(s.body))}</p>
      <div class="tour-foot">
        <div class="tour-dots" aria-hidden="true">${TOUR.map((_, k) => `<i class="${k === tour.i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="tour-btns">
          ${tour.i === 0 ? '<button type="button" class="btn ghost sm" data-tour="skip">Skip</button>' : '<button type="button" class="btn ghost sm" data-tour="back">Back</button>'}
          <button type="button" class="btn primary sm" data-tour="next">${last ? `${icon('check')} Finish` : tour.i === 0 ? `${icon('paw')} Start tour` : 'Next'}</button>
        </div>
      </div>
      ${tour.i > 0 && !last ? '<button type="button" class="text-btn small" data-tour="skip" style="justify-self:start;padding:0">Skip tour</button>' : ''}
    </div>`;
  if (target) { target.scrollIntoView({ block: 'nearest' }); placeTour(target); }
  $('[data-tour="next"]', tour.el).focus();
}
function placeTour(target) {
  const r = target.getBoundingClientRect(), pad = 6, gap = 18;
  const spot = $('.tour-spot', tour.el), card = $('.tour-card', tour.el);
  Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const cw = card.offsetWidth, ch = card.offsetHeight, vw = innerWidth, vh = innerHeight;
  let top, left;
  if (r.right + gap + cw < vw - 16) { left = r.right + gap; top = r.top + r.height / 2 - ch / 2; }      // to the right
  else if (r.bottom + gap + ch < vh - 16) { top = r.bottom + gap; left = r.left + r.width / 2 - cw / 2; } // below
  else { top = r.top - gap - ch; left = r.left + r.width / 2 - cw / 2; }                                  // above
  card.style.left = `${clamp(left, 16, vw - cw - 16)}px`;
  card.style.top = `${clamp(top, 16, vh - ch - 16)}px`;
}
tour.el.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]');
  if (!b) return;
  const go = b.dataset.tour;
  if (go === 'skip' || (go === 'next' && tour.i === TOUR.length - 1)) return endTour();
  tour.i += go === 'next' ? 1 : -1;
  paintTour();
});
tour.el.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); endTour(); }
  else if (e.key === 'ArrowRight' && tour.i < TOUR.length - 1) { tour.i += 1; paintTour(); }
  else if (e.key === 'ArrowLeft' && tour.i > 0) { tour.i -= 1; paintTour(); }
  else if (e.key === 'Tab') { // keep focus inside the tour card
    const f = [...tour.el.querySelectorAll('button')];
    const i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
});
window.addEventListener('resize', () => { if (tour.open) paintTour(); });

/* ---------- 9. Boot ---------- */
const currentTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function paintThemeButtons() {
  const dark = currentTheme() === 'dark';
  document.querySelectorAll('.theme-btn').forEach((b) => {
    b.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
    b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  });
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeButtons);

const navHtml = NAV.map((n) => `<a class="nav-link" href="#/${n.id}" data-route="${n.id}" title="${n.label}">${icon(n.icon)}<span>${n.label}</span></a>`).join('');
$('#side-nav').innerHTML = navHtml;
$('#bottom-nav').innerHTML = navHtml;
paintThemeButtons();
render();
// First visit: offer the guided tour once
try { if (!localStorage.getItem(TOUR_KEY)) setTimeout(startTour, 450); } catch (e) { /* storage blocked: skip the automatic tour */ }
