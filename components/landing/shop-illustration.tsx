/** An original storefront drawing for the hero: red fascia, scalloped awning, glass door, plants. No stock art, no third-party artwork. */
export function ShopIllustration({ label }: { label: string }) {
  const bands = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg viewBox="0 0 560 440" role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="fascia" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E8222D" /><stop offset="1" stopColor="#B4121F" /></linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF6F0" /><stop offset="1" stopColor="#FFD7CC" /></linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#FBEDEA" /></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFE9B8" stopOpacity="0.95" /><stop offset="1" stopColor="#FFE9B8" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="280" cy="418" rx="250" ry="12" fill="#B4121F" opacity="0.12" />
      <rect x="70" y="92" width="420" height="318" rx="10" fill="url(#wall)" />
      <rect x="70" y="92" width="420" height="108" rx="10" fill="url(#fascia)" />
      <rect x="56" y="80" width="448" height="18" rx="9" fill="#9E0F1B" />
      {/* sign */}
      <rect x="182" y="126" width="48" height="48" rx="14" fill="#fff" />
      <image href="/logo.png" x="188" y="132" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
      <text x="244" y="168" fontSize="46" fontWeight="800" fill="#fff" letterSpacing="-1" fontFamily="inherit">airtel</text>
      {/* awning */}
      {bands.map((i) => (
        <g key={i}>
          <rect x={70 + i * 35} y="200" width="35" height="26" fill={i % 2 ? "#FFFFFF" : "#D8212C"} />
          <circle cx={70 + i * 35 + 17.5} cy="226" r="17.5" fill={i % 2 ? "#FFFFFF" : "#D8212C"} />
        </g>
      ))}
      {/* shop window: shelves and goods */}
      <rect x="96" y="262" width="196" height="132" rx="8" fill="url(#glass)" stroke="#fff" strokeWidth="4" />
      <circle cx="150" cy="300" r="46" fill="url(#glow)" /><circle cx="244" cy="300" r="40" fill="url(#glow)" />
      {[290, 330].map((y) => <rect key={y} x="106" y={y + 24} width="176" height="4" rx="2" fill="#E9B8B0" />)}
      {[[116, 262, 18, 28, "#E8222D"], [140, 268, 16, 22, "#F5A524"], [162, 258, 20, 32, "#2F7D5B"], [190, 266, 18, 24, "#E8222D"], [216, 260, 16, 30, "#4B6FD6"], [240, 268, 22, 22, "#F5A524"], [118, 304, 22, 22, "#2F7D5B"], [146, 302, 18, 24, "#E8222D"], [172, 308, 20, 18, "#4B6FD6"], [200, 300, 18, 26, "#F5A524"], [226, 306, 24, 20, "#E8222D"], [124, 344, 24, 20, "#F5A524"], [158, 340, 20, 24, "#4B6FD6"], [188, 346, 24, 18, "#2F7D5B"], [222, 342, 20, 22, "#E8222D"]].map(([x, y, w, h, c], i) => (
        <rect key={i} x={x as number} y={(y as number) + 6} width={w as number} height={h as number} rx="3" fill={c as string} opacity="0.92" />
      ))}
      {/* door and side glass */}
      <rect x="318" y="262" width="86" height="148" rx="8" fill="url(#glass)" stroke="#fff" strokeWidth="4" />
      <rect x="328" y="272" width="66" height="128" rx="5" fill="#fff" opacity="0.35" />
      <rect x="386" y="326" width="5" height="40" rx="2.5" fill="#B4121F" />
      <rect x="420" y="262" width="56" height="132" rx="8" fill="url(#glass)" stroke="#fff" strokeWidth="4" />
      <path d="M432 392 L464 268" stroke="#fff" strokeWidth="6" opacity="0.5" />
      {/* plants */}
      {[[44, -1], [516, 1]].map(([x, d]) => (
        <g key={x as number}>
          <path d={`M${(x as number) - 16} 396 h32 l-5 28 h-22 z`} fill="#8F3A2E" />
          {[[-12, 350, 14, 34, -20], [0, 336, 14, 42, 0], [12, 352, 14, 32, 22], [-4, 360, 10, 28, -8]].map(([dx, cy, rx, ry, rot], i) => (
            <ellipse key={i} cx={(x as number) + (dx as number)} cy={cy as number} rx={rx as number} ry={ry as number} fill={i % 2 ? "#3A9168" : "#2A7A55"} transform={`rotate(${(rot as number) * (d as number)} ${(x as number) + (dx as number)} ${(cy as number) + (ry as number)})`} />
          ))}
        </g>
      ))}
      <rect x="40" y="408" width="480" height="8" rx="4" fill="#F2D3CE" />
    </svg>
  );
}
