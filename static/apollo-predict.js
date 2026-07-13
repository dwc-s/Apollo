/* apollo-predict.js — client-side Monte-Carlo performance prediction.
 *
 * Reads the JSON payload embedded by predict.html, runs N simulated
 * tournament runs in requestAnimationFrame batches, and updates the
 * Chart.js histogram + stats panel between batches.
 *
 * Distance extrapolation: the server fits a 2D Gaussian in milliradians
 * over historical hit offsets divided by their distance (mrad = mm / m).
 * Sampling at a new distance D' multiplies the sampled mrad offset by D'
 * in metres to get linear mm (1 mrad at 1 m = 1 mm) — i.e. the angular
 * dispersion scales linearly with range.
 *
 * When the server also returns a fitted distance trend (`dist.trend.ok`),
 * the flat fit is replaced per segment: bias is affine in mm
 * (μ_mm = a + b·D'), and the angular covariance grows with range as
 * cov(D') = exp(k·(D'−d_ref))² · cov_ref (the AGB e^(k·d) form). Falls
 * back to the flat angular fit when no trend was fit.
 *
 * Scoring mirrors apollo.py:_classify_shot (line-cutter rule with a
 * default 6 mm shaft when the historical data doesn't specify).
 */
(function () {
  const payloadEl = document.getElementById('predict-payload');
  if (!payloadEl) return;
  const canvas = document.getElementById('predict-histogram');
  if (!canvas || typeof Chart === 'undefined') return;

  let payload;
  try {
    payload = JSON.parse(payloadEl.textContent);
  } catch (e) {
    console.error('predict-payload JSON parse failed', e);
    return;
  }

  const DEFAULT_SHAFT_MM = 6.0;
  // Shaft radius for the line-cutter rule. The server reports the mean real
  // diameter of the fitted shots in `dist.shaft_mm`; we fall back to the
  // default shaft only when none of those shots defined a diameter.
  let SHAFT_RADIUS = DEFAULT_SHAFT_MM / 2.0;

  // Box-Muller. Returns one standard normal per call; we draw two per
  // arrow so the pair-handling overhead isn't worth caching the spare.
  function randn() {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Cholesky of the 2x2 covariance, computed once. Falls back to a
  // diagonal sqrt when the covariance is degenerate (single-distance
  // single-point sample, etc.).
  function cholesky2(cov) {
    const a = cov[0][0];
    const b = cov[0][1];
    const d = cov[1][1];
    const l11 = a > 0 ? Math.sqrt(a) : 0;
    const l21 = l11 > 0 ? b / l11 : 0;
    const inner = d - l21 * l21;
    const l22 = inner > 0 ? Math.sqrt(inner) : 0;
    return { l11, l21, l22 };
  }

  // Score one arrow against a zone list (innermost-out, point_value +
  // radius_mm). Line-cutter rule: subtract the shaft radius from the
  // distance from center; if any part of the shaft touches a ring, the
  // shot scores that ring.
  function scoreShot(xMm, yMm, zones) {
    let d = Math.hypot(xMm, yMm) - SHAFT_RADIUS;
    if (d < 0) d = 0;
    for (let i = 0; i < zones.length; i++) {
      if (d <= zones[i].radius_mm) return zones[i].point_value | 0;
    }
    return 0;
  }

  // -------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------
  const dist = payload.dist;
  const segments = payload.segments;
  const nRuns = payload.n_runs;
  const scoreTarget = payload.score_target;
  const endpointMax = payload.endpoint_max | 0;
  // Published WA / USA Archery reference scores for this round (may be empty).
  const benchmarks = Array.isArray(payload.benchmarks) ? payload.benchmarks : [];

  const shaftMm = Number(dist.shaft_mm);
  if (Number.isFinite(shaftMm) && shaftMm > 0) {
    SHAFT_RADIUS = shaftMm / 2.0;
  }

  const missRate = dist.miss_rate || 0;

  // Per-segment-distance simulation parameters. With a fitted distance
  // trend, bias is affine in mm and the covariance grows as e^(k·d); the
  // Cholesky is recomputed per distance (cached — few distinct distances).
  // Without one, every distance shares the flat fit's mean/covariance.
  const trend = dist.trend && dist.trend.ok ? dist.trend : null;
  const flatChol = cholesky2(dist.cov_mrad);
  const cholCache = new Map();
  function segParams(d) {
    if (!trend) {
      return { muX: dist.mean_mrad[0] * d, muY: dist.mean_mrad[1] * d,
               chol: flatChol };
    }
    let chol = cholCache.get(d);
    if (!chol) {
      const s = Math.exp(trend.growth_k * (d - trend.d_ref));
      const s2 = s * s;
      const c = trend.cov_ref_mrad;
      chol = cholesky2([[c[0][0] * s2, c[0][1] * s2],
                        [c[1][0] * s2, c[1][1] * s2]]);
      cholCache.set(d, chol);
    }
    const m = trend.mean_mm;
    return { muX: m.ax + m.bx * d, muY: m.ay + m.by * d, chol: chol };
  }

  // Histogram bins: derive the bin width from the endpoint max — aim
  // for ~40 bins across the plausible range, but never below 1.
  const binCount = 40;
  const binWidth = Math.max(1, Math.ceil(endpointMax / binCount));
  const bins = new Array(Math.ceil(endpointMax / binWidth) + 1).fill(0);
  function binFor(score) {
    if (score < 0) return 0;
    let idx = Math.floor(score / binWidth);
    if (idx >= bins.length) idx = bins.length - 1;
    return idx;
  }
  const binLabels = bins.map((_, i) => `${i * binWidth}–${(i + 1) * binWidth - 1}`);

  // Dashed vertical markers on the histogram at the P10 / P50 / P90 of the
  // simulated scores, so the spread reads at a glance. The x-axis is a
  // category scale (one slot per bin), so a score maps to a fractional bin
  // position: bin i is centred on score (i+0.5)·binWidth, hence
  // coord = score/binWidth − 0.5 in category units, linearly interpolated to
  // pixels from the first two category centres. Values come from
  // updateStats(), which stashes them on chart.$apolloMarkers each batch.
  const PCT_STYLE = [
    { key: 'p10', label: 'P10', color: '#c0392b' },
    { key: 'p50', label: 'P50', color: '#1a3a5c' },
    { key: 'p90', label: 'P90', color: '#2e7d32' },
  ];
  // Real-world reference styling: USAA 60th-pct MQS in amber, WA Star tiers in
  // purple — solid lines, to read distinctly from the dashed simulated ones.
  const BENCH_COLOR = { mqs: '#b9770e', award: '#7d3c98' };
  const percentileLines = {
    id: 'percentileLines',
    afterDatasetsDraw(chart) {
      const x = chart.scales.x;
      const area = chart.chartArea;
      if (!x || !area) return;
      const px0 = x.getPixelForValue(0);
      const step = x.getPixelForValue(1) - px0;
      if (!isFinite(step) || step === 0) return;
      const ctx = chart.ctx;
      const pixelFor = (score) => Math.max(area.left, Math.min(area.right,
        px0 + (score / binWidth - 0.5) * step));
      // One vertical rule + a short label. `slot` staggers the label so
      // neighbours don't collide; labels anchor to the top or bottom edge.
      function rule(score, color, text, dashed, slot, fromBottom) {
        const px = pixelFor(score);
        ctx.beginPath();
        ctx.moveTo(px, area.top);
        ctx.lineTo(px, area.bottom);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = color;
        ctx.setLineDash(dashed ? [5, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 10px "Quantico", sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        const y = fromBottom ? area.bottom - 5 - slot * 12 : area.top + 11 + slot * 12;
        ctx.fillText(text, px, y);
      }
      ctx.save();
      // Real-world benchmarks (static) along the bottom.
      benchmarks.forEach((b, i) => {
        if (typeof b.score !== 'number') return;
        rule(b.score, BENCH_COLOR[b.kind] || '#555',
             `${b.label}: ${b.score}`, false, i, true);
      });
      // Simulated P10 / P50 / P90 (live) along the top.
      const markers = chart.$apolloMarkers;
      if (markers) {
        PCT_STYLE.forEach((p, i) => {
          const s = markers[p.key];
          if (s === null || s === undefined || Number.isNaN(s)) return;
          rule(s, p.color, `${p.label}: ${Math.round(s)}`, true, i, false);
        });
      }
      ctx.restore();
    },
  };

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [percentileLines],
    data: {
      labels: binLabels,
      datasets: [
        {
          label: 'Model',
          data: bins.slice(),
          backgroundColor: '#4d6da6',
          borderColor: '#1a3a5c',
          borderWidth: 1,
          // grouped:false makes both series share the same x positions
          // (overlaid histograms, not dodged side-by-side bars).
          grouped: false,
        },
        {
          // Fuzzy-calibrated distribution, overlaid as a SECOND histogram once
          // the Fuzzy Factor is applied. Empty + hidden (and legend off) until
          // then, so an uncalibrated run looks exactly as before. The
          // semi-transparent amber fill lets the two histograms read through
          // each other where they overlap.
          label: 'Calibrated',
          data: [],
          backgroundColor: 'rgba(185, 119, 14, 0.55)',
          borderColor: '#b9770e',
          borderWidth: 1,
          grouped: false,
          hidden: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: { display: true, text: 'Total score' },
          ticks: { maxRotation: 60, minRotation: 60, autoSkip: true },
        },
        y: {
          title: { display: true, text: 'Runs in bin' },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${payload.endpoint_label} — Monte Carlo (${nRuns} runs)`,
        },
      },
    },
  });

  const scores = [];        // raw per-run totals
  // Fuzzy-calibrated copies, filled once at finalize when the FF applies. Kept
  // separate so the raw and calibrated distributions can be charted together.
  let calScores = null;
  let calBins = null;
  const progressEl = document.getElementById('run-progress');
  const statEls = {};
  document.querySelectorAll('#stats-grid [data-stat]').forEach(el => {
    statEls[el.dataset.stat] = el;
  });

  function fmt(v, digits = 1) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    return Number(v).toFixed(digits);
  }

  function updateStats() {
    // Report the calibrated distribution once it exists, else the raw one.
    const data = calScores || scores;
    const n = data.length;
    statEls.n.textContent = String(n);
    if (n === 0) return;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let hitsTarget = 0;
    for (let i = 0; i < n; i++) {
      const s = data[i];
      sum += s;
      if (s < min) min = s;
      if (s > max) max = s;
      if (scoreTarget !== null && scoreTarget !== undefined && s >= scoreTarget) {
        hitsTarget++;
      }
    }
    const mean = sum / n;
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += (data[i] - mean) ** 2;
    const std = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;
    const sorted = data.slice().sort((a, b) => a - b);
    const pct = (p) => {
      const k = (sorted.length - 1) * p;
      const lo = Math.floor(k);
      const hi = Math.ceil(k);
      if (lo === hi) return sorted[lo];
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo);
    };
    statEls.mean.textContent = fmt(mean);
    statEls.median.textContent = fmt(pct(0.5));
    statEls.std.textContent = fmt(std);
    const p10 = pct(0.10), p50 = pct(0.50), p90 = pct(0.90);
    statEls.p10.textContent = fmt(p10);
    statEls.p50.textContent = fmt(p50);
    statEls.p90.textContent = fmt(p90);
    // Hand the percentile score positions to the histogram marker plugin.
    chart.$apolloMarkers = { p10, p50, p90 };
    statEls.min.textContent = String(min);
    statEls.max.textContent = String(max);
    if (statEls.p_target) {
      statEls.p_target.textContent = `${(hitsTarget / n * 100).toFixed(1)}%`;
    }
  }

  function updateChart() {
    chart.data.datasets[0].data = bins.slice();
    if (calBins) {
      chart.data.datasets[1].data = calBins.slice();
      chart.data.datasets[1].hidden = false;
    }
    chart.update('none');
  }

  // One simulated tournament run. Sums score across all segments.
  function runOnce() {
    let total = 0;
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const distMmPerMrad = seg.distance_m; // (1 mrad at 1 m = 1 mm)
      const p = segParams(seg.distance_m);
      const chol = p.chol;
      const shots = seg.ends * seg.arrows_per_end;
      for (let a = 0; a < shots; a++) {
        if (missRate > 0 && Math.random() < missRate) continue;
        const z1 = randn();
        const z2 = randn();
        // Cholesky-correlated 2D Gaussian in mrad, scaled to mm at this
        // segment's distance; mean offset is already in mm.
        const ex = chol.l11 * z1;
        const ey = chol.l21 * z1 + chol.l22 * z2;
        const xMm = p.muX + ex * distMmPerMrad;
        const yMm = p.muY + ey * distMmPerMrad;
        total += scoreShot(xMm, yMm, seg.zones);
      }
    }
    return total;
  }

  // -------------------------------------------------------------------
  // Fuzzy Factor calibration (set up once; the calibrated histogram then
  // builds in real time, in lockstep with the raw one).
  // -------------------------------------------------------------------
  // The server computes ONE archer-level coefficient from all their scored
  // history (real scored points ÷ what the fitted model predicts), already
  // shrunk toward 1.0 and clamped. Being scale-free it applies at any
  // face/distance, so every simulated run total is multiplied by it (then
  // clamped to [0, endpoint max]) AS the run happens. A zero/absent `fuzzy`
  // payload = no calibration.
  const fuzzy = payload.fuzzy || { enabled: false };
  const fuzzyNote = document.getElementById('fuzzy-note');
  function showFuzzyNote(text, unavailable) {
    if (!fuzzyNote) return;
    fuzzyNote.textContent = text;
    fuzzyNote.classList.toggle('unavailable', !!unavailable);
    fuzzyNote.hidden = false;
  }
  // Set once when the FF is active; drives the per-run calibration in step().
  let ffValue = null;
  function setupFuzzy() {
    if (!fuzzy || !fuzzy.enabled) return;
    if (fuzzy.unavailable) {
      showFuzzyNote(fuzzy.reason || 'Fuzzy factor unavailable.', true);
      return;
    }
    const ff = Number(fuzzy.ff);
    const n = Number(fuzzy.n_obs) || 0;
    if (!Number.isFinite(ff) || ff <= 0) return;
    ffValue = ff;
    // Start the calibrated distribution empty; it fills alongside the raw one
    // in step(). Reveal the overlay + legend up front so both histograms
    // animate together.
    calScores = [];
    calBins = new Array(bins.length).fill(0);
    chart.data.datasets[1].label = `Calibrated (Fuzzy factor ${ff.toFixed(2)})`;
    chart.data.datasets[1].hidden = false;
    chart.data.datasets[0].backgroundColor = 'rgba(77, 109, 166, 0.6)';
    chart.options.plugins.legend.display = true;
    const pct = Math.round(ff * 100);
    showFuzzyNote(
      `Fuzzy factor ${ff.toFixed(2)} · learned from ${n} scored ` +
      `session${n === 1 ? '' : 's'} — you shoot about ${pct}% of the ` +
      `pure-trig projection, so the whole forecast is scaled to match.`,
      false);
  }
  // Calibrated run total from a raw one: multiply by FF, clamp to [0, max].
  function calibrate(total) {
    let cs = Math.round(total * ffValue);
    if (cs < 0) cs = 0;
    if (endpointMax > 0 && cs > endpointMax) cs = endpointMax;
    return cs;
  }

  // -------------------------------------------------------------------
  // Drive the simulation in requestAnimationFrame batches.
  // -------------------------------------------------------------------
  // Larger batches when n_runs is high; we still aim for ~10 frames of
  // visible animation across the full sim.
  const batchSize = Math.max(1, Math.min(50, Math.ceil(nRuns / 60)));
  let doneRuns = 0;

  function step() {
    const start = performance.now();
    const target = Math.min(nRuns, doneRuns + batchSize);
    while (doneRuns < target) {
      const s = runOnce();
      scores.push(s);
      bins[binFor(s)]++;
      // When the FF is active, calibrate this run immediately so the
      // calibrated histogram fills in real time alongside the raw one.
      if (ffValue !== null) {
        const cs = calibrate(s);
        calScores.push(cs);
        calBins[binFor(cs)]++;
      }
      doneRuns++;
      // Safety: cap each frame at ~16 ms even if batchSize was too generous.
      if (performance.now() - start > 16) break;
    }
    // Stats first so the marker plugin sees the latest percentiles when the
    // chart redraws. updateStats reads the calibrated scores when active.
    updateStats();
    updateChart();
    if (progressEl) {
      progressEl.textContent = doneRuns < nRuns
        ? `Running… ${doneRuns} / ${nRuns}`
        : `Done — ${nRuns} runs simulated.`;
    }
    if (doneRuns < nRuns) {
      requestAnimationFrame(step);
    }
  }

  setupFuzzy();
  requestAnimationFrame(step);
})();
