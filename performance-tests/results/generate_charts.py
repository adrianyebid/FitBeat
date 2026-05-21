import json
import os
import sys
from datetime import datetime

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import numpy as np
except ImportError:
    print("Installing matplotlib...")
    os.system("pip install matplotlib numpy -q")
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    import numpy as np

RESULTS_DIR = "/results"

# ─────────────────────────────────────────────────────────────
# Parse k6 JSON output
# ─────────────────────────────────────────────────────────────
def parse_k6_json(filename):
    durations = []
    vus_over_time = []
    failed = 0
    total = 0
    t0 = None

    with open(filename) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            metric = obj.get("metric", "")
            data = obj.get("data", {})
            ts_str = data.get("time", "")

            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if t0 is None:
                    t0 = ts
                elapsed = (ts - t0).total_seconds()
            except Exception:
                elapsed = 0

            if metric == "http_req_duration" and obj.get("type") == "Point":
                durations.append((elapsed, data.get("value", 0)))

            if metric == "vus" and obj.get("type") == "Point":
                vus_over_time.append((elapsed, data.get("value", 0)))

            if metric == "http_req_failed" and obj.get("type") == "Point":
                total += 1
                if data.get("value", 0) == 1:
                    failed += 1

    return durations, vus_over_time, failed, total


# ─────────────────────────────────────────────────────────────
# Summary stats from raw durations list
# ─────────────────────────────────────────────────────────────
def stats(values):
    if not values:
        return {}
    arr = np.array(values)
    return {
        "avg": float(np.mean(arr)),
        "min": float(np.min(arr)),
        "med": float(np.median(arr)),
        "max": float(np.max(arr)),
        "p90": float(np.percentile(arr, 90)),
        "p95": float(np.percentile(arr, 95)),
    }


# ─────────────────────────────────────────────────────────────
# CHART 1 — Bar chart comparing 3 cases
# ─────────────────────────────────────────────────────────────
def chart_comparison(results):
    labels = []
    avgs, p90s, p95s = [], [], []

    for name, (durations, _, failed, total) in results.items():
        vals = [d for _, d in durations]
        s = stats(vals)
        labels.append(name)
        avgs.append(s.get("avg", 0))
        p90s.append(s.get("p90", 0))
        p95s.append(s.get("p95", 0))

    x = np.arange(len(labels))
    width = 0.25

    fig, ax = plt.subplots(figsize=(10, 6))
    bars1 = ax.bar(x - width, avgs, width, label='avg', color='#4CAF50', alpha=0.85)
    bars2 = ax.bar(x,         p90s, width, label='p(90)', color='#2196F3', alpha=0.85)
    bars3 = ax.bar(x + width, p95s, width, label='p(95)', color='#F44336', alpha=0.85)

    ax.set_xlabel('Escenario', fontsize=12)
    ax.set_ylabel('Latencia (ms)', fontsize=12)
    ax.set_title('FitBeat — POST /api/auth/login\nComparación de latencia por escenario', fontsize=13, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=11)
    ax.legend(fontsize=11)
    ax.yaxis.grid(True, alpha=0.3)
    ax.set_axisbelow(True)

    for bar in bars1:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 3,
                f'{bar.get_height():.0f}ms', ha='center', va='bottom', fontsize=9)
    for bar in bars2:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 3,
                f'{bar.get_height():.0f}ms', ha='center', va='bottom', fontsize=9)
    for bar in bars3:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 3,
                f'{bar.get_height():.0f}ms', ha='center', va='bottom', fontsize=9)

    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "chart_comparison.png")
    plt.savefig(out, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")


# ─────────────────────────────────────────────────────────────
# CHART 2 — Stress test: latency + VUs over time (dual axis)
# ─────────────────────────────────────────────────────────────
def chart_stress_timeline(durations, vus_over_time):
    if not durations:
        print("No data for stress timeline chart")
        return

    # Bucket durations into 5-second windows
    bucket_size = 5
    max_t = max(t for t, _ in durations)
    buckets = {}
    for t, d in durations:
        b = int(t // bucket_size) * bucket_size
        buckets.setdefault(b, []).append(d)

    times = sorted(buckets.keys())
    avgs  = [np.mean(buckets[b]) for b in times]
    p95s  = [np.percentile(buckets[b], 95) for b in times]

    # VU timeline (smoothed)
    vu_times = [t for t, _ in vus_over_time]
    vu_vals  = [v for _, v in vus_over_time]

    fig, ax1 = plt.subplots(figsize=(14, 6))

    color_avg = '#2196F3'
    color_p95 = '#F44336'
    color_vu  = '#FF9800'

    ax1.set_xlabel('Tiempo (segundos)', fontsize=12)
    ax1.set_ylabel('Latencia (ms)', fontsize=12)
    ax1.plot(times, avgs, color=color_avg, linewidth=2, label='avg latencia', marker='o', markersize=3)
    ax1.plot(times, p95s, color=color_p95, linewidth=2, label='p(95) latencia', linestyle='--', marker='s', markersize=3)
    ax1.tick_params(axis='y')
    ax1.yaxis.grid(True, alpha=0.2)
    ax1.set_axisbelow(True)

    ax2 = ax1.twinx()
    ax2.set_ylabel('Usuarios virtuales (VUs)', fontsize=12, color=color_vu)
    ax2.fill_between(vu_times, vu_vals, alpha=0.15, color=color_vu)
    ax2.plot(vu_times, vu_vals, color=color_vu, linewidth=1.5, label='VUs activos')
    ax2.tick_params(axis='y', labelcolor=color_vu)

    # Stage labels
    stage_times = [0, 30, 60, 90, 120, 150, 180]
    stage_vus   = [1, 50, 200, 500, 2000, 0]
    for i, (st, sv) in enumerate(zip(stage_times[:-1], stage_vus)):
        ax1.axvline(x=st, color='gray', linestyle=':', alpha=0.5, linewidth=1)
        ax1.text(st + 1, ax1.get_ylim()[1] * 0.97, f'{sv} VUs', fontsize=8, color='gray')

    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left', fontsize=10)

    ax1.set_title('FitBeat — Caso 3: Stress Test\nLatencia vs VUs a lo largo del tiempo', fontsize=13, fontweight='bold')
    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "chart_stress_timeline.png")
    plt.savefig(out, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")


# ─────────────────────────────────────────────────────────────
# CHART 3 — Knee of the curve: avg latency per stage
# ─────────────────────────────────────────────────────────────
def chart_knee(durations):
    stage_defs = [
        (0,   30,  1,    "1 VU\n(warm-up)"),
        (30,  60,  50,   "50 VUs\n(load)"),
        (60,  90,  200,  "200 VUs\n(stress)"),
        (90,  120, 500,  "500 VUs\n(high)"),
        (120, 150, 2000, "2000 VUs\n(peak)"),
        (150, 180, 0,    "0 VUs\n(cool-down)"),
    ]

    stage_labels, stage_avgs, stage_p95s = [], [], []
    for t_start, t_end, vus, label in stage_defs:
        vals = [d for t, d in durations if t_start <= t < t_end]
        if vals:
            stage_labels.append(label)
            stage_avgs.append(np.mean(vals))
            stage_p95s.append(np.percentile(vals, 95))

    x = np.arange(len(stage_labels))
    fig, ax = plt.subplots(figsize=(12, 6))

    ax.plot(x, stage_avgs, 'o-', color='#2196F3', linewidth=2.5, markersize=8, label='avg latencia')
    ax.plot(x, stage_p95s, 's--', color='#F44336', linewidth=2.5, markersize=8, label='p(95) latencia')
    ax.fill_between(x, stage_avgs, stage_p95s, alpha=0.1, color='#9C27B0')

    # Detect knee: biggest jump in p95
    if len(stage_p95s) > 1:
        jumps = [stage_p95s[i+1] - stage_p95s[i] for i in range(len(stage_p95s)-1)]
        knee_idx = jumps.index(max(jumps)) + 1
        ax.axvline(x=knee_idx, color='#FF5722', linestyle='-.', linewidth=2, alpha=0.7)
        ax.text(knee_idx + 0.05, max(stage_p95s) * 0.9,
                f'← Knee\n({stage_labels[knee_idx].strip()})',
                color='#FF5722', fontsize=10, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(stage_labels, fontsize=10)
    ax.set_ylabel('Latencia (ms)', fontsize=12)
    ax.set_xlabel('Etapa de carga', fontsize=12)
    ax.set_title('FitBeat — Knee of the Performance Curve\nPunto donde la latencia crece exponencialmente', fontsize=13, fontweight='bold')
    ax.legend(fontsize=11)
    ax.yaxis.grid(True, alpha=0.3)
    ax.set_axisbelow(True)

    for i, (a, p) in enumerate(zip(stage_avgs, stage_p95s)):
        ax.annotate(f'{a:.0f}ms', (i, a), textcoords="offset points", xytext=(0, 8),
                    ha='center', fontsize=8, color='#2196F3')
        ax.annotate(f'{p:.0f}ms', (i, p), textcoords="offset points", xytext=(0, 8),
                    ha='center', fontsize=8, color='#F44336')

    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "chart_knee.png")
    plt.savefig(out, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {out}")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    files = {
        "Caso 1\n(1 VU)":   os.path.join(RESULTS_DIR, "case1.json"),
        "Caso 2\n(50 VUs)":  os.path.join(RESULTS_DIR, "case2.json"),
        "Caso 3\n(2000 VUs)": os.path.join(RESULTS_DIR, "case3.json"),
    }

    results = {}
    for label, path in files.items():
        if os.path.exists(path):
            print(f"Parsing {path}...")
            results[label] = parse_k6_json(path)
        else:
            print(f"WARNING: {path} not found, skipping")

    if not results:
        print("No result files found.")
        sys.exit(1)

    print("\nGenerating charts...")
    chart_comparison(results)

    stress_key = "Caso 3\n(2000 VUs)"
    if stress_key in results:
        durations_c3, vus_c3, _, _ = results[stress_key]
        chart_stress_timeline(durations_c3, vus_c3)
        chart_knee(durations_c3)

    # Print summary table
    print("\n" + "="*70)
    print(f"{'Escenario':<20} {'avg':>8} {'p(90)':>8} {'p(95)':>8} {'max':>8} {'errors':>8}")
    print("-"*70)
    for label, (durations, _, failed, total) in results.items():
        vals = [d for _, d in durations]
        s = stats(vals)
        err_pct = (failed/total*100) if total > 0 else 0
        clean_label = label.replace('\n', ' ')
        print(f"{clean_label:<20} {s.get('avg',0):>7.1f}ms {s.get('p90',0):>7.1f}ms "
              f"{s.get('p95',0):>7.1f}ms {s.get('max',0):>7.1f}ms {err_pct:>7.1f}%")
    print("="*70)
    print("\nDone. Charts saved to /results/")


if __name__ == "__main__":
    main()
