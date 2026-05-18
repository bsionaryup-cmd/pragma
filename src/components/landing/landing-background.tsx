export function LandingBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[#09090b]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed top-0 left-1/2 -z-10 h-[520px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed right-0 bottom-0 -z-10 h-[400px] w-[500px] rounded-full bg-blue-600/8 blur-[100px]"
        aria-hidden
      />
    </>
  );
}

