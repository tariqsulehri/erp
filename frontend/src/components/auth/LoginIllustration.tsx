/**
 * Login page artwork: general business charts (KPI tiles with up and down trends, a multi-line trend
 * chart, a mix donut and monthly bars). Drawn in SVG so it stays sharp; colours come from the
 * login-art-* classes in globals.css, which use theme tokens only. The figures are decorative.
 */
const CIRCUMFERENCE = 2 * Math.PI * 28;

/** One donut segment: share of the ring and where it starts, both as fractions of a full turn. */
function DonutSegment({ className, share, start }: { className: string; share: number; start: number }) {
  return (
    <circle
      className={className}
      cx="282" cy="134" r="28"
      strokeDasharray={`${share * CIRCUMFERENCE - 2} ${CIRCUMFERENCE}`}
      strokeDashoffset={-start * CIRCUMFERENCE}
      transform="rotate(-90 282 134)"
    />
  );
}

function KpiTile({ x, label, change, up, spark }: { x: number; label: string; change: string; up: boolean; spark: string }) {
  return (
    <g>
      <rect className="login-art-card" x={x} y="0" width="104" height="58" rx="10" />
      <text className="login-art-card-muted" x={x + 10} y="18">{label}</text>
      <path className={up ? 'login-art-up' : 'login-art-down'} d={up ? `M${x + 10} 40 l5 -7 l5 7 Z` : `M${x + 10} 33 l5 7 l5 -7 Z`} />
      <text className={`login-art-card-title ${up ? 'login-art-up-text' : 'login-art-down-text'}`} x={x + 24} y="41">{change}</text>
      <polyline className={up ? 'login-art-spark-up' : 'login-art-spark-down'} points={spark} />
    </g>
  );
}

export function LoginIllustration() {
  return (
    <svg className="login-art" viewBox="0 0 340 290" role="img" aria-label="Business charts showing rising and falling trends">
      {/* KPI tiles */}
      <KpiTile x={0} label="Revenue" change="12%" up spark="62,44 70,40 78,42 86,34 94,30" />
      <KpiTile x={118} label="Customers" change="8%" up spark="180,42 188,40 196,36 204,37 212,30" />
      <KpiTile x={236} label="Costs" change="3%" up={false} spark="298,30 306,33 314,32 322,38 330,42" />

      {/* Trend lines */}
      <rect className="login-art-glass" x="0" y="72" width="226" height="124" rx="12" />
      <text className="login-art-label" x="12" y="92">Growth Trends</text>
      <line className="login-art-grid" x1="12" y1="120" x2="214" y2="120" />
      <line className="login-art-grid" x1="12" y1="146" x2="214" y2="146" />
      <line className="login-art-axis" x1="12" y1="180" x2="214" y2="180" />
      <polyline className="login-art-series-white" points="14,168 46,160 78,150 110,154 142,132 174,122 210,104" />
      <polyline className="login-art-series-green" points="14,174 46,170 78,164 110,158 142,156 174,146 210,136" />
      <polyline className="login-art-series-orange" points="14,128 46,134 78,130 110,144 142,150 174,158 210,164" />
      <circle className="login-art-end-white" cx="210" cy="104" r="4" />
      <circle className="login-art-end-green" cx="210" cy="136" r="4" />
      <circle className="login-art-end-orange" cx="210" cy="164" r="4" />

      {/* Mix donut */}
      <rect className="login-art-glass" x="236" y="72" width="104" height="124" rx="12" />
      <text className="login-art-label" x="248" y="92">Sales Mix</text>
      <circle className="login-art-track" cx="282" cy="134" r="28" />
      <DonutSegment className="login-art-ring-white" share={0.45} start={0} />
      <DonutSegment className="login-art-ring-green" share={0.3} start={0.45} />
      <DonutSegment className="login-art-ring-orange" share={0.25} start={0.75} />
      <text className="login-art-center" x="282" y="139" textAnchor="middle">45%</text>
      <rect className="login-art-key-white" x="248" y="176" width="8" height="8" rx="2" />
      <rect className="login-art-key-green" x="276" y="176" width="8" height="8" rx="2" />
      <rect className="login-art-key-orange" x="304" y="176" width="8" height="8" rx="2" />

      {/* Monthly bars */}
      <rect className="login-art-glass" x="0" y="208" width="340" height="82" rx="12" />
      <text className="login-art-label" x="12" y="228">Monthly Performance</text>
      <line className="login-art-axis" x1="12" y1="278" x2="328" y2="278" />
      {[[20, 22, 16], [30, 28, 20], [26, 24, 18], [36, 30, 22], [32, 38, 26], [42, 36, 30], [46, 40, 34]].map(([a, b, c], index) => {
        const x = 20 + index * 44;
        return (
          <g key={x}>
            <rect className="login-art-bar" x={x} y={278 - a} width="9" height={a} rx="2" />
            <rect className="login-art-bar-green" x={x + 11} y={278 - b} width="9" height={b} rx="2" />
            <rect className="login-art-bar-yellow" x={x + 22} y={278 - c} width="9" height={c} rx="2" />
          </g>
        );
      })}
    </svg>
  );
}
