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
    const t1 = setTimeout(() => setPhase("fadeout"), 2400);
    const t2 = setTimeout(() => {
      setPhase("done");
      sessionStorage.setItem("nexis:intro-seen", "1");
    }, 2900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase === "done") return <>{children}</>;

  return (
    <>
      <style>{`
        @keyframes nx-logo {
          0%   { opacity: 0; transform: scale(0.6); filter: blur(12px); }
          40%  { opacity: 1; transform: scale(1.02); filter: blur(0); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes nx-text {
          0%   { opacity: 0; transform: translateY(16px); }
          40%  { opacity: 0; transform: translateY(16px); }
          70%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes nx-glow {
          0%   { opacity: 0; }
          50%  { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
        @keyframes nx-out {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0d0f14 0%, #121826 100%)",
          animation: phase === "fadeout" ? "nx-out 500ms ease-in-out forwards" : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(58,141,255,0.15) 0%, transparent 70%)",
            animation: "nx-glow 2400ms ease-in-out forwards",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, position: "relative" }}>
          <Image
            src="/logo.png"
            alt="Nexis"
            width={140}
            height={140}
            priority
            style={{
              animation: "nx-logo 2000ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
              filter: "drop-shadow(0 0 40px rgba(58,141,255,0.4))",
            }}
          />
          <h1
            style={{
              animation: "nx-text 2000ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #3a8dff, #4f5dff, #8a5cff, #c86bff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Nexis
          </h1>
        </div>
      </div>
      <div style={{ visibility: "hidden" }}>{children}</div>
    </>
  );
}
