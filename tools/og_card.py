# python3 tools/og_card.py <out.json from tools/to_bymean.js> assets/og-card.png: the link-preview card
import matplotlib, json, sys
d = json.load(open(sys.argv[1])); t = d["tot"]
moved = t["up"] + t["down"] + t["mixed"]
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import FancyBboxPatch
for f in fm.findSystemFonts():
    if "Inter" in f: fm.fontManager.addfont(f)
if any("Inter" in f.name for f in fm.fontManager.ttflist):
    plt.rcParams["font.family"] = "Inter"
fig = plt.figure(figsize=(12, 6.3), dpi=100, facecolor="#ffffff")
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 1200); ax.set_ylim(0, 630); ax.axis("off")
ax.text(72, 545, "ICLR 2027 · REBUTTAL TRACKER", fontsize=17, weight="bold", color="#2563eb")
ax.text(70, 470, "How much did the rebuttal", fontsize=54, weight="bold", color="#111827")
ax.text(70, 395, "move scores?", fontsize=54, weight="bold", color="#111827")
ax.text(72, 335, "Look up your initial ratings and see how papers like yours moved.", fontsize=20, color="#6b7280")
stats = [(f"{100*moved/t['sc']:.1f}%", "of papers changed score"), (f"{round(t['up']/max(1,t['down']))} : 1", "went up vs. down"), (f"{100*t['withdrawn']/t['n']:.1f}%", "withdrawn so far")]
for i, (b, s) in enumerate(stats):
    x0 = 72 + i * 355
    ax.add_patch(FancyBboxPatch((x0, 95), 340, 160, boxstyle="round,pad=0,rounding_size=22", fc="#f5f6f8", ec="#e5e7eb", lw=1.5))
    ax.text(x0 + 26, 175, b, fontsize=44, weight="bold", color="#111827")
    ax.text(x0 + 28, 125, s, fontsize=17.5, color="#6b7280")
ax.text(72, 42, "juevn.github.io/iclr2027-reviews", fontsize=18, color="#4f46e5")
ax.text(1128, 42, "@jueun_kim_", fontsize=18, color="#9ca3af", ha="right")
fig.savefig(sys.argv[2], facecolor="#ffffff")
print("ok")
