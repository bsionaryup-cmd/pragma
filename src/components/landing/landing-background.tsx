export function LandingBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-white"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,#E9ECEF_1px,transparent_1px),linear-gradient(to_bottom,#E9ECEF_1px,transparent_1px)] bg-[size:72px_72px] opacity-40 [mask-image:radial-gradient(ellipse_90%_60%_at_50%_0%,#000_50%,transparent_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed top-0 right-0 -z-10 h-[480px] w-[480px] rounded-full bg-[#0E9F8D]/8 blur-[100px]"
        aria-hidden
      />
    </>
  );
}
