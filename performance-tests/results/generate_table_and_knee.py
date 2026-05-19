import json
import os
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.ticker as ticker
from matplotlib.gridspec import GridSpec
import numpy as np

RESULTS_DIR = "/results"

# ─────────────────────────────────────────────────────────────
# Parse k6 JSON — collect durations and request counts per stage
# ─────────────────────────────────────────────────────────────
STAGES = [
    {"label": "1",    "vus": 1,    "t_start": 0,   "t_end": 30},
    {"label": "50",   "vus": 50,   "t_start": 30,  "t_end": 60},
    {"label": "200",  "vus": 200,  "t_start": 60,  "t_end": 90},
    {"label": "500",  "vus": 500,  "t_start": 90,  "t_end": 120},
    {"label": "2000", "vus": 2000, "t_start": 120, "t_end": 150},
]

def parse_case3(filename):
    buckets = {s["label"]: {"durations": [], "reqs": 0, "failed": 0} for s in STAGES}
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
            data   = obj.get("data", {})
            ts_str = data.get("time", "")

            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if t0 is None:
                    t0 = ts
                elapsed = (ts - t0).total_seconds()
            except Exception:
                continue

            # Match to stage
            stage_key = None
            for s in STAGES:
                if s["t_start"] <= elapsed < s["t_end"]:
                    stage_key = s["label"]
                    break
            if stage_key is None:
                continue

            if metric == "http_req_duration" and obj.get("type") == "Point":
                buckets[stage_key]["durations"].append(data.get("value", 0))
                buckets[stage_key]["reqs"] += 1

            if metric == "http_req_failed" and obj.get("type") == "Point":
                if data.get("value", 0) == 1:
                    buckets[stage_key]["failed"] += 1

    return buckets


def build_stats(buckets):
    rows = []
    for s in STAGES:
        key = s["label"]
        d   = buckets[key]["durations"]
        reqs = buckets[key]["reqs"]
        failed = buckets[key]["failed"]

        if not d:
            rows.append({**s, "avg": 0, "p90": 0, "p95": 0, "max": 0,
                         "throughput": 0, "error_rate": 0, "reqs": 0})
            continue

        arr = np.array(d)
        window = s["t_end"] - s["t_start"]
        rows.append({
            "label":      s["label"],
            "vus":        s["vus"],
            "avg":        float(np.mean(arr)),
            "p90":        float(np.percentile(arr, 90)),
            "p95":        float(np.percentile(arr, 95)),
            "max":        float(np.max(arr)),
            "throughput": round(reqs / window, 2),
            "error_rate": round(failed / reqs * 100, 1) if reqs > 0 else 0,
            "reqs":       reqs,
        })
    return rows


# ─────────────────────────────────────────────────────────────
# CHART 1 — Table image
# ─────────────────────────────────────────────────────────────
def chart_table(rows):
    col_headers = [
        "Usuarios\nconcurrentes",
        "Avg\n(ms)",
        "p(90)\n(ms)",
        "p(95)\n(ms)",
        "Máx\n(ms)",
        "Throughput\n(req/s)",
        "Errores\n(%)",
    ]

    cell_data = []
    for r in rows:
        cell_data.append([
            r["vus"],
            f"{r['avg']:.0f}",
            f"{r['p90']:.0f}",
            f"{r['p95']:.0f}",
            f"{r['max']:.0f}",
            f"{r['throughput']:.1f}",
            f"{r['error_rate']:.1f}%",
        ])

    fig, ax = plt.subplots(figsize=(13, 3.2))
    ax.axis("off")

    # Color rows based on health
    row_colors = []
    for r in rows:
        if r["error_rate"] > 0:
            row_colors.append(["#FFCDD2"] * len(col_headers))  # red — failing
        elif r["p95"] > 1000:
            row_colors.append(["#FFF9C4"] * len(col_headers))  # yellow — degraded
        else:
            row_colors.append(["#E8F5E9"] * len(col_headers))  # green — healthy

    tbl = ax.table(
        cellText=cell_data,
        colLabels=col_headers,
        cellLoc="center",
        loc="center",
        cellColours=row_colors,
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(11)
    tbl.scale(1, 2.2)

    # Style header
    for col in range(len(col_headers)):
        tbl[0, col].set_facecolor("#1565C0")
        tbl[0, col].set_text_props(color="white", fontweight="bold")

    # Bold the VU column
    for row in range(1, len(rows) + 1):
        tbl[row, 0].set_text_props(fontweight="bold")

    ax.set_title(
        "FitBeat — POST /api/auth/login — Resultados por nivel de carga\n"
        "🟢 Estable  🟡 Degradado  🔴 Fallo",
        fontsize=13, fontweight="bold", pad=16,
    )

    # Legend
    patches = [
        mpatches.Patch(color="#E8F5E9", label="Estable (errores = 0, p95 < 1s)"),
        mpatches.Patch(color="#FFF9C4", label="Degradado (p95 > 1s)"),
        mpatches.Patch(color="#FFCDD2", label="Fallo (errores > 0%)"),
    ]
    ax.legend(handles=patches, loc="lower right", fontsize=9,
              bbox_to_anchor=(1, -0.05), framealpha=0.9)

    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "chart_table.png")
    plt.savefig(out, dpi=160, bbox_inches="tight")
    plt.close()
    print(f"Saved: {out}")


# ─────────────────────────────────────────────────────────────
# CHART 2 — Response time vs concurrent users (knee curve)
# ─────────────────────────────────────────────────────────────
def chart_knee_curve(rows):
    vus   = [r["vus"]  for r in rows]
    avgs  = [r["avg"]  for r in rows]
    p90s  = [r["p90"]  for r in rows]
    p95s  = [r["p95"]  for r in rows]
    thrpt = [r["throughput"] for r in rows]
    errs  = [r["error_rate"] for r in rows]

    fig = plt.figure(figsize=(14, 8))
    gs  = GridSpec(2, 1, figure=fig, height_ratios=[3, 1], hspace=0.08)

    # ── Top: latency vs VUs ──
    ax1 = fig.add_subplot(gs[0])

    ax1.plot(vus, avgs, "o-",  color="#2196F3", linewidth=2.5, markersize=9,
             label="avg latencia", zorder=3)
    ax1.plot(vus, p90s, "s--", color="#4CAF50", linewidth=2,   markersize=8,
             label="p(90) latencia", zorder=3)
    ax1.plot(vus, p95s, "^-",  color="#F44336", linewidth=2.5, markersize=9,
             label="p(95) latencia", zorder=3)

    # Shade region under p95
    ax1.fill_between(vus, avgs, p95s, alpha=0.08, color="#9C27B0")

    # ── Detect and annotate knee ──
    jumps    = [p95s[i+1] - p95s[i] for i in range(len(p95s) - 1)]
    knee_idx = jumps.index(max(jumps)) + 1
    knee_vu  = vus[knee_idx]
    knee_val = p95s[knee_idx]

    ax1.axvline(x=knee_vu, color="#FF5722", linestyle="-.", linewidth=2.2,
                alpha=0.85, zorder=2)
    ax1.annotate(
        f"  ← KNEE\n  {knee_vu} VUs\n  p(95) = {knee_val:.0f}ms",
        xy=(knee_vu, knee_val),
        xytext=(knee_vu * 1.15, knee_val * 0.78),
        fontsize=11, fontweight="bold", color="#FF5722",
        arrowprops=dict(arrowstyle="->", color="#FF5722", lw=1.8),
        bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="#FF5722", alpha=0.9),
    )

    # Annotate each point
    for i, (v, a, p) in enumerate(zip(vus, avgs, p95s)):
        ax1.annotate(f"{a:.0f}ms", (v, a), textcoords="offset points",
                     xytext=(0, 12), ha="center", fontsize=9, color="#2196F3")
        ax1.annotate(f"{p:.0f}ms", (v, p), textcoords="offset points",
                     xytext=(0, 10), ha="center", fontsize=9, color="#F44336")

    # Shade zones
    ax1.axvspan(0, 50,   alpha=0.04, color="#4CAF50", label="_nolegend_")
    ax1.axvspan(50, 200, alpha=0.04, color="#FF9800", label="_nolegend_")
    ax1.axvspan(200, 2100, alpha=0.06, color="#F44336", label="_nolegend_")

    zone_y = ax1.get_ylim()[1] * 0.98 if ax1.get_ylim()[1] > 0 else 10000
    # Will add zone labels after ylim is set properly
    ax1.set_xlim(-30, 2200)
    ax1.set_ylabel("Tiempo de respuesta (ms)", fontsize=12)
    ax1.set_title(
        "FitBeat — Tiempo de respuesta vs Usuarios concurrentes\n"
        "POST /api/auth/login  |  Traefik → KrakenD → user-service → PostgreSQL",
        fontsize=13, fontweight="bold",
    )
    ax1.legend(fontsize=11, loc="upper left")
    ax1.yaxis.grid(True, alpha=0.25)
    ax1.set_axisbelow(True)
    ax1.set_xticklabels([])  # shared with bottom panel

    # Zone text labels
    ymax = max(p95s) * 1.05
    ax1.set_ylim(-200, ymax)
    ax1.text(25,   ymax * 0.92, "✅ Zona\nestable",    ha="center", fontsize=9,
             color="#2E7D32", fontweight="bold")
    ax1.text(125,  ymax * 0.92, "⚠️ Zona\ndegradada", ha="center", fontsize=9,
             color="#E65100", fontweight="bold")
    ax1.text(1100, ymax * 0.92, "❌ Zona de\nfallo",  ha="center", fontsize=9,
             color="#B71C1C", fontweight="bold")

    # ── Bottom: throughput & errors ──
    ax2 = fig.add_subplot(gs[1], sharex=ax1)

    color_tp  = "#00796B"
    color_err = "#C62828"

    bars = ax2.bar([str(v) for v in vus], thrpt, color=color_tp, alpha=0.75,
                   label="Throughput (req/s)", width=0.4)
    for bar, val in zip(bars, thrpt):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
                 f"{val:.1f}", ha="center", va="bottom", fontsize=9, color=color_tp)

    ax2b = ax2.twinx()
    ax2b.plot([str(v) for v in vus], errs, "D-", color=color_err, linewidth=2,
              markersize=8, label="Error rate (%)")
    for i, (v, e) in enumerate(zip(vus, errs)):
        if e > 0:
            ax2b.annotate(f"{e:.1f}%", (str(v), e),
                          textcoords="offset points", xytext=(5, 5),
                          fontsize=9, color=color_err, fontweight="bold")

    ax2.set_xlabel("Usuarios concurrentes (VUs)", fontsize=12)
    ax2.set_ylabel("Throughput\n(req/s)", fontsize=10, color=color_tp)
    ax2b.set_ylabel("Error rate (%)", fontsize=10, color=color_err)
    ax2b.set_ylim(0, 110)

    lines1, labels1 = ax2.get_legend_handles_labels()
    lines2, labels2 = ax2b.get_legend_handles_labels()
    ax2.legend(lines1 + lines2, labels1 + labels2, fontsize=9, loc="upper left")
    ax2.yaxis.grid(True, alpha=0.2)
    ax2.set_axisbelow(True)

    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "chart_knee_curve.png")
    plt.savefig(out, dpi=160, bbox_inches="tight")
    plt.close()
    print(f"Saved: {out}")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    path = os.path.join(RESULTS_DIR, "case3.json")
    if not os.path.exists(path):
        print(f"ERROR: {path} not found")
        return

    print("Parsing case3.json...")
    buckets = parse_case3(path)
    rows    = build_stats(buckets)

    print("\n" + "="*80)
    print(f"{'VUs':>6}  {'avg':>8}  {'p(90)':>8}  {'p(95)':>8}  "
          f"{'max':>8}  {'req/s':>7}  {'errores':>8}")
    print("-"*80)
    for r in rows:
        print(f"{r['vus']:>6}  {r['avg']:>7.0f}ms  {r['p90']:>7.0f}ms  "
              f"{r['p95']:>7.0f}ms  {r['max']:>7.0f}ms  "
              f"{r['throughput']:>6.1f}  {r['error_rate']:>7.1f}%")
    print("="*80)

    print("\nGenerating table chart...")
    chart_table(rows)

    print("Generating knee curve chart...")
    chart_knee_curve(rows)

    print("\nDone.")


if __name__ == "__main__":
    main()
