"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function IntroScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"intro" | "fadeout" | "done">(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("nexis:intro-seen")) {
      return "done";
    }
    return "intro";
  });

  useEffect(() => {
    if (phase !== "intro") return;
    const t1 = setTimeout(() => setPhase("fadeout"), 2200);
    const t2 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("nexis:intro-seen", "1");
    }, 2700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase === "done") return <>{children}</>;

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-[100] flex flex-col items-center justify-center",
          "bg-gradient-to-b from-[#0d0f14] to-[#121826]",
          phase === "fadeout" ? "animate-[intro-fade-out_500ms_ease-in-out_forwards]" : "",
        ].join(" ")}
      >
        <div className="flex flex-col items-center gap-6">
          <Image
            src="/logo.png"
            alt="Nexis"
            width={120}
            height={120}
            priority
            className="animate-[intro-logo_2200ms_ease-in-out_forwards] drop-shadow-[0_0_40px_rgba(58,141,255,0.3)]"
          />
          <h1
            className="animate-[intro-text_2200ms_ease-in-out_forwards] text-3xl font-bold tracking-tight"
            style={{
              background: "var(--gradient-brand)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Nexis
          </h1>
        </div>
      </div>
      <div className="invisible">{children}</div>
    </>
  );
}
