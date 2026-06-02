/* apollo-predict.js — client-side Monte-Carlo performance prediction.
 *
 * Reads the JSON payload embedded by predict.html, runs N simulated
 * tournament runs in requestAnimationFrame batches, and updates the
 * Chart.js histogram + stats panel between batches.
 *
 * Distance extrapolation: the server fits a 2D Gaussian in milliradians
 * over historical hit offsets divided by their distance. Sampling at a
 * new distance D' multiplies the sampled mrad offset by D' * 1000 to
 * get linear mm — i.e. the angular dispersion scales linearly with range.
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
  const SHAFT_RADIUS = DEFAULT_SHAFT_MM / 2.0;

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

  const chol = cholesky2(dist.cov_mrad);
  const meanMrad = dist.mean_mrad;
  const missRate = dist.miss_rate || 0;

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

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [{
        label: 'Runs',
        data: bins.slice(),
        backgroundColor: '#4d6da6',
        borderColor: '#1a3a5c',
        borderWidth: 1,
      }],
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

  const scores = [];
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
    const n = scores.length;
    statEls.n.textContent = String(n);
    if (n === 0) return;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let hitsTarget = 0;
    for (let i = 0; i < n; i++) {
      const s = scores[i];
      sum += s;
      if (s < min) min = s;
      if (s > max) max = s;
      if (scoreTarget !== null && scoreTarget !== undefined && s >= scoreTarget) {
        hitsTarget++;
      }
    }
    const mean = sum / n;
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += (scores[i] - mean) ** 2;
    const std = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;
    const sorted = scores.slice().sort((a, b) => a - b);
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
    statEls.p10.textContent = fmt(pct(0.10));
    statEls.p50.textContent = fmt(pct(0.50));
    statEls.p90.textContent = fmt(pct(0.90));
    statEls.min.textContent = String(min);
    statEls.max.textContent = String(max);
    if (statEls.p_target) {
      statEls.p_target.textContent = `${(hitsTarget / n * 100).toFixed(1)}%`;
    }
  }

  function updateChart() {
    chart.data.datasets[0].data = bins.slice();
    chart.update('none');
  }

  // One simulated tournament run. Sums score across all segments.
  function runOnce() {
    let total = 0;
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const distMmPerMrad = seg.distance_m; // (1 mrad at 1 m = 1 mm)
      const muX = meanMrad[0] * distMmPerMrad;
      const muY = meanMrad[1] * distMmPerMrad;
      const shots = seg.ends * seg.arrows_per_end;
      for (let a = 0; a < shots; a++) {
        if (missRate > 0 && Math.random() < missRate) continue;
        const z1 = randn();
        const z2 = randn();
        // Cholesky-correlated 2D Gaussian in mrad, scaled to mm at this
        // segment's distance.
        const ex = chol.l11 * z1;
        const ey = chol.l21 * z1 + chol.l22 * z2;
        const xMm = muX + ex * distMmPerMrad;
        const yMm = muY + ey * distMmPerMrad;
        total += scoreShot(xMm, yMm, seg.zones);
      }
    }
    return total;
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
      doneRuns++;
      // Safety: cap each frame at ~16 ms even if batchSize was too generous.
      if (performance.now() - start > 16) break;
    }
    updateChart();
    updateStats();
    if (progressEl) {
      progressEl.textContent = doneRuns < nRuns
        ? `Running… ${doneRuns} / ${nRuns}`
        : `Done — ${nRuns} runs simulated.`;
    }
    if (doneRuns < nRuns) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
})();
