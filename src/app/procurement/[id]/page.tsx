import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getProductById, listVendorsForProduct } from "@/lib/procurement";
import ProductDetailClient from "@/components/procurement/ProductDetailClient";

export default async function ProcurementProductPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "user") redirect("/");

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const product = await getProductById(id);
  if (!product) notFound();

  const vendors = await listVendorsForProduct(id);

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-6">
      <ProductDetailClient product={product} vendors={vendors} />
    </main>
  );
}
