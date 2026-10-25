import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProduct } from "@/lib/store-data";
import { toCard } from "@/lib/cards";
import { imageUrl } from "@/lib/catalog";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductDetail } from "@/components/store/ProductDetail";
import { Icon } from "@/components/Icon";

type Props = { params: Promise<{ id: string }> };

// Built on first visit, then served from the CDN.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: "Product" };
  const card = toCard(p);
  return {
    title: p.name,
    description: p.description ?? `Order ${p.name} from Vaishnavi Store for home delivery.`,
    openGraph: card?.image ? { images: [card.image] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [p, categories] = await Promise.all([getProduct(id), getCategories()]);
  if (!p) notFound();
  const cat = categories.find((c) => c.id === p.category_id);
  const card = toCard(p);
  if (!cat || !card) notFound();

  const images = [...p.product_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => imageUrl(i.storage_path))
    .filter((x): x is string => Boolean(x));

  return (
    <>
      <StoreHeader compact />
      <main className="mx-auto w-full max-w-6xl px-4 pt-3">
        <Link href={`/c/${cat.slug}`} className="mb-3 inline-flex items-center gap-1 text-[15px] font-semibold text-brand-700">
          <Icon name="left" className="size-4" strokeWidth={2.6} /> {cat.name}
        </Link>
        <ProductDetail product={card} images={images} description={p.description} />
      </main>
    </>
  );
}
