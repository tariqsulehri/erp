#!/usr/bin/env node
// build-report.mjs: validate findings.json, derive the fix order, write report.html + findings.csv.
// No dependencies. Node 18+.
//
// Usage: node build-report.mjs <run-folder> [--strict] [--check]
//   --strict  enforce the "required in strict mode" rules from core/05-finding-schema.md
//   --check   validate only; write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '..');

const SEV = ['Critical', 'High', 'Medium', 'Low'];
const URG = ['U0', 'U1', 'U2', 'U3', 'U4'];
const CONF = ['confirmed', 'likely', 'suspected'];
const EFFORT = ['S', 'M', 'L'];
const RISK = ['low', 'medium', 'high'];
const LEVEL = ['Low', 'Medium', 'High'];
const STATUS = ['open', 'in-progress', 'fixed', 'not-reproduced', 'deferred', 'accepted'];
const GRADES = ['A', 'B', 'C', 'D', 'F'];
const DIMS = {
  security: 'Security', architecture: 'Architecture', data: 'Data', performance: 'Performance',
  reliability: 'Reliability', observability: 'Observability', testing: 'Testing',
  'cicd-supply-chain': 'CI/CD and supply chain', dependencies: 'Dependencies',
  accessibility: 'Accessibility', 'ux-design': 'UX and design', cost: 'Cost',
  compliance: 'Compliance', 'code-health': 'Code health', documentation: 'Documentation',
};
const URG_NAME = { U0: 'Now', U1: 'This sprint', U2: 'Next release', U3: 'Planned', U4: 'Backlog' };
const SEV_LETTER = { Critical: 'C', High: 'H', Medium: 'M', Low: 'L' };
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT'],
  [/\b(?:password|passwd|secret|api[_-]?key|token)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i, 'credential assignment'],
];

// ---------- args ----------
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const checkOnly = args.includes('--check');
const runDir = args.find((a) => !a.startsWith('--'));
if (!runDir) {
  console.error('Usage: node build-report.mjs <run-folder> [--strict] [--check]');
  process.exit(2);
}
const dir = path.resolve(runDir);
const readJson = (p, required) => {
  if (!fs.existsSync(p)) {
    if (required) { console.error(`Missing file: ${p}`); process.exit(2); }
    return null;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`Invalid JSON in ${p}: ${e.message}`); process.exit(2); }
};
const data = readJson(path.join(dir, 'findings.json'), true);
const config = readJson(path.join(dir, 'report.config.json'), false) || {};

// ---------- validate ----------
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const strictErr = (m) => (strict ? errors : warnings).push(m);
const warn = (m) => warnings.push(m);

const findings = Array.isArray(data.findings) ? data.findings : (err('findings must be an array'), []);
const waves = Array.isArray(data.waves) ? data.waves : [];
const chains = Array.isArray(data.chains) ? data.chains : [];
const decisions = Array.isArray(data.decisions) ? data.decisions : [];
const scorecard = Array.isArray(data.scorecard) ? data.scorecard : [];
const summary = data.summary || {};

const byId = new Map();
const oneOf = (v, list) => list.includes(v);
for (const f of findings) {
  const id = f && f.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) { err(`Bad or missing finding id: ${JSON.stringify(id)}`); continue; }
  if (byId.has(id)) { err(`Duplicate finding id: ${id}`); continue; }
  byId.set(id, f);
}
for (const f of findings) {
  const id = f.id;
  if (!byId.has(id)) continue;
  const at = `${id}:`;
  if (!f.title) err(`${at} title is required`);
  if (!oneOf(f.severity, SEV)) err(`${at} severity must be one of ${SEV.join(', ')}`);
  if (!oneOf(f.confidence, CONF)) err(`${at} confidence must be one of ${CONF.join(', ')}`);
  if (!f.evidence) err(`${at} evidence is required (no evidence, no finding)`);
  if (!f.fix) strictErr(`${at} fix is required`);
  if (!f.dimension) err(`${at} dimension is required`);
  else if (!DIMS[f.dimension]) strictErr(`${at} dimension "${f.dimension}" is not one of: ${Object.keys(DIMS).join(', ')}`);
  if (f.urgency === undefined) strictErr(`${at} urgency is required`);
  else if (!oneOf(f.urgency, URG)) err(`${at} urgency must be one of ${URG.join(', ')}`);
  if (f.urgency !== undefined && !f.urgency_reason) strictErr(`${at} urgency_reason is required`);
  if (f.effort === undefined) strictErr(`${at} effort is required`);
  else if (!oneOf(f.effort, EFFORT)) err(`${at} effort must be one of ${EFFORT.join(', ')}`);
  if (f.fix_risk !== undefined && !oneOf(f.fix_risk, RISK)) err(`${at} fix_risk must be one of ${RISK.join(', ')}`);
  for (const k of ['likelihood', 'impact']) if (f[k] !== undefined && !oneOf(f[k], LEVEL)) err(`${at} ${k} must be one of ${LEVEL.join(', ')}`);
  if (f.status !== undefined && !oneOf(f.status, STATUS)) err(`${at} status must be one of ${STATUS.join(', ')}`);
  if (f.confidence === 'suspected' && f.severity === 'Critical') err(`${at} a suspected finding cannot be Critical`);
  if (f.severity === 'Critical' && f.confidence !== 'confirmed' && f.confidence !== 'suspected') warn(`${at} Critical but only "likely"; trace or reproduce it to confirm`);
  const locs = Array.isArray(f.locations) ? f.locations : [];
  if ((f.confidence === 'confirmed' || f.confidence === 'likely') && locs.length === 0) strictErr(`${at} locations (path:line) required when confidence is ${f.confidence}`);
  for (const l of locs) if (!/:\d+(-\d+)?$/.test(String(l))) warn(`${at} location "${l}" should look like path:line`);
  if (f.likelihood && f.impact) {
    const score = LEVEL.indexOf(f.likelihood) + LEVEL.indexOf(f.impact);
    const expect = score >= 4 ? 'Critical' : score === 3 ? 'High' : score === 2 ? 'Medium' : 'Low';
    if (Math.abs(SEV.indexOf(f.severity) - SEV.indexOf(expect)) > 1) warn(`${at} severity ${f.severity} disagrees with likelihood ${f.likelihood} x impact ${f.impact}`);
  }
  for (const b of f.blocked_by || []) {
    if (b === id) err(`${at} blocked_by itself`);
    else if (!byId.has(b)) err(`${at} blocked_by unknown id ${b}`);
  }
  if (f.chain_id && chains.length && !chains.some((c) => c.id === f.chain_id)) err(`${at} chain_id ${f.chain_id} not in chains`);
  if (f.decision_id && !decisions.some((d) => d.id === f.decision_id)) err(`${at} decision_id ${f.decision_id} not in decisions`);
  if (f.needs_decision && !f.decision_id) warn(`${at} needs_decision is true but decision_id is missing`);
}

// cycles
{
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { err(`Dependency cycle: ${[...stack.slice(stack.indexOf(id)), id].join(' -> ')}`); return; }
    state.set(id, 1); stack.push(id);
    for (const b of byId.get(id).blocked_by || []) if (byId.has(b)) visit(b);
    stack.pop(); state.set(id, 2);
  };
  for (const id of byId.keys()) visit(id);
}

// waves
const waveOf = new Map();
const waveIds = new Set();
waves.forEach((w, i) => {
  if (!w.id) { err(`waves[${i}] needs an id`); return; }
  if (waveIds.has(w.id)) err(`Duplicate wave id ${w.id}`);
  waveIds.add(w.id);
  if (!w.name) strictErr(`${w.id}: name is required`);
  if (!w.goal) strictErr(`${w.id}: goal is required`);
  if (!w.why_order) strictErr(`${w.id}: why_order is required`);
  if (!Array.isArray(w.exit_criteria) || !w.exit_criteria.length) strictErr(`${w.id}: exit_criteria is required`);
  for (const id of w.ids || []) {
    if (!byId.has(id)) { err(`${w.id}: unknown finding ${id}`); continue; }
    if (waveOf.has(id)) err(`${id} is in two waves (${waveOf.get(id).id} and ${w.id})`);
    else waveOf.set(id, { id: w.id, index: i });
  }
});
if (waves.length) {
  for (const f of findings) {
    if (!byId.has(f.id)) continue;
    const parked = f.status === 'deferred' || f.status === 'accepted' || f.status === 'not-reproduced' || f.status === 'fixed' || f.needs_decision;
    if (!waveOf.has(f.id) && !parked) strictErr(`${f.id}: not in any wave (put it in a wave, or mark it deferred / needs_decision)`);
    if (f.urgency === 'U0' && waveOf.has(f.id) && waveOf.get(f.id).index !== 0) strictErr(`${f.id}: U0 must be in the first wave`);
    for (const b of f.blocked_by || []) {
      if (waveOf.has(f.id) && waveOf.has(b) && waveOf.get(b).index > waveOf.get(f.id).index) err(`${f.id} is in ${waveOf.get(f.id).id} but its blocker ${b} is in the later ${waveOf.get(b).id}`);
    }
  }
} else if (findings.length) {
  strictErr('waves are required: add the fix plan (see core/07-sequencing.md)');
}
for (const c of chains) for (const id of c.ids || []) if (!byId.has(id)) err(`chain ${c.id}: unknown finding ${id}`);
for (const d of decisions) for (const id of d.blocks || []) if (!byId.has(id)) err(`decision ${d.id}: unknown finding ${id}`);

// scorecard and summary
const critDims = new Set(findings.filter((f) => f.severity === 'Critical').map((f) => f.dimension));
for (const s of scorecard) {
  if (typeof s.score !== 'number' || s.score < 0 || s.score > 5) err(`scorecard "${s.dimension}": score must be a number from 0 to 5`);
  if (critDims.has(s.dimension) && s.score > 2) strictErr(`scorecard "${s.dimension}": has a Critical finding, so the score cannot be above 2`);
  if (!s.why) strictErr(`scorecard "${s.dimension}": why is required`);
}
if (!summary.headline) strictErr('summary.headline is required');
if (!oneOf(summary.overall_grade, GRADES)) strictErr(`summary.overall_grade must be one of ${GRADES.join(', ')}`);
if (!Array.isArray(summary.top_risks) || !summary.top_risks.length) strictErr('summary.top_risks is required');
{
  const open = findings.filter((f) => !['fixed', 'not-reproduced', 'accepted'].includes(f.status));
  const nCrit = open.filter((f) => f.severity === 'Critical').length;
  const nHigh = open.filter((f) => f.severity === 'High').length;
  const g = summary.overall_grade;
  if (oneOf(g, GRADES)) {
    if (nCrit && !['D', 'F'].includes(g)) warn(`grade ${g} looks too high with ${nCrit} Critical finding(s); expected D or F`);
    else if (!nCrit && nHigh >= 3 && !['D', 'F'].includes(g)) warn(`grade ${g} looks too high with ${nHigh} High findings; expected D or F`);
    else if (!nCrit && nHigh && g < 'C') warn(`grade ${g} looks too high with ${nHigh} High finding(s); expected C or lower`);
  }
}
for (const id of [...(summary.fix_first || []).map((x) => x.id), ...(summary.top_risks || []).flatMap((x) => x.ids || [])]) {
  if (id && !byId.has(id)) err(`summary references unknown finding ${id}`);
}

// secrets in any string
{
  const walk = (v, p) => {
    if (typeof v === 'string') {
      for (const [re, label] of SECRET_PATTERNS) if (re.test(v)) err(`Possible unmasked secret (${label}) at ${p}. Mask it before reporting.`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk(data, 'findings.json');
  walk(config, 'report.config.json');
}

// ---------- derive ----------
const rank = (list, v) => { const i = list.indexOf(v); return i < 0 ? list.length : i; };
const unblocks = new Map();
for (const f of findings) for (const b of f.blocked_by || []) unblocks.set(b, [...(unblocks.get(b) || []), f.id]);
for (const f of findings) {
  f.unblocks = unblocks.get(f.id) || [];
  f.quick_win = (f.severity === 'Critical' || f.severity === 'High' || f.impact === 'High') && f.effort === 'S' && (f.fix_risk || 'low') === 'low' && f.status !== 'fixed';
  f.wave = waveOf.has(f.id) ? waveOf.get(f.id).id : null;
}
if (!errors.length) {
  const key = (f) => [
    waveOf.has(f.id) ? waveOf.get(f.id).index : 1e6,
    rank(URG, f.urgency), rank(SEV, f.severity), f.quick_win ? 0 : 1, rank(EFFORT, f.effort), f.id,
  ];
  const cmp = (a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i]) return -1; if (ka[i] > kb[i]) return 1; } return 0; };
  const done = new Set();
  const left = new Set(findings.map((f) => f.id));
  let n = 0;
  while (left.size) {
    const ready = [...left].map((id) => byId.get(id)).filter((f) => (f.blocked_by || []).every((b) => done.has(b) || !byId.has(b)));
    if (!ready.length) break;
    ready.sort(cmp);
    const f = ready[0];
    f.sequence = ++n; done.add(f.id); left.delete(f.id);
  }
}

// ---------- report ----------
const report = (ok) => {
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`${ok ? 'OK' : 'FAILED'}: ${findings.length} findings, ${errors.length} error(s), ${warnings.length} warning(s)${strict ? ' (strict)' : ''}`);
};
if (errors.length) { report(false); process.exit(1); }
if (checkOnly) { report(true); process.exit(0); }

// ---------- render ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const slug = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '_');
const idLink = (id) => (byId.has(id) ? `<a class="idlink" href="#f-${slug(id)}">${esc(id)}</a>` : esc(id));
const idLinks = (ids) => (ids || []).map(idLink).join(' ');
const dimName = (d) => DIMS[d] || d;
const sevPill = (s) => `<span class="pill sev-${s.toLowerCase()}" title="${esc(s)}"><b aria-hidden="true">${SEV_LETTER[s]}</b>${esc(s)}</span>`;
const urgPill = (u) => (u ? `<span class="pill urg" title="${esc(URG_NAME[u])}">${esc(u)} ${esc(URG_NAME[u])}</span>` : '');
const section = (id, title, inner, sub) => `<section id="${id}"><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${inner}</section>`;
const count = (arr, fn) => arr.filter(fn).length;
const open = findings.filter((f) => !['fixed', 'not-reproduced', 'accepted'].includes(f.status));

// previous run diff
let diff = null;
if (config.previous_run) {
  const prevPath = path.resolve(dir, config.previous_run, 'findings.json');
  const prev = readJson(prevPath, false);
  if (prev && Array.isArray(prev.findings)) {
    const pm = new Map(prev.findings.map((f) => [f.id, f]));
    diff = { previous: config.previous_run, new: [], fixed: [], regressed: [], severity_changed: [], unchanged: [] };
    for (const f of findings) {
      const p = pm.get(f.id);
      if (!p) diff.new.push(f.id);
      else if (p.status === 'fixed' && f.status !== 'fixed') diff.regressed.push(f.id);
      else if (p.severity !== f.severity) diff.severity_changed.push({ id: f.id, from: p.severity, to: f.severity });
      else diff.unchanged.push(f.id);
    }
    for (const p of prev.findings) {
      const now = byId.get(p.id);
      if (p.status !== 'fixed' && (!now || now.status === 'fixed')) diff.fixed.push(p.id);
    }
  } else warn(`previous_run not readable: ${prevPath}`);
}
const diffBadge = (id) => {
  if (!diff) return '';
  if (diff.new.includes(id)) return '<span class="pill diff-new">New</span>';
  if (diff.regressed.includes(id)) return '<span class="pill diff-reg">Regressed</span>';
  return '';
};

const grade = summary.overall_grade || '–';
const sevTiles = SEV.map((s) => `<div class="tile sev-${s.toLowerCase()}"><div class="n">${count(open, (f) => f.severity === s)}</div><div class="l">${sevPill(s)}</div></div>`).join('');

let body = '';

// 1. summary
{
  const risks = (summary.top_risks || []).map((r) => `<li>${md(r.text)} ${r.ids && r.ids.length ? `<span class="ids">${idLinks(r.ids)}</span>` : ''}</li>`).join('');
  const week = (summary.do_this_week || []).map((t) => `<li>${md(t)}</li>`).join('');
  const diffLine = diff ? `<p class="diffline"><b>Since ${esc(diff.previous)}:</b> ${diff.fixed.length} fixed · ${diff.new.length} new · ${diff.regressed.length} regressed.</p>` : '';
  body += section('summary', 'Executive summary', `
    <div class="verdict">
      <div class="grade grade-${esc(String(grade).toLowerCase())}" aria-label="Overall grade ${esc(grade)}"><div class="g">${esc(grade)}</div><div class="gl">Overall grade</div></div>
      <div>
        <p class="lead">${md(summary.headline || '')}</p>
        ${summary.grade_note ? `<p class="sub">${md(summary.grade_note)}</p>` : ''}
        ${diffLine}
      </div>
    </div>
    <div class="tiles">${sevTiles}<div class="tile"><div class="n">${open.length}</div><div class="l">Open findings</div></div><div class="tile"><div class="n">${count(open, (f) => f.quick_win)}</div><div class="l">Quick wins</div></div></div>
    <div class="two">
      ${risks ? `<div class="card"><h3>Top risks</h3><ol>${risks}</ol></div>` : ''}
      ${week ? `<div class="card"><h3>Do this week</h3><ul>${week}</ul></div>` : ''}
    </div>`);
}

// 2. fix first
{
  const list = (summary.fix_first && summary.fix_first.length ? summary.fix_first : [...findings].filter((f) => f.status !== 'fixed').sort((a, b) => a.sequence - b.sequence).slice(0, 10).map((f) => ({ id: f.id, reason: '' })));
  const rows = list.map((x, i) => {
    const f = byId.get(x.id); if (!f) return '';
    return `<tr><td class="num">${i + 1}</td><td>${idLink(f.id)}</td><td>${esc(f.title)}</td><td>${sevPill(f.severity)}</td><td>${urgPill(f.urgency)}</td><td>${esc(f.effort || '–')}</td><td class="muted">${md(x.reason || '')}</td></tr>`;
  }).join('');
  if (rows) body += section('fix-first', 'Fix first', `<table><thead><tr><th>#</th><th>ID</th><th>Issue</th><th>Severity</th><th>Urgency</th><th>Effort</th><th>Why now</th></tr></thead><tbody>${rows}</tbody></table>`, 'The best order to start. The full order is in the fix plan and the findings list.');
}

// 3. scorecard
if (scorecard.length) {
  const rows = scorecard.map((s) => {
    const cls = s.score < 2 ? 'bad' : s.score < 3 ? 'warn' : 'good';
    return `<div class="score-row"><div class="name">${esc(dimName(s.dimension))}<span class="why">${md(s.why || '')}</span></div><div class="bar" role="img" aria-label="${esc(dimName(s.dimension))}: ${s.score} out of 5"><span class="${cls}" style="width:${(s.score / 5) * 100}%"></span></div><div class="v">${Number(s.score).toFixed(1)}</div></div>`;
  }).join('');
  body += section('scorecard', 'Scorecard', `<div class="score">${rows}</div>`, '0 = absent or broken · 3 = acceptable · 5 = excellent');
}

// 4. heat map
{
  const withLI = open.filter((f) => f.likelihood && f.impact);
  if (withLI.length) {
    const cell = (imp, lik) => {
      const ids = withLI.filter((f) => f.impact === imp && f.likelihood === lik);
      const sc = LEVEL.indexOf(imp) + LEVEL.indexOf(lik);
      return `<td class="hm hm-${sc}">${ids.map((f) => idLink(f.id)).join(' ')}</td>`;
    };
    const rows = [...LEVEL].reverse().map((imp) => `<tr><th scope="row">${imp}</th>${LEVEL.map((lik) => cell(imp, lik)).join('')}</tr>`).join('');
    body += section('heatmap', 'Risk heat map', `<table class="heat"><thead><tr><th></th>${LEVEL.map((l) => `<th scope="col">${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><p class="sub">Rows: impact. Columns: likelihood. Only findings with both ratings appear.</p>`);
  }
}

// 5. quick wins
{
  const qw = open.filter((f) => f.quick_win).sort((a, b) => a.sequence - b.sequence);
  if (qw.length) body += section('quick-wins', 'Quick wins', `<table><thead><tr><th>ID</th><th>Issue</th><th>Severity</th><th>Urgency</th><th>Fix</th></tr></thead><tbody>${qw.map((f) => `<tr><td>${idLink(f.id)}</td><td>${esc(f.title)}</td><td>${sevPill(f.severity)}</td><td>${urgPill(f.urgency)}</td><td class="muted">${md(f.fix)}</td></tr>`).join('')}</tbody></table>`, 'High impact, small effort, low risk to fix. Do these early.');
}

// 6. waves
if (waves.length) {
  const cards = waves.map((w) => {
    const items = (w.ids || []).map((id) => byId.get(id)).filter(Boolean).sort((a, b) => a.sequence - b.sequence);
    const sevCount = SEV.map((s) => [s, count(items, (f) => f.severity === s)]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(' · ');
    return `<article class="card wave" id="w-${slug(w.id)}">
      <div class="wave-head"><span class="wave-id">${esc(w.id)}</span><h3>${esc(w.name || '')}</h3>${w.track ? `<span class="pill area">${esc(w.track)}</span>` : ''}${w.checkpoint ? '<span class="pill chk">Checkpoint</span>' : ''}</div>
      <p>${md(w.goal || '')}</p>
      <p class="muted"><b>${items.length}</b> findings${sevCount ? ` (${esc(sevCount)})` : ''}${w.effort ? ` · effort ${esc(w.effort)}` : ''}</p>
      ${w.why_order ? `<p class="why-order"><b>Why this order:</b> ${md(w.why_order)}</p>` : ''}
      ${(w.exit_criteria || []).length ? `<h4>Exit criteria</h4><ul>${w.exit_criteria.map((c) => `<li>${md(c)}</li>`).join('')}</ul>` : ''}
      <h4>Findings, in order</h4>
      <ol class="wlist">${items.map((f) => `<li>${idLink(f.id)} ${esc(f.title)} ${sevPill(f.severity)}</li>`).join('')}</ol>
    </article>`;
  }).join('');
  body += section('plan', 'Fix plan', `<div class="waves">${cards}</div>`, 'Waves run in order. A wave ends in a checkpoint when marked. The order is a recommendation based on urgency, dependencies, effort and risk.');
}

// 7. chains
if (chains.length) {
  body += section('chains', 'Attack chains', chains.map((c) => `<article class="card"><h3>${esc(c.id)} · ${esc(c.title || '')}</h3><ol class="steps">${(c.steps || []).map((s) => `<li>${md(s)}</li>`).join('')}</ol><p class="muted">Findings: ${idLinks(c.ids)}</p>${c.break_at ? `<p><b>Cheapest place to break it:</b> ${idLink(c.break_at)}</p>` : ''}</article>`).join(''), 'Combinations of findings that are worse together.');
}

// 8. decisions
if (decisions.length) {
  body += section('decisions', 'Decisions needed', decisions.map((d) => `<article class="card"><h3>${esc(d.id)} · ${md(d.question || '')}</h3>${(d.options || []).length ? `<ul>${d.options.map((o) => `<li>${md(typeof o === 'string' ? o : `${o.label}: ${o.tradeoff || ''}`)}</li>`).join('')}</ul>` : ''}${d.recommended ? `<p><b>Recommended:</b> ${md(d.recommended)}</p>` : ''}<p class="muted">Blocks: ${idLinks(d.blocks) || 'nothing yet'}${d.needed_by ? ` · needed by ${esc(d.needed_by)}` : ''}</p></article>`).join(''), 'Choices that belong to the project owner. The audit does not make them.');
}

// 9. findings explorer
{
  const dims = [...new Set(findings.map((f) => f.dimension))].sort();
  const repos = [...new Set(findings.map((f) => f.repo).filter(Boolean))].sort();
  const sorted = [...findings].sort((a, b) => a.sequence - b.sequence);
  const cards = sorted.map((f) => {
    const hay = [f.id, f.title, f.evidence, f.fix, f.dimension, ...(f.locations || [])].join(' ').toLowerCase();
    return `<article class="f sev-${f.severity.toLowerCase()}" id="f-${slug(f.id)}" data-sev="${esc(f.severity)}" data-urg="${esc(f.urgency || '')}" data-dim="${esc(f.dimension)}" data-repo="${esc(f.repo || '')}" data-seq="${f.sequence}" data-sevrank="${rank(SEV, f.severity)}" data-q="${esc(hay)}">
      <div class="f-head"><span class="f-id">${esc(f.id)}</span><span class="f-title">${esc(f.title)}</span>${diffBadge(f.id)}</div>
      <div class="f-pills">${sevPill(f.severity)}${urgPill(f.urgency)}<span class="pill area">${esc(dimName(f.dimension))}</span>${f.repo ? `<span class="pill area">${esc(f.repo)}</span>` : ''}<span class="pill conf conf-${f.confidence}">${esc(f.confidence)}</span>${f.effort ? `<span class="pill area">Effort ${esc(f.effort)}${f.effort_hours ? ` (~${esc(f.effort_hours)}h)` : ''}</span>` : ''}${f.quick_win ? '<span class="pill qw">Quick win</span>' : ''}${f.fix_risk ? `<span class="pill area">Fix risk ${esc(f.fix_risk)}</span>` : ''}${f.status && f.status !== 'open' ? `<span class="pill area">${esc(f.status)}</span>` : ''}<span class="pill seq" title="Recommended order">#${f.sequence}</span></div>
      <div class="f-body">
        <div><b>Evidence</b><p>${md(f.evidence)}</p>${(f.locations || []).length ? `<p class="locs">${f.locations.map((l) => `<code>${esc(l)}</code>`).join(' ')}</p>` : ''}</div>
        <div><b>Fix</b><p>${md(f.fix)}</p>${f.test ? `<p><b>Proof test:</b> ${md(f.test)}</p>` : ''}</div>
        ${f.impact_text ? `<div><b>Why it matters</b><p>${md(f.impact_text)}</p></div>` : ''}
        ${f.root_cause ? `<div><b>Root cause</b><p>${md(f.root_cause)}</p></div>` : ''}
      </div>
      <div class="f-foot">${f.urgency_reason ? `<span><b>Urgency:</b> ${md(f.urgency_reason)}</span>` : ''}${(f.blocked_by || []).length ? `<span><b>Blocked by:</b> ${idLinks(f.blocked_by)}</span>` : ''}${f.unblocks.length ? `<span><b>Unblocks:</b> ${idLinks(f.unblocks)}</span>` : ''}${f.chain_id ? `<span><b>Chain:</b> ${esc(f.chain_id)}</span>` : ''}${f.wave ? `<span><b>Wave:</b> <a href="#w-${slug(f.wave)}">${esc(f.wave)}</a></span>` : ''}${f.needs_decision ? `<span><b>Needs decision:</b> ${esc(f.decision_id || 'yes')}</span>` : ''}</div>
    </article>`;
  }).join('');
  const chips = SEV.map((s) => `<button type="button" class="chip sev-${s.toLowerCase()}" aria-pressed="true" data-k="${s}"><b aria-hidden="true">${SEV_LETTER[s]}</b>${s}</button>`).join('');
  const opt = (arr, label) => `<option value="">${label}</option>${arr.map((x) => `<option value="${esc(x)}">${esc(label === 'All dimensions' ? dimName(x) : x)}</option>`).join('')}`;
  body += section('findings', 'Findings', `
    <div class="toolbar">
      <div class="chips" id="sevChips">${chips}</div>
      <select id="fUrg" aria-label="Urgency"><option value="">All urgency</option>${URG.map((u) => `<option value="${u}">${u} ${URG_NAME[u]}</option>`).join('')}</select>
      <select id="fDim" aria-label="Dimension">${opt(dims, 'All dimensions')}</select>
      ${repos.length > 1 ? `<select id="fRepo" aria-label="Repository">${opt(repos, 'All repositories')}</select>` : ''}
      <select id="fSort" aria-label="Sort"><option value="seq">Recommended order</option><option value="sev">Severity</option></select>
      <input id="fSearch" type="search" placeholder="Search ID, file or word" aria-label="Search findings">
    </div>
    <p class="sub" id="fCount" aria-live="polite">Showing ${findings.length} of ${findings.length} findings</p>
    <div id="fList">${cards || '<p class="muted">No findings.</p>'}</div>`);
}

// 10. strengths
if ((data.strengths || []).length) {
  body += section('strengths', 'Strengths to keep', `<div class="two">${data.strengths.map((s) => `<div class="card"><h3>${esc(s.title)}</h3><p>${md(s.detail || '')}</p>${(s.locations || []).length ? `<p class="locs">${s.locations.map((l) => `<code>${esc(l)}</code>`).join(' ')}</p>` : ''}</div>`).join('')}</div>`);
}

// 11. coverage
{
  const cv = data.coverage || {};
  if ((cv.reviewed || []).length || (cv.skipped || []).length || cv.gaps) {
    body += section('coverage', 'Coverage and gaps', `
      <div class="two">
        <div class="card"><h3>Reviewed</h3><ul>${(cv.reviewed || []).map((r) => `<li><b>${esc(r.area)}</b>${r.depth ? ` <span class="muted">(${esc(r.depth)})</span>` : ''}</li>`).join('') || '<li class="muted">Not recorded</li>'}</ul></div>
        <div class="card"><h3>Not reviewed</h3><ul>${(cv.skipped || []).map((r) => `<li><b>${esc(r.area)}</b>: ${md(r.reason || '')}</li>`).join('') || '<li class="muted">Nothing skipped</li>'}</ul></div>
      </div>${cv.gaps ? `<p>${md(cv.gaps)}</p>` : ''}`, 'What this audit did and did not look at. Gaps are stated, not hidden.');
  }
}

// 12. tools and baselines
{
  const tools = data.tools || [];
  const bl = data.baselines || {};
  const blRows = Object.entries(bl).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('');
  if (tools.length || blRows) {
    body += section('tools', 'Tools and baselines', `
      ${tools.length ? `<table><thead><tr><th>Tool</th><th>Version</th><th>Purpose</th><th>Result</th></tr></thead><tbody>${tools.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.version || '–')}</td><td>${esc(t.purpose || '')}</td><td>${md(t.result || '')}</td></tr>`).join('')}</tbody></table>` : ''}
      ${blRows ? `<h3>Baselines</h3><table><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody>${blRows}</tbody></table>` : ''}`, 'Numbers come from the tools listed. Nothing here is estimated.');
  }
}

// 13. appendix
body += section('appendix', 'Appendix: how to read this report', `
  <div class="two">
    <div class="card"><h3>Severity (how bad)</h3><ul>
      <li>${sevPill('Critical')} Direct path to serious breach, data loss or outage with little precondition.</li>
      <li>${sevPill('High')} Likely significant incident or a broken core guarantee, with some precondition.</li>
      <li>${sevPill('Medium')} Real weakness with limited reach or unusual conditions.</li>
      <li>${sevPill('Low')} Hardening, polish or small maintainability issue.</li></ul></div>
    <div class="card"><h3>Urgency (how soon)</h3><ul>${URG.map((u) => `<li>${urgPill(u)}</li>`).join('')}</ul>
      <p class="muted">U0 within 24 to 72 hours · U1 this sprint · U2 next 1 to 2 releases · U3 this quarter · U4 backlog.</p></div>
  </div>
  <p><b>Sequence</b> is the recommended order to fix things. It follows urgency first, then dependencies (blocked-by), then quick wins, and puts risky changes last. It is a recommendation, not an instruction.</p>
  <p><b>Confidence:</b> confirmed (traced or reproduced) · likely (strong evidence, not fully traced) · suspected (worth a human look).</p>
  <p><b>Quick win:</b> high impact, small effort, low fix risk.</p>`);

// nav
const NAV = [['summary', 'Summary'], ['fix-first', 'Fix first'], ['scorecard', 'Scorecard'], ['heatmap', 'Heat map'], ['quick-wins', 'Quick wins'], ['plan', 'Fix plan'], ['chains', 'Attack chains'], ['decisions', 'Decisions'], ['findings', 'Findings'], ['strengths', 'Strengths'], ['coverage', 'Coverage'], ['tools', 'Tools'], ['appendix', 'Appendix']]
  .filter(([id]) => body.includes(`<section id="${id}">`));
const navHtml = NAV.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('');

// header
const repos = (config.repos || []).map((r) => `<span><b>${esc(r.name)}</b> ${esc(r.branch || '')} ${r.commit ? `<code>${esc(r.commit)}</code>` : ''}</span>`).join('');
const title = config.title || `${config.project || 'Project'} audit`;
const header = `<header class="top">
  <div class="eyebrow">${esc(config.confidentiality || 'Confidential')} · Audit report</div>
  <h1>${esc(title)}</h1>
  <div class="meta"><span><b>Date</b> ${esc(config.date || '')}</span><span><b>Mode</b> ${esc(config.mode || '')}</span>${config.scope ? `<span><b>Scope</b> ${esc(config.scope)}</span>` : ''}${config.auditor ? `<span><b>Auditor</b> ${esc(config.auditor)}</span>` : ''}${config.kit_version ? `<span><b>Kit</b> ${esc(config.kit_version)}</span>` : ''}${repos}</div>
  <div class="banner" role="note">This report describes weaknesses in a system. Share it only with people who need it. Secret values are masked.</div>
</header>`;

const tpl = fs.readFileSync(path.join(KIT, 'templates', 'report.template.html'), 'utf8');
const html = tpl
  .replace('{{TITLE}}', () => esc(title))
  .replaceAll('{{NAV}}', () => navHtml)
  .replace('{{BODY}}', () => header + body);

// csv
const csvCell = (v) => {
  let s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const COLS = ['sequence', 'id', 'title', 'severity', 'urgency', 'dimension', 'repo', 'confidence', 'effort', 'fix_risk', 'wave', 'blocked_by', 'quick_win', 'status', 'locations', 'evidence', 'fix', 'test'];
const csv = [COLS.join(',')].concat([...findings].sort((a, b) => a.sequence - b.sequence).map((f) => COLS.map((c) => csvCell(f[c])).join(','))).join('\n') + '\n';

fs.writeFileSync(path.join(dir, 'report.html'), html);
fs.writeFileSync(path.join(dir, 'findings.csv'), csv);
fs.writeFileSync(path.join(dir, 'findings.json'), JSON.stringify({ ...data, findings: [...findings].sort((a, b) => a.sequence - b.sequence) }, null, 2) + '\n');
if (diff) fs.writeFileSync(path.join(dir, 'diff-vs-previous.json'), JSON.stringify(diff, null, 2) + '\n');
report(true);
console.error(`Wrote ${path.join(dir, 'report.html')} (${Math.round(html.length / 1024)} KB), findings.csv${diff ? ', diff-vs-previous.json' : ''}`);
