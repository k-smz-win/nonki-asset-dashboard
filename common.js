/* ═════════════════════════════════════════��═════════════════════
   Nonki Asset Management — Common JS v1.0
   FX / Stock / Maintenance ダッシュボード共通スクリプト
   ════════════���═══════════════════════════════��══════════════════ */

"use strict";

/* ─── Theme Management ───────────────────────────────────────── */

const NKM_THEMES = ['dark', 'midnight-blue', 'light'];

function setTheme(name) {
  if (!NKM_THEMES.includes(name)) name = 'dark';
  document.documentElement.setAttribute('data-theme', name);
  try { localStorage.setItem('nkm-theme', name); } catch (_) {}
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === name);
  });
  // Hook for page-specific chart theme updates
  if (typeof onThemeChanged === 'function') {
    try { onThemeChanged(name); } catch (_) {}
  }
}

// Apply saved theme immediately (before DOMContentLoaded to prevent FOUC)
(function() {
  let saved = 'dark';
  try { saved = localStorage.getItem('nkm-theme') || 'dark'; } catch (_) {}
  setTheme(NKM_THEMES.includes(saved) ? saved : 'dark');
})();

/* ─── Status Mapping ──��──────────────────────���───────────────── */

/**
 * Map various status strings to unified status class names.
 * Input: 'ok', 'normal', 'warn', 'warning', 'caution', 'error', 'danger', 'risk_off'
 * Output: 'ok' | 'caution' | 'danger'
 */
function nkmStatus(level) {
  const map = {
    ok: 'ok', normal: 'ok', running: 'ok',
    warn: 'caution', warning: 'caution', caution: 'caution',
    error: 'danger', danger: 'danger', risk_off: 'danger', riskoff: 'danger'
  };
  return map[String(level || '').toLowerCase()] || 'ok';
}

/** Returns CSS class for badge-status element */
function nkmStatusBadgeClass(level) {
  return 'badge-status status-' + nkmStatus(level);
}

/** Returns CSS class for card badge */
function nkmBadgeClass(level) {
  return 'card-badge badge-' + nkmStatus(level);
}

/* ─── Utility Functions ────────────��─────────────────────────── */

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Format number with locale separators */
function fmt(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ja-JP', {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0
  });
}

/** Format as percentage */
function fmtP(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toFixed(decimals != null ? decimals : 1) + '%';
}

/** Returns 'pos', 'neg', or 'neu' based on sign */
function sign(n) {
  if (n == null || isNaN(n) || n === 0) return 'neu';
  return n > 0 ? 'pos' : 'neg';
}

/** Format yen with sign */
function yen(n) {
  if (n == null || isNaN(n)) return '—';
  const v = Math.round(n);
  return (v >= 0 ? '+' : '') + v.toLocaleString('ja-JP') + '円';
}

/** Shorthand for getElementById */
function el(id) { return document.getElementById(id); }

/** Set text content with optional class */
function setText(id, txt, cls) {
  const e = document.getElementById(id);
  if (!e) return;
  e.textContent = txt;
  if (cls !== undefined) e.className = cls;
}

/* ─── Date Helpers (JST) ─────────────────────────���───────────── */

function todayJST() {
  const d = new Date(Date.now() + 9 * 3600000);
  return d.toISOString().slice(0, 10);
}

function tomorrowJST() {
  const d = new Date(Date.now() + (9 + 24) * 3600000);
  return d.toISOString().slice(0, 10);
}

/* ─── Summary Bar ────────��───────────────────────────────────── */

/**
 * Populate the cross-dashboard summary bar.
 * Call from any page's JS after fetching data.
 * items: [{label, value, cls}]
 */
function renderSummaryBar(items) {
  const bar = document.getElementById('nkm-summary-bar');
  if (!bar || !items || !items.length) return;
  bar.innerHTML = items.map(it =>
    `<div class="summary-item">` +
      `<span class="summary-label">${escHtml(it.label)}</span>` +
      `<span class="summary-value ${it.cls || ''}">${escHtml(it.value)}</span>` +
    `</div>`
  ).join('');
  bar.classList.add('visible');
}

/* ─── P11: Status Indicators (CSS-only, no emoji) ────────────── */

/**
 * Returns HTML for a CSS-only status dot indicator.
 * Usage: statusDot('ok') → <span class="nkm-dot nkm-dot-ok"></span>
 */
function statusDot(level) {
  const u = nkmStatus(level);
  return `<span class="nkm-dot nkm-dot-${u}"></span>`;
}

/**
 * Returns HTML for a status label (dot + text).
 */
function statusLabel(level, text) {
  const u = nkmStatus(level);
  return `<span class="nkm-status-label nkm-sl-${u}">${statusDot(level)} ${escHtml(text)}</span>`;
}

/* ─── Data-Driven Strategy Rendering ──────────────────────────── */

/**
 * Dynamically render a strategy section (positions table + KPI cards).
 * Usage:
 *   renderStrategyBlock(containerId, {
 *     id: 'V1', name: 'MA乖離リバウンド',
 *     summary: { total, win_rate, ev, total_pnl, open_count, dd_limit, ... },
 *     positions: [...],
 *     bt_ref: { win_rate: 55.0, ev: 1200 },
 *   });
 */
function renderStrategyBlock(containerId, cfg) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const s = cfg.summary || {};
  const pos = cfg.positions || [];
  const id = cfg.id;
  const hasData = (s.total || 0) > 0 || pos.length > 0;

  if (!hasData) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  // Build KPI row
  const kpiHtml = `
    <div class="section-title" style="margin-top:24px">${escHtml(id)} ${escHtml(cfg.name || '')} サマリー</div>
    <div class="grid-4" style="margin-bottom:16px">
      <div class="card"><h2 style="font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border)">${escHtml(id)} 累計件数 / 勝率</h2>
        <div class="kpi-val" style="font-size:36px;font-weight:800">${s.total || 0} 件</div>
        <div class="kpi-sub ${(s.win_rate||0) >= 55 ? 'pos' : ''}">勝率 ${fmtP(s.win_rate, 1)}</div>
        ${cfg.bt_ref ? '<div class="kpi-sub" style="font-size:14px;color:var(--muted)">BT: ' + fmtP(cfg.bt_ref.win_rate, 1) + '</div>' : ''}
      </div>
      <div class="card"><h2 style="font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border)">${escHtml(id)} EV / 件</h2>
        <div class="kpi-val ${sign(s.ev)}" style="font-size:36px;font-weight:800">${yen(s.ev)}</div>
        ${cfg.bt_ref ? '<div class="kpi-sub" style="font-size:14px;color:var(--muted)">BT: ' + yen(cfg.bt_ref.ev) + '</div>' : ''}
      </div>
      <div class="card"><h2 style="font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border)">${escHtml(id)} 累計 PnL</h2>
        <div class="kpi-val ${sign(s.total_pnl)}" style="font-size:36px;font-weight:800">${yen(s.total_pnl)}</div>
      </div>
      <div class="card"><h2 style="font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--border)">${escHtml(id)} オープン</h2>
        <div class="kpi-val ${(s.open_count||0) > 0 ? 'pos' : 'neu'}" style="font-size:36px;font-weight:800">${s.open_count || 0} 件</div>
      </div>
    </div>`;

  // Build positions table if any
  let posHtml = '';
  if (pos.length > 0) {
    const today = todayJST();
    const tomorrow = tomorrowJST();
    const rows = pos.map(p => {
      const toClass = p.timeout_date === today ? 'to-today' : p.timeout_date === tomorrow ? 'to-tomorrow' : '';
      const rowClass = p.timeout_date === today ? 'row-to-today' : p.timeout_date === tomorrow ? 'row-to-tomorrow' : '';
      return `<tr class="${rowClass}">
        <td><strong>${escHtml(p.symbol)}</strong></td>
        <td>${escHtml(p.signal_date || '')}</td>
        <td class="${toClass}">${escHtml(p.timeout_date || '')}</td>
        <td class="r">${fmt(p.bt_entry_price)}</td>
        <td class="r">${fmt(p.tp_price)}</td>
        <td class="r">${fmt(p.sl_price)}</td>
        <td class="r">${fmt(p.current_price)}</td>
        <td class="r ${sign(p.unrealized_pnl)}">${yen(p.unrealized_pnl)}</td>
        <td class="r">${fmtP(p.sl_distance_pct, 1)}</td>
        <td class="r">${p.holding_days || 0}日</td>
        <td style="white-space:normal;max-width:260px;font-size:14px;color:var(--muted)">${escHtml(p.signal_reason || '')}</td>
      </tr>`;
    }).join('');

    posHtml = `
    <div class="section-title" style="margin-top:24px">${escHtml(id)} 現在ポジション</div>
    <div class="card scroll-x" style="margin-bottom:16px">
      <table class="tbl">
        <thead><tr>
          <th>銘柄</th><th>シグナル日</th><th>TO日</th>
          <th class="r">BT想定entry</th><th class="r">TP</th><th class="r">SL</th>
          <th class="r">現在価格</th><th class="r">含み損益</th>
          <th class="r">SL余裕</th><th class="r">保有日数</th><th>発生理由</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  container.innerHTML = posHtml + kpiHtml;
}

/**
 * Dynamically render a strategy DD meter.
 * containerId: DOM id of the container div
 * stratId: 'M1', 'P1', etc.
 * summary: strategy summary from API
 * globalDdLimit: fallback dd_limit from S7
 * fallbackDiv: divisor for fallback (2 for M1, 3 for P1, etc.)
 */
function renderStrategyDD(containerId, stratId, summary, globalDdLimit, fallbackDiv) {
  const container = document.getElementById(containerId);
  if (!container || !summary) return;
  if (!summary.total || summary.total <= 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  const used   = Math.abs(summary.monthly_dd || 0);
  const limit  = (summary.dd_limit != null) ? summary.dd_limit : Math.round((globalDdLimit || 30000) / (fallbackDiv || 2));
  const remain = limit - used;
  const pct    = Math.min(used / (limit || 1) * 100, 100);
  const fillCls = pct > 70 ? 'dd-fill danger-zone' : pct > 40 ? 'dd-fill warn-zone' : 'dd-fill';
  const valCls  = remain <= 0 ? 'neg' : remain < limit * 0.3 ? 'neg' : 'pos';

  container.innerHTML = `
    <div class="section-title" style="margin-top:16px">${escHtml(stratId)} 月次 DD 残量</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
        <div>
          <span class="kpi-val ${valCls}" style="font-size:30px">${fmt(remain)}</span>
          <span style="color:var(--muted);font-size:15px"> 円 残量</span>
        </div>
        <div style="text-align:right;font-size:14px;color:var(--muted)">
          使用 ${fmt(used)} 円 / 上限 ${fmt(limit)} 円
        </div>
      </div>
      <div class="dd-meter">
        <div class="dd-track"><div class="${fillCls}" style="width:${100 - pct}%"></div></div>
        <div class="dd-label">使用${fmtP(pct)} — 残量${fmtP(100 - pct)}</div>
      </div>
    </div>`;
}

/* ─── P13: Keyboard Shortcuts ────────────────────────────────── */

document.addEventListener('keydown', function(e) {
  // Only fire when not typing in input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  switch (e.key) {
    case '1': window.location.href = '/'; break;              // Strategy Desk
    case '2': window.location.href = '/bt'; break;             // BT Console
    case '3': window.location.href = '/maintenance.html'; break; // 保守
    case 'r': case 'R':
      // Trigger page-specific refresh
      if (typeof fetchData === 'function') fetchData();
      else if (typeof runCheck === 'function') runCheck();
      else if (typeof load === 'function') load();
      break;
    case 't': case 'T':
      // Cycle theme
      {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const idx = NKM_THEMES.indexOf(cur);
        setTheme(NKM_THEMES[(idx + 1) % NKM_THEMES.length]);
      }
      break;
  }
});
