import { useNav } from "../context/NavContext";
import { PRODUCTS } from "../data/products";
import { ProductCard } from "./ProductCard";

export function Home() {
	const { category, query } = useNav();

	const filtered = PRODUCTS.filter((p) => {
		const inCategory = category === "All" || p.category === category;
		const q = query.trim().toLowerCase();
		const inQuery =
			!q ||
			p.title.toLowerCase().includes(q) ||
			p.description.toLowerCase().includes(q) ||
			p.category.toLowerCase().includes(q);
		return inCategory && inQuery;
	});

	return (
		<>
			<section className="jp-hero">
				<h1>
					Welcome to Jim<span style={{ color: "var(--jp-orange)" }}>porium</span>
				</h1>
				<p>
					Knarr-tested deals. Lightning-fast shipping. Now offering Paze® at
					checkout.
				</p>
			</section>

			<main className="jp-main">
				<h2 style={{ margin: "8px 4px 14px" }}>
					{category === "All" ? "Featured for you" : category}
					{query ? ` · “${query}”` : ""}
				</h2>
				{filtered.length === 0 ? (
					<div className="jp-empty">
						<h2>No results</h2>
						<p>Try a different search or category.</p>
					</div>
				) : (
					<div className="jp-grid">
						{filtered.map((p) => (
							<ProductCard key={p.id} product={p} />
						))}
					</div>
				)}
			</main>
		</>
	);
}
