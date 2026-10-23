import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getProduct, getSettings, toCard } from "@/lib/store";
import { imageUrl } from "@/lib/catalog";
import { ProductDetail } from "@/components/store/ProductDetail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: "Product" };
  const card = toCard(p);
  return {
    title: p.name,
    description: p.description ?? `Buy ${p.name} online from Vaishnavi Store with home delivery.`,
    openGraph: card?.image ? { images: [card.image] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const [p, categories, s] = await Promise.all([getProduct(id), getCategories(), getSettings()]);
  if (!p) notFound();
  const cat = categories.find((c) => c.id === p.category_id);
  if (!cat) notFound(); // hidden category → product not sold
  const card = toCard(p);
  if (!card) notFound();

  const images = [...p.product_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => imageUrl(i.storage_path))
    .filter((x): x is string => Boolean(x));

  return (
    <div className="space-y-4">
      <nav className="text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href="/" className="underline">Home</Link> › <Link href={`/c/${cat.slug}`} className="underline">{cat.name}</Link>
      </nav>
      <ProductDetail product={card} images={images} whatsapp={s?.whatsapp_number ? `https://wa.me/91${s.whatsapp_number}` : null} />
      {p.description && (
        <section className="card">
          <h2 className="mb-1 font-semibold">About this product</h2>
          <p className="whitespace-pre-line text-sm text-neutral-700">{p.description}</p>
        </section>
      )}
    </div>
  );
}
