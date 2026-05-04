import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Укажите путь к логотипу компании здесь.
// Оставьте пустым — будет показана заглушка (знак аптечного креста).
// После того как добавите файл, он автоматически появится везде в приложении.
// ─────────────────────────────────────────────────────────────────────────────
const LOGO_PATH = ""; // пример: "/logo/april-logo.svg"

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  onDark?: boolean; // true = светлый текст (для тёмного фона)
}

export default function BrandLogo({ size = "md", showText = true, onDark = false }: LogoProps) {
  const dim = { sm: 24, md: 32, lg: 40 }[size];
  const titleSize = { sm: 13, md: 16, lg: 20 }[size];
  const subSize   = { sm: 9,  md: 10, lg: 11 }[size];

  const textColor = onDark ? "#fff" : "var(--c-ink)";
  const subColor  = onDark ? "rgba(255,255,255,0.6)" : "var(--c-ink-muted)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
      {LOGO_PATH ? (
        <img
          src={LOGO_PATH}
          alt="Апрель"
          style={{ width: dim, height: dim, objectFit: "contain", borderRadius: 8 }}
        />
      ) : (
        /* Заглушка — аптечный крест в зелёном кружке */
        <div style={{
          width: dim, height: dim,
          background: "linear-gradient(135deg, #00897B, #26A69A)",
          borderRadius: Math.round(dim * 0.28),
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <svg width={dim * 0.58} height={dim * 0.58} viewBox="0 0 20 20" fill="none">
            <rect x="7.5" y="2" width="5" height="16" rx="2" fill="white"/>
            <rect x="2"   y="7.5" width="16" height="5" rx="2" fill="white"/>
          </svg>
        </div>
      )}

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