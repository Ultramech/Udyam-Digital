/**
 * Welcome illustrations: one soft pink-and-red style (pale skyline, rounded clay-like shapes, gentle shadows), three different hero scenes.
 * Original SVG drawings. Each scene is 340 x 210 and scales to the column width.
 */
const RED = "#e0242d";

/** Faded pink skyline behind every scene, plus the soft ground glow. */
function Backdrop({ id }: { id: string }) {
  const blocks: [number, number, number, number][] = [[12, 74, 44, 120], [60, 44, 40, 150], [106, 92, 34, 102], [204, 64, 46, 130], [256, 88, 40, 106], [298, 104, 34, 90]];
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3c3c0" stopOpacity="0.8" /><stop offset="0.7" stopColor="#f8dad8" stopOpacity="0.45" /><stop offset="1" stopColor="#fdf1f0" stopOpacity="0" /></linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#f3a9a4" stopOpacity="0.55" /><stop offset="1" stopColor="#f3a9a4" stopOpacity="0" /></radialGradient>
      </defs>
      {blocks.map(([x, y, w, h]) => (
        <g key={x}>
          <rect x={x} y={y} width={w} height={h} rx="3" fill={`url(#${id}-sky)`} />
          {Array.from({ length: Math.floor(h / 22) }, (_, r) => Array.from({ length: Math.floor(w / 14) }, (_, c) => <rect key={`${r}${c}`} x={x + 6 + c * 12} y={y + 10 + r * 18} width="6" height="8" rx="1.5" fill="#fff" opacity={0.5 - r * 0.045} />))}
        </g>
      ))}
      <ellipse cx="170" cy="190" rx="165" ry="17" fill={`url(#${id}-glow)`} />
    </g>
  );
}

function Plant({ x, y, s = 1, id }: { x: number; y: number; s?: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#88c070" /><stop offset="1" stopColor="#3f8044" /></linearGradient>
        <linearGradient id={`${id}-pot`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#e07f64" /><stop offset="1" stopColor="#b9553d" /></linearGradient>
      </defs>
      {[[-12, -34, -28, 12, 26], [0, -44, 0, 12, 30], [12, -34, 28, 12, 26], [-6, -24, -50, 9, 18], [8, -24, 52, 9, 18]].map(([cx, cy, rot, rx, ry], k) => (
        <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy + 8})`} fill={`url(#${id}-leaf)`} />
      ))}
      <path d="M-13 -8h26l-4 24h-18z" fill={`url(#${id}-pot)`} /><rect x="-15" y="-11" width="30" height="6" rx="2.5" fill="#cf6b52" />
    </g>
  );
}

/** Slide 1: the Airtel shop on the high street, with a floating red wifi sign. */
export function ShopArt({ label }: { label: string }) {
  const id = "a1";
  return (
    <svg viewBox="0 0 340 210" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="a1-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbe6df" /><stop offset="1" stopColor="#f0c0b6" /></linearGradient>
        <linearGradient id="a1-white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f8e1de" /></linearGradient>
        <linearGradient id="a1-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b3121d" /><stop offset="1" stopColor="#d3222c" /></linearGradient>
        <linearGradient id="a1-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5050" /><stop offset="1" stopColor="#4b2a2c" /></linearGradient>
        <linearGradient id="a1-sign" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2474a" /><stop offset="1" stopColor="#c4121f" /></linearGradient>
        <filter id="a1-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#a9121c" floodOpacity="0.28" /></filter>
      </defs>
      <Backdrop id={id} />
      <Plant x={56} y={184} s={1.25} id="a1p1" /><Plant x={284} y={184} s={0.85} id="a1p2" /><Plant x={308} y={184} s={0.7} id="a1p3" />
      <rect x="250" y="172" width="22" height="14" rx="2.5" fill="#5d4646" />
      <g filter="url(#a1-shadow)" transform="translate(170 186) scale(1.2) translate(-170 -186)">
        <rect x="90" y="112" width="160" height="72" rx="3" fill="url(#a1-wall)" />
        <rect x="90" y="122" width="160" height="9" fill="#7a2a24" opacity="0.14" />
        <polygon points="98,90 242,90 258,112 82,112" fill="url(#a1-roof)" />
        {Array.from({ length: 8 }, (_, i) => {
          const tx = 98 + i * 18, bx = 82 + i * 22, w = 22, white = i % 2 === 1, c = white ? "url(#a1-white)" : RED, st = white ? "#efc3be" : "none";
          return <g key={i}><polygon points={`${tx},90 ${tx + 18},90 ${bx + w},112 ${bx},112`} fill={c} stroke={st} strokeWidth="0.7" /><circle cx={bx + w / 2} cy="112" r={w / 2} fill={c} stroke={st} strokeWidth="0.7" /></g>;
        })}
        <polygon points="98,90 242,90 244,94 96,94" fill="#fff" opacity="0.18" />
        <polygon points="100,85 240,85 242,91 98,91" fill="url(#a1-roof)" /><polygon points="100,85 240,85 240.6,87 99.4,87" fill="#fff" opacity="0.22" />
        <rect x="100" y="132" width="52" height="42" rx="3" fill="url(#a1-glass)" stroke="#fff" strokeWidth="2.5" />
        {[[108, 152, "#f7a3a0"], [122, 148, "#ffd7a3"], [136, 152, "#f2c0e0"], [114, 138, "#ffe9c4"], [130, 140, "#f7a3a0"]].map(([x, y, f], k) => <rect key={k} x={x as number} y={y as number} width="9" height="10" rx="2.5" fill={f as string} opacity="0.95" />)}
        <rect x="104" y="162" width="44" height="3" rx="1.5" fill="#fff" opacity="0.35" />
        <rect x="160" y="136" width="34" height="38" rx="3" fill="#fff3e2" stroke="#fff" strokeWidth="2.5" /><rect x="164" y="144" width="26" height="22" rx="2" fill="#ffe3b8" /><circle cx="177" cy="154" r="5" fill="#f7a3a0" />
        <rect x="204" y="130" width="34" height="54" rx="3" fill="url(#a1-glass)" stroke="#fff" strokeWidth="2.5" /><rect x="219" y="130" width="2.5" height="54" fill="#fff" opacity="0.7" /><circle cx="231" cy="160" r="1.8" fill="#fff" />
        <rect x="86" y="182" width="168" height="7" rx="2" fill="#e9b1a8" />
      </g>
      <g transform="translate(264 26) rotate(-7)">
        <rect x="3" y="5" width="64" height="50" rx="11" fill="#a60f19" />
        <rect width="64" height="50" rx="11" fill="url(#a1-sign)" /><rect x="2" y="2" width="60" height="22" rx="9" fill="#fff" opacity="0.14" />
        <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round"><path d="M17 23a22 22 0 0 1 30 0" /><path d="M23 30a13 13 0 0 1 18 0" /></g><circle cx="32" cy="38" r="3.2" fill="#fff" />
      </g>
    </svg>
  );
}

/** Slide 2: a phone chat in your language ending in one clear price, with language tiles and a ₹ coin. */
export function ChatArt({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 340 210" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="a2-head" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ee3a40" /><stop offset="1" stopColor="#c4121f" /></linearGradient>
        <linearGradient id="a2-phone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f3dedb" /></linearGradient>
        <radialGradient id="a2-coin" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffe9a0" /><stop offset="1" stopColor="#e39a14" /></radialGradient>
        <filter id="a2-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#a9121c" floodOpacity="0.28" /></filter>
      </defs>
      <Backdrop id="a2" />
      <Plant x={38} y={184} s={1} id="a2p1" /><Plant x={312} y={184} s={0.8} id="a2p2" />
      <g filter="url(#a2-shadow)">
        <rect x="122" y="14" width="96" height="172" rx="17" fill="url(#a2-phone)" stroke="#e9c9c5" strokeWidth="2" />
        <rect x="129" y="22" width="82" height="156" rx="12" fill="#fff" />
        <rect x="129" y="22" width="82" height="34" rx="12" fill="url(#a2-head)" /><rect x="129" y="44" width="82" height="12" fill="url(#a2-head)" />
        <circle cx="143" cy="39" r="7" fill="#fff" /><circle cx="143" cy="39" r="3.2" fill={RED} />
        <text x="154" y="37" fontSize="7.5" fontWeight="800" fill="#fff">AI advisor</text><text x="154" y="46" fontSize="6" fill="#fff" opacity="0.85">online</text>
        <rect x="136" y="64" width="58" height="20" rx="8" fill="#f3ecec" /><text x="143" y="77" fontSize="9" fontWeight="700" fill="#2a2326">मेरी दुकान…</text>
        <rect x="150" y="92" width="54" height="34" rx="9" fill="url(#a2-head)" /><text x="157" y="105" fontSize="7.5" fontWeight="800" fill="#fff">Dukaan</text><text x="157" y="114" fontSize="7.5" fontWeight="800" fill="#fff">Digital</text><text x="157" y="122" fontSize="5.5" fill="#fff" opacity="0.9">one clear price</text>
        <rect x="136" y="134" width="40" height="14" rx="7" fill="#fde6e4" /><text x="143" y="144" fontSize="7" fontWeight="800" fill={RED}>₹ + GST</text>
        <rect x="136" y="158" width="68" height="12" rx="6" fill="#f3ecec" />
      </g>
      {[["EN", 56, 46, -9, "#ffffff", "#2a2326"], ["हिं", 252, 36, 8, RED, "#ffffff"], ["தமி", 40, 110, 7, "#ffffff", RED], ["मरा", 262, 100, -7, "#ffffff", "#2a2326"]].map(([t, x, y, r, f, c]) => (
        <g key={t as string} transform={`translate(${x} ${y}) rotate(${r})`} filter="url(#a2-shadow)">
          <rect width="40" height="36" rx="12" fill={f as string} /><text x="20" y="24" textAnchor="middle" fontSize="15" fontWeight="800" fill={c as string}>{t}</text>
        </g>
      ))}
      <g transform="translate(250 134)" filter="url(#a2-shadow)"><circle cx="22" cy="22" r="22" fill="url(#a2-coin)" /><circle cx="22" cy="22" r="16" fill="none" stroke="#c98200" strokeWidth="1.5" opacity="0.6" /><text x="22" y="30" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff4cc" stroke="#b97500" strokeWidth="0.6">₹</text></g>
      <path d="M92 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={RED} opacity="0.85" /><path d="M300 150l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={RED} opacity="0.6" />
    </svg>
  );
}

/** Slide 3: the installation van on its way, a route to your door and a verified-documents card. */
export function TrackArt({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 340 210" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="a3-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#f0dcd8" /></linearGradient>
        <linearGradient id="a3-pin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2474a" /><stop offset="1" stopColor="#c4121f" /></linearGradient>
        <linearGradient id="a3-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3222c" /><stop offset="1" stopColor="#b3121d" /></linearGradient>
        <filter id="a3-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#a9121c" floodOpacity="0.28" /></filter>
      </defs>
      <Backdrop id="a3" />
      <rect x="0" y="176" width="340" height="3" fill="#f0c9c5" opacity="0.7" />
      <path d="M196 118C232 108 214 76 258 70" fill="none" stroke={RED} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />
      <g filter="url(#a3-shadow)">
        <rect x="56" y="108" width="104" height="60" rx="11" fill="url(#a3-body)" stroke="#ecd2ce" strokeWidth="1.2" />
        <path d="M160 122h20c8 0 14 6 16 14l3 18c1 6-3 14-10 14h-29z" fill="url(#a3-body)" stroke="#ecd2ce" strokeWidth="1.2" />
        <path d="M166 128h12c5 0 9 4 10 9l1 8h-23z" fill="#cfe3ee" /><path d="M166 128h12c5 0 9 4 10 9l-22 0z" fill="#fff" opacity="0.4" />
        <rect x="56" y="146" width="104" height="9" fill={RED} /><rect x="56" y="155" width="104" height="3" fill="#a60f19" opacity="0.4" />
        <image href="/logo.png" x="72" y="116" width="26" height="26" />
        <text x="104" y="134" fontSize="11" fontWeight="800" fill={RED}>airtel</text>
        <rect x="193" y="146" width="7" height="5" rx="2" fill="#ffd45a" />
        <circle cx="86" cy="168" r="12.5" fill="#3a3235" /><circle cx="86" cy="168" r="5.5" fill="#cbbfbd" />
        <circle cx="176" cy="168" r="12.5" fill="#3a3235" /><circle cx="176" cy="168" r="5.5" fill="#cbbfbd" />
      </g>
      <g filter="url(#a3-shadow)"><path d="M262 62c-11 0-19 8-19 18 0 13 19 31 19 31s19-18 19-31c0-10-8-18-19-18z" fill="url(#a3-pin)" /><circle cx="262" cy="80" r="9.5" fill="#fff" /><path d="M257.5 80l3.4 3.4 6-6.6" fill="none" stroke="#14a35f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g filter="url(#a3-shadow)">
        <rect x="262" y="132" width="52" height="44" rx="3" fill="#fbe6df" /><polygon points="256,134 288,110 320,134" fill="url(#a3-roof)" />
        <rect x="278" y="150" width="16" height="26" rx="2" fill="#6a3b3b" /><rect x="268" y="142" width="9" height="9" rx="1.5" fill="#ffe3b8" /><rect x="299" y="142" width="9" height="9" rx="1.5" fill="#ffe3b8" />
        <circle cx="312" cy="128" r="10" fill="#14a35f" /><path d="M307.5 128l3.2 3.2 5.6-6.2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(22 28) rotate(-6)" filter="url(#a3-shadow)">
        <rect width="104" height="40" rx="13" fill="#fff" /><circle cx="21" cy="20" r="11" fill="#14a35f" /><path d="M15.5 20l4 4 7-7.6" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text x="38" y="18" fontSize="9" fontWeight="800" fill="#2a2326">Documents</text><text x="38" y="30" fontSize="9" fontWeight="800" fill="#14a35f">verified</text>
      </g>
      <Plant x={30} y={184} s={0.8} id="a3p1" />
      <path d="M150 52l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill={RED} opacity="0.8" />
    </svg>
  );
}
