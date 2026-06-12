import type { Product } from "../types";
import { useNav } from "../context/NavContext";
import { Stars } from "./Stars";

export function ProductCard({ product }: { product: Product }) {
	const { setView } = useNav();
	const dollars = Math.floor(product.price);
	const cents = Math.round((product.price - dollars) * 100)
		.toString()
		.padStart(2, "0");

	return (
		<article
			className="jp-card"
			onClick={() => setView({ name: "product", productId: product.id })}
		>
			<div className="jp-card__img" aria-hidden>
				{product.image}
			</div>
			<h3 className="jp-card__title">{product.title}</h3>
			<div className="jp-card__rating">
				<Stars rating={product.rating} />
				<span>{product.reviewCount.toLocaleString()}</span>
			</div>
			<div className="jp-card__price">
				<span className="currency">$</span>
				{dollars}
				<span style={{ fontSize: 13 }}>.{cents}</span>
			</div>
			{product.prime && (
				<div className="jp-card__prime">✓ prime FREE delivery</div>
			)}
		</article>
	);
}
