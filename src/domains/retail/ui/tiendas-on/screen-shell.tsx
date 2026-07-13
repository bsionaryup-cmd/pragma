import { TiendasOnScreenFooter } from "./screen-footer";
import { TiendasOnScreenHeader } from "./screen-header";

export function TiendasOnScreen({
  title,
  backHref,
  children,
  fullHeight,
  storeCode,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
  fullHeight?: boolean;
  storeCode?: string;
}) {
  return (
    <div
      className={
        fullHeight
          ? "flex min-h-dvh flex-col bg-[#eef1f4]"
          : "flex min-h-dvh flex-col bg-[#eef1f4]"
      }
    >
      <TiendasOnScreenHeader title={title} backHref={backHref} />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      <TiendasOnScreenFooter storeCode={storeCode} />
    </div>
  );
}
