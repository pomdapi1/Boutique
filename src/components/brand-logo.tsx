import { cn } from "@/lib/utils";

export const BRAND_NAME = "Les Songes Créatifs";

/** Logo texte, dans l'esprit du logo officiel : nom en serif + « Boutique de créateurs ». */
export function BrandLogo({
  tone = "light",
  size = "md",
  className,
}: {
  tone?: "light" | "dark";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col leading-none", size === "lg" && "items-center", className)}>
      <span
        className={cn(
          "font-brand font-semibold tracking-tight whitespace-nowrap",
          size === "lg" ? "text-[2rem] sm:text-[2.6rem]" : "text-[1.7rem]",
          tone === "dark" ? "text-sage-50" : "text-ink",
        )}
      >
        {BRAND_NAME}
      </span>
      <span
        className={cn(
          "mt-1.5 font-sans font-medium tracking-[0.28em] uppercase",
          size === "lg" ? "text-xs" : "text-[0.6rem]",
          tone === "dark" ? "text-sage-300" : "text-sage-600",
        )}
      >
        Boutique de créateurs
      </span>
    </span>
  );
}
