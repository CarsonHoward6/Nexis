import Image from "next/image";

export function Logo({ size = 28 }: { size?: number }) {
  const textSize = size >= 64 ? "text-3xl" : size >= 40 ? "text-xl" : "text-lg";

  return (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="Nexis"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
      <span
        className={`${textSize} font-semibold tracking-tight`}
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
