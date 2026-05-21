"use client";

export function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-pragma-gradient-subtle" />
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-pragma-cyan/15 blur-3xl" />
      <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-pragma-electric/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-pragma-aqua/10 blur-3xl" />
    </div>
  );
}
