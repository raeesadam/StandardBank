import { el, svg, clear, fmtNumber } from './util.js';

/* Series colours are read from the stylesheet so the charts follow the
 * light/dark token swap instead of hard-coding hex values. */
const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const seriesColor = (slot) => token(`--series-${slot}`) || '#2a78d6';

/** Re-renders on width change so axis labels stay at a readable size
 *  instead of being scaled by the viewBox. */
function responsive(render, { minHeight = 220 } = {}) {
  const host = el('div', { class: 'chart' });
  let lastWidth = 0;

  const draw = () => {
    const width = Math.max(260, Math.round(host.clientWidth || host.parentElement?.clientWidth || 640));
    if (width === lastWidth) return;
    lastWidth = width;
    clear(host);
    host.appendChild(render(width));
  };

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => draw()).observe(host);
  } else {
    window.addEventListener('resize', draw);
  }
  queueMicrotask(draw);
  host.style.minHeight = `${minHeight}px`;
  return host;
}

/* Real text measurement, so labels are truncated to what actually fits
 * rather than to a guessed character count. */
let measureCtx = null;
function textWidth(text, font = '12px system-ui, -apple-system, "Segoe UI", sans-serif') {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(String(text)).width;
}

function fitText(text, maxWidth, font) {
  const str = String(text ?? '');
  if (textWidth(str, font) <= maxWidth) return str;
  let lo = 0;
  let hi = str.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(`${str.slice(0, mid)}…`, font) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo <= 0 ? '…' : `${str.slice(0, lo)}…`;
}

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const step of steps) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

function tooltipLayer(host) {
  const node = el('div', { class: 'chart__tooltip', role: 'tooltip' });
  host.appendChild(node);
  return {
    node,
    show(x, y, title, rows) {
      clear(node);
      node.appendChild(el('div', { class: 'tt-title', text: title }));
      for (const row of rows) {
        node.appendChild(el('div', { class: 'tt-row' }, [
          el('span', { class: 'tt-name' }, [
            row.color ? el('span', {
              class: 'legend-key', style: { background: row.color },
            }) : null,
            el('span', { text: row.name }),
          ]),
          el('span', { class: 'tt-value', text: row.value }),
        ]));
      }
      node.dataset.visible = 'true';
      const width = node.offsetWidth;
      const clampedX = Math.min(Math.max(x, width / 2 + 4), host.clientWidth - width / 2 - 4);
      node.style.left = `${clampedX}px`;
      node.style.top = `${Math.max(y - 10, 30)}px`;
    },
    hide() { node.dataset.visible = 'false'; },
  };
}

function legend(series) {
  if (series.length < 2) return null;
  return el('div', { class: 'chart__legend' }, series.map((s) => el('span', {}, [
    el('span', {
      class: `legend-key${s.shape === 'rect' ? ' legend-key--rect' : ''}`,
      style: { background: s.color },
    }),
    el('span', { text: s.name }),
  ])));
}

/** Every chart ships a table view - the fallback that keeps values reachable
 *  without hover, and the relief for lighter series colours. */
function tableToggle(columns, rows) {
  const wrap = el('div', { class: 'chart__table', hidden: true });
  const button = el('button', {
    class: 'btn btn--ghost btn--sm', type: 'button', 'aria-expanded': 'false',
    onclick: () => {
      const showing = wrap.hidden;
      wrap.hidden = !showing;
      button.textContent = showing ? 'Hide table' : 'Show table';
      button.setAttribute('aria-expanded', String(showing));
      if (showing && wrap.childElementCount === 0) wrap.appendChild(buildTable(columns, rows()));
    },
  }, 'Show table');
  return { toggle: el('div', { class: 'chart__toggle' }, [button]), wrap };
}

function buildTable(columns, rows) {
  return el('div', { class: 'table-wrap' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, columns.map((c) =>
        el('th', { class: c.numeric ? 'num' : '', text: c.label })))]),
      el('tbody', {}, rows.map((row) => el('tr', {}, columns.map((c) =>
        el('td', { class: c.numeric ? 'num' : '', text: String(row[c.key] ?? '') }))))),
    ]),
  ]);
}

/* ------------------------------- line chart ---------------------------- */

/**
 * points: [{ label, values: { key: number } }]
 * series: [{ key, name, color }]
 */
export function lineChart({
  points, series, height = 250, formatValue = fmtNumber, yLabel = '',
  emphasiseLast = true,
}) {
  if (!points || points.length === 0) {
    return el('div', { class: 'empty', text: 'No monitoring data captured yet.' });
  }

  const tableColumns = [
    { key: 'label', label: 'Period' },
    ...series.map((s) => ({ key: s.key, label: s.name, numeric: true })),
  ];
  const tableRows = () => points.map((p) => ({
    label: p.label,
    ...Object.fromEntries(series.map((s) => [s.key, formatValue(p.values[s.key] ?? 0)])),
  }));
  const { toggle, wrap } = tableToggle(tableColumns, tableRows);

  const chartHost = responsive((width) => {
    const marginTop = 14;
    const marginRight = emphasiseLast ? 54 : 18;
    const marginBottom = 30;
    const marginLeft = 46;
    const plotW = width - marginLeft - marginRight;
    const plotH = height - marginTop - marginBottom;

    const maxValue = niceMax(Math.max(
      1, ...points.flatMap((p) => series.map((s) => Number(p.values[s.key]) || 0))
    ));
    const xAt = (i) => marginLeft + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
    const yAt = (v) => marginTop + plotH - (plotH * (Number(v) || 0)) / maxValue;

    const children = [];

    // Gridlines + y ticks (solid hairlines, one step off the surface).
    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const value = (maxValue / ticks) * i;
      const y = yAt(value);
      children.push(svg('line', {
        x1: marginLeft, x2: marginLeft + plotW, y1: y, y2: y,
        stroke: i === 0 ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1,
      }));
      children.push(svg('text', {
        x: marginLeft - 8, y: y + 4, 'text-anchor': 'end',
        fill: 'var(--muted)', 'font-size': 11, text: fmtNumber(value),
      }));
    }

    // X labels, thinned to what fits. Candidates are walked left to right and
    // dropped on collision; the final period always wins its slot, because it
    // is the one the reader is looking for.
    const labelFont = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
    const lastIdx = points.length - 1;
    const step = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 62))));
    const candidates = [];
    for (let i = 0; i < points.length; i += step) candidates.push(i);
    if (candidates.at(-1) !== lastIdx) candidates.push(lastIdx);

    const kept = [];
    for (const index of candidates) {
      const half = textWidth(points[index].label, labelFont) / 2;
      const left = xAt(index) - half;
      const previous = kept.at(-1);
      if (previous && left < previous.right + 8) {
        // The last period outranks whatever sits next to it.
        if (index === lastIdx) kept.pop();
        else continue;
      }
      kept.push({ index, right: xAt(index) + half });
    }

    for (const { index } of kept) {
      children.push(svg('text', {
        x: xAt(index), y: marginTop + plotH + 18, 'text-anchor': 'middle',
        fill: 'var(--muted)', 'font-size': 11, text: points[index].label,
      }));
    }

    if (yLabel) {
      children.push(svg('text', {
        x: marginLeft, y: 8, 'text-anchor': 'start',
        fill: 'var(--muted)', 'font-size': 11, text: yLabel,
      }));
    }

    // One area wash under a single-series chart; lines for everything.
    if (series.length === 1) {
      const s = series[0];
      const area = [
        `M ${xAt(0)} ${marginTop + plotH}`,
        ...points.map((p, i) => `L ${xAt(i)} ${yAt(p.values[s.key])}`),
        `L ${xAt(points.length - 1)} ${marginTop + plotH} Z`,
      ].join(' ');
      children.push(svg('path', { d: area, fill: s.color, 'fill-opacity': 0.10, stroke: 'none' }));
    }

    for (const s of series) {
      const d = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.values[s.key])}`).join(' ');
      children.push(svg('path', {
        d, fill: 'none', stroke: s.color, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    }

    // End marker + direct label on the last point: the value the reader
    // most often wants, without labelling every point.
    if (emphasiseLast) {
      const lastIndex = points.length - 1;
      series.forEach((s) => {
        const y = yAt(points[lastIndex].values[s.key]);
        children.push(svg('circle', {
          cx: xAt(lastIndex), cy: y, r: 4,
          fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2,
        }));
        children.push(svg('text', {
          x: xAt(lastIndex) + 10, y: y + 4, 'text-anchor': 'start',
          fill: 'var(--ink)', 'font-size': 12, 'font-weight': 600,
          text: formatValue(points[lastIndex].values[s.key]),
        }));
      });
    }

    const crosshair = svg('line', {
      y1: marginTop, y2: marginTop + plotH, stroke: 'var(--axis)',
      'stroke-width': 1, opacity: 0,
    });
    children.push(crosshair);

    const hit = svg('rect', {
      x: marginLeft, y: marginTop, width: Math.max(plotW, 1), height: plotH,
      fill: 'transparent', style: 'cursor: crosshair',
    });
    children.push(hit);

    const node = svg('svg', {
      width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
      'aria-label': `Line chart: ${series.map((s) => s.name).join(' and ')} by period`,
      tabindex: 0,
    }, children);

    const host = node.closest?.('.chart');
    const tip = tooltipLayer(chartHost);

    let activeIndex = null;
    const focusIndex = (index) => {
      if (index === null || index < 0 || index >= points.length) return;
      activeIndex = index;
      const x = xAt(index);
      crosshair.setAttribute('x1', x);
      crosshair.setAttribute('x2', x);
      crosshair.setAttribute('opacity', 1);
      const topY = Math.min(...series.map((s) => yAt(points[index].values[s.key])));
      tip.show(x, topY, points[index].label, series.map((s) => ({
        name: s.name, color: s.color, value: formatValue(points[index].values[s.key] ?? 0),
      })));
    };
    const blur = () => {
      activeIndex = null;
      crosshair.setAttribute('opacity', 0);
      tip.hide();
    };

    const indexFromEvent = (event) => {
      const rect = node.getBoundingClientRect();
      const scale = rect.width / width;
      const x = (event.clientX - rect.left) / scale;
      const ratio = (x - marginLeft) / (plotW || 1);
      return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
    };

    hit.addEventListener('pointermove', (event) => focusIndex(indexFromEvent(event)));
    hit.addEventListener('pointerleave', blur);
    node.addEventListener('focus', () => focusIndex(points.length - 1));
    node.addEventListener('blur', blur);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); focusIndex((activeIndex ?? points.length - 1) + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); focusIndex((activeIndex ?? points.length - 1) - 1); }
      if (event.key === 'Escape') blur();
    });

    void host;
    return node;
  }, { minHeight: height });

  return el('div', {}, [legend(series), chartHost, toggle, wrap]);
}

/* -------------------------------- bar chart ---------------------------- */

/**
 * Horizontal bars for magnitude comparison. One series, one colour - bar
 * length already encodes the value, so hue carries nothing extra.
 * rows: [{ label, value, sublabel, onClick }]
 */
export function barChart({
  rows, formatValue = fmtNumber, color = seriesColor(1), labelWidth = 200,
  valueLabel = 'Value', barHeight = 20, gap = 10,
}) {
  if (!rows || rows.length === 0) {
    return el('div', { class: 'empty', text: 'Nothing to show yet.' });
  }

  const { toggle, wrap } = tableToggle(
    [{ key: 'label', label: 'Item' }, { key: 'value', label: valueLabel, numeric: true }],
    () => rows.map((r) => ({ label: r.label, value: formatValue(r.value) })),
  );

  const height = rows.length * (barHeight + gap) + 8;

  const chartHost = responsive((width) => {
    const gutter = 12;               // clear air between the label and the bar
    const labelW = Math.min(labelWidth, Math.max(96, Math.round(width * 0.36)));
    const barX = labelW + gutter;
    const valueW = Math.max(44, textWidth(formatValue(Math.max(
      ...rows.map((r) => Number(r.value) || 0))), '600 12px system-ui, sans-serif') + 16);
    const plotW = Math.max(40, width - barX - valueW);
    const maxValue = Math.max(1, ...rows.map((r) => Number(r.value) || 0));

    const children = [];
    rows.forEach((row, index) => {
      const y = index * (barHeight + gap) + 4;
      const value = Number(row.value) || 0;
      const barW = Math.max(2, (plotW * value) / maxValue);

      children.push(svg('text', {
        x: 0, y: y + barHeight / 2 + 4, fill: 'var(--ink-2)', 'font-size': 12,
        text: fitText(row.label, labelW),
      }, [svg('title', { text: row.label })]));

      children.push(svg('path', {
        d: roundedRightBar(barX, y, barW, barHeight, 4),
        fill: color, 'fill-opacity': 0.9,
      }));

      children.push(svg('text', {
        x: barX + barW + 8, y: y + barHeight / 2 + 4,
        fill: 'var(--ink)', 'font-size': 12, 'font-weight': 600,
        'font-variant-numeric': 'tabular-nums', text: formatValue(value),
      }));

      const hit = svg('rect', {
        x: 0, y: y - gap / 2, width: Math.max(width, 1), height: barHeight + gap,
        fill: 'transparent', style: row.onClick ? 'cursor: pointer' : 'cursor: default',
        tabindex: 0, role: row.onClick ? 'button' : 'img',
        'aria-label': `${row.label}: ${formatValue(value)}`,
      });
      const showTip = () => tip.show(
        barX + barW / 2, y, row.label,
        [{ name: row.sublabel || valueLabel, value: formatValue(value), color }],
      );
      hit.addEventListener('pointerenter', showTip);
      hit.addEventListener('focus', showTip);
      hit.addEventListener('pointerleave', () => tip.hide());
      hit.addEventListener('blur', () => tip.hide());
      if (row.onClick) {
        hit.addEventListener('click', row.onClick);
        hit.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.onClick(); }
        });
      }
      children.push(hit);
    });

    const node = svg('svg', {
      width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
      'aria-label': `Bar chart of ${valueLabel.toLowerCase()} by item`,
    }, children);

    const tip = tooltipLayer(chartHost);
    return node;
  }, { minHeight: height });

  return el('div', {}, [chartHost, toggle, wrap]);
}

function roundedRightBar(x, y, width, height, radius) {
  const r = Math.min(radius, width, height / 2);
  return [
    `M ${x} ${y}`,
    `H ${x + width - r}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x}`,
    'Z',
  ].join(' ');
}

/* ------------------------- distribution (no chart) --------------------- */

/** Counts across a handful of named classes read better as labelled rows
 *  with a share meter than as a pie or a many-hued bar chart. */
export function distribution(items, { onSelect, formatValue = fmtNumber } = {}) {
  const total = items.reduce((acc, item) => acc + (Number(item.count) || 0), 0) || 1;
  return el('div', { class: 'dist' }, items.map((item) => {
    const share = ((Number(item.count) || 0) / total) * 100;
    const row = el('div', { class: 'dist__row' }, [
      el('div', { class: 'dist__label', text: item.label }),
      el('div', { class: 'dist__count', text: formatValue(item.count) }),
      el('div', { class: 'dist__meter' }, [
        el('div', { class: 'meter' }, [
          el('div', { class: 'meter__fill', style: { width: `${Math.max(share, 1.5)}%` } }),
        ]),
      ]),
    ]);
    if (onSelect) {
      row.style.cursor = 'pointer';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.addEventListener('click', () => onSelect(item));
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') onSelect(item);
      });
    }
    return row;
  }));
}

/** Sparkline for a stat tile - no axes, no labels, just the shape. */
export function sparkline(values, { width = 132, height = 34, color = seriesColor(1) } = {}) {
  if (!values || values.length < 2) return el('span');
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const x = (i) => (width * i) / (values.length - 1);
  const y = (v) => height - 3 - ((height - 6) * (v - min)) / range;
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  return svg('svg', {
    width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true',
    style: 'display:block',
  }, [
    svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    svg('circle', { cx: x(values.length - 1), cy: y(values.at(-1)), r: 3.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }),
  ]);
}
