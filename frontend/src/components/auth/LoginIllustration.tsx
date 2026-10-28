/**
 * Login page artwork: a sales dashboard with a rising chart, a balanced ledger card and a stock card,
 * the three things this ERP keeps in step. Drawn in SVG so it stays sharp; colours come from the
 * login-art-* classes in globals.css, which use theme tokens only.
 */
export function LoginIllustration() {
  return (
    <svg className="login-art" viewBox="0 0 320 260" role="img" aria-label="ERP dashboard with sales chart, balanced ledger and stock">
      {/* Links from the dashboard to the ledger and stock cards */}
      <path className="login-art-link" d="M96 180 C 96 196, 80 196, 72 204" />
      <path className="login-art-link" d="M236 180 C 236 192, 250 192, 256 198" />

      {/* Dashboard window */}
      <rect className="login-art-glass" x="40" y="24" width="240" height="156" rx="14" />
      <circle className="login-art-dot" cx="57" cy="40" r="3.5" />
      <circle className="login-art-dot" cx="69" cy="40" r="3.5" />
      <circle className="login-art-dot" cx="81" cy="40" r="3.5" />
      <text className="login-art-label" x="56" y="70">Sales Trend</text>
      <rect className="login-art-line" x="56" y="80" width="64" height="6" rx="3" />
      <rect className="login-art-line" x="56" y="94" width="44" height="6" rx="3" />
      <rect className="login-art-line" x="56" y="108" width="54" height="6" rx="3" />

      <line className="login-art-axis" x1="136" y1="166" x2="266" y2="166" />
      <rect className="login-art-bar" x="140" y="136" width="18" height="30" rx="4" />
      <rect className="login-art-bar" x="164" y="120" width="18" height="46" rx="4" />
      <rect className="login-art-bar" x="188" y="126" width="18" height="40" rx="4" />
      <rect className="login-art-bar" x="212" y="102" width="18" height="64" rx="4" />
      <rect className="login-art-bar-accent" x="236" y="78" width="18" height="88" rx="4" />
      <polyline className="login-art-trend" points="149,128 173,112 197,118 221,94 245,68" />
      <path className="login-art-trend-head" d="M245 60 L253 70 L239 71 Z" />

      {/* Ledger card: Debit equals Credit */}
      <rect className="login-art-card" x="6" y="166" width="136" height="92" rx="12" />
      <text className="login-art-card-title" x="20" y="192">Ledger</text>
      <text className="login-art-card-text" x="20" y="212">Debit</text>
      <text className="login-art-card-text login-art-num" x="124" y="212" textAnchor="end">12,500</text>
      <text className="login-art-card-text" x="20" y="230">Credit</text>
      <text className="login-art-card-text login-art-num" x="124" y="230" textAnchor="end">12,500</text>
      <circle className="login-art-badge" cx="124" cy="186" r="9" />
      <path className="login-art-check" d="M119.5 186 L122.8 189.2 L128.5 183" />
      <text className="login-art-card-muted" x="20" y="247">Balanced</text>

      {/* Stock card: stacked boxes */}
      <rect className="login-art-card" x="196" y="190" width="118" height="64" rx="12" />
      <text className="login-art-card-title" x="210" y="211">Stock</text>
      <text className="login-art-card-muted" x="210" y="239">In Stock</text>
      <rect className="login-art-box" x="268" y="222" width="22" height="20" rx="3" />
      <rect className="login-art-box" x="292" y="222" width="14" height="20" rx="3" />
      <rect className="login-art-box-accent" x="276" y="200" width="22" height="20" rx="3" />
      <line className="login-art-tape" x1="279" y1="232" x2="279" y2="242" />
      <line className="login-art-tape" x1="287" y1="210" x2="287" y2="220" />

      {/* Posted chip */}
      <rect className="login-art-chip" x="176" y="4" width="132" height="26" rx="13" />
      <circle className="login-art-badge" cx="191" cy="17" r="6" />
      <path className="login-art-check" d="M188 17 L190.2 19.2 L194 15" />
      <text className="login-art-chip-text" x="203" y="21">Invoice Posted</text>
    </svg>
  );
}
