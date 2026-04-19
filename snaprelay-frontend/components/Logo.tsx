import Image from "next/image";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="Nexis"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
      <span
        className="text-lg font-semibold tracking-tight"
        style={{
          background: "var(--gradient-brand)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Nexis
      </span>
    </div>
  );
}
