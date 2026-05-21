import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  inverted?: boolean;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  inverted = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        align === "center" && "mx-auto max-w-3xl text-center",
        className,
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.2em]",
          inverted ? "text-pragma-cyan" : "text-pragma-electric",
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "font-heading mt-3 text-3xl font-bold tracking-tight md:text-4xl",
          inverted ? "text-white" : "text-pragma-black",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            inverted ? "text-white/70" : "text-pragma-mid-gray",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
