import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listProducts } from "@/lib/procurement";
import ProcurementListClient from "@/components/procurement/ProcurementListClient";

export default async function ProcurementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "user") redirect("/");

  const products = await listProducts();

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 py-6">
      <a href="/" className="text-sm text-black/50 dark:text-white/50 hover:underline">
        ← Back to calendar
      </a>
      <div className="mt-3">
        <ProcurementListClient products={products} />
      </div>
    </main>
  );
}
