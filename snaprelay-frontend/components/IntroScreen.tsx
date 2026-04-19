"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function IntroScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fade" | "done">(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("nexis:intro-seen")) {
      return "done";
    }
    return "show";
  });

  useEffect(() => {
    if (phase !== "show") return;
    const t1 = setTimeout(() => setPhase("fade"), 2000);
    const t2 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("nexis:intro-seen", "1");
    }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase === "done") return <>{children}</>;

  return (
    <>
      <style>{`
        @keyframes nx-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {/* Intro overlay — fades out */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "#0d0f14",
          opacity: phase === "fade" ? 0 : 1,
          transition: "opacity 1s ease",
          pointerEvents: phase === "fade" ? "none" : "auto",
        }}
      >
        <Image
          src="/logo.png"
          alt="Nexis"
          width={140}
          height={140}
          priority
          style={{ animation: "nx-in 0.8s ease-out forwards" }}
        />
        <span
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            animation: "nx-in 0.8s ease-out 0.3s forwards",
            opacity: 0,
          }}
        >
          Nexis
        </span>
      </div>
      {/* Children underneath — fade in as overlay fades out */}
      <div
        style={{
          opacity: phase === "fade" ? 1 : 0,
          transition: "opacity 1s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
