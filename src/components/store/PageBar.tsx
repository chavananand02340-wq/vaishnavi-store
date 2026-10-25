import Link from "next/link";
import { Icon } from "@/components/Icon";

/** Slim top bar for cart, checkout and order pages. */
export function PageBar({ title, back = "/", right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-700 text-white">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-2">
        <Link href={back} className="flex size-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Back">
          <Icon name="left" className="size-6" strokeWidth={2.4} />
        </Link>
        <h1 className="flex-1 font-display text-[19px] font-bold">{title}</h1>
        {right}
      </div>
    </header>
  );
}
