export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect x="2" y="6" width="20" height="16" rx="4" fill="var(--accent)" />
        <rect
          x="10"
          y="10"
          width="20"
          height="16"
          rx="4"
          fill="var(--accent-secondary)"
          fillOpacity="0.9"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Nexis</span>
    </div>
  );
}
