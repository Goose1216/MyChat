import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  onDark?: boolean;
}

export default function BrandLogo({ size = "md", showText = true, onDark = false }: LogoProps) {
  const dim       = { sm: 24, md: 32, lg: 40 }[size];
  const titleSize = { sm: 13, md: 16, lg: 20 }[size];
  const subSize   = { sm: 9,  md: 10, lg: 11 }[size];

  const textColor = onDark ? "#fff" : "var(--c-ink)";
  const subColor  = onDark ? "rgba(255,255,255,0.6)" : "var(--c-ink-muted)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
      {/* Логотип Апрель — инлайн SVG, не зависит от путей и сервера */}
      <svg
        viewBox="0 0 474.66666 486.66666"
        width={dim}
        height={dim}
        style={{ flexShrink: 0 }}
        aria-label="Апрель"
      >
        <g transform="matrix(1.3333333,0,0,-1.3333333,0,486.66667)">
          <g transform="scale(0.1)">
            <path
              fill="#ff0089"
              fillOpacity={1}
              fillRule="nonzero"
              stroke="none"
              d="M 1783.36,3649.25 C 803.008,3649.25 8.66406,2834.29 8.66406,1829.45 8.66406,824.605 803.008,9.67969 1783.36,9.67969 c 980.34,0 1773.19,814.92531 1773.19,1819.77031 0,1004.84 -792.85,1819.8 -1773.19,1819.8 z M 3082.62,1921.66 h -972.55 c -8.8,-0.53 -16.59,3.99 -22.01,10.79 -5.37,6.91 -6.4,16.7 -2.99,25.1 l 352.31,983.27 c 2.03,11.68 12.82,20.08 24.5,19.09 h 16.7 c 353.7,-231.61 577.55,-616.22 604.04,-1038.25 z M 480.18,1829.45 c 0,737.95 582.96,1336.07 1302.68,1336.07 72.6,0 144.69,-6.4 216.4,-18.69 L 1119.54,680.406 C 720.582,925.723 478.188,1360.96 480.68,1829.45 Z M 1783.36,493.871 c -70.22,0 -140.82,5.41 -210,17.231 l 316.88,910.138 c 3.53,10.79 13.32,18.58 25.14,19.58 H 3030.63 C 2868.7,892.293 2370.7,493.871 1783.36,493.871"
            />
          </g>
        </g>
      </svg>

      {showText && (
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: titleSize, fontWeight: 800, color: textColor, letterSpacing: "-0.01em" }}>
            Апрель
          </div>
          <div style={{ fontSize: subSize, color: subColor, fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 1 }}>
            мессенджер
          </div>
        </div>
      )}
    </div>
  );
}