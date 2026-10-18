import React from "react";

// Marca de ValoraCloud: una C abierta con un visto. Decorativa: el nombre
// accesible lo aporta el texto de BrandLogo. La C usa currentColor (el color
// de marca lo fija quien la dibuja) y el visto, --color-logo-accent.
function BrandMark({ size = 40, className = "" }) {
  return (
    <svg
      className={["brand-mark", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M46.15 19.38A20.5 20.5 0 1 0 46.15 44.62"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M20.5 32.5L28 40 40.5 23.5"
        stroke="var(--color-logo-accent)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default BrandMark;
