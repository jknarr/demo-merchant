import { useState } from "react";
import { useCart } from "../context/CartContext";
import { useNav } from "../context/NavContext";
import { getProductById } from "../data/products";
import { Stars } from "./Stars";

export function ProductDetail({ productId }: { productId: string }) {
	const product = getProductById(productId);
	const { addItem } = useCart();
	const { setView, goHome } = useNav();
	const [qty, setQty] = useState(1);

	if (!product) {
		return (
			<main className="jp-main">
				<div className="jp-empty">
					<h2>Product not found</h2>
					<button className="jp-btn" onClick={goHome}>
						Back to home
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="jp-main">
			<div className="jp-detail">
				<div className="jp-detail__img" aria-hidden>
					{product.image}
				</div>

				<div className="jp-detail__info">
					<h2>{product.title}</h2>
					<div className="rating-row">
						<Stars rating={product.rating} />
						<span>{product.reviewCount.toLocaleString()} ratings</span>
					</div>
					<hr />
					<div className="jp-detail__price">${product.price.toFixed(2)}</div>
					{product.prime && (
						<p style={{ color: "#007185", fontWeight: 600 }}>
							✓ prime · FREE delivery tomorrow
						</p>
					)}
					<hr />
					<h3 style={{ margin: "0 0 6px 0" }}>About this item</h3>
					<p style={{ color: "var(--jp-text-muted)" }}>{product.description}</p>
				</div>

				<aside className="jp-detail__buybox">
					<div className="jp-detail__price">${product.price.toFixed(2)}</div>
					<p className="stock">In Stock</p>
					<label htmlFor="qty" style={{ fontSize: 13 }}>
						Quantity:
					</label>
					<select
						id="qty"
						value={qty}
						onChange={(e) => setQty(Number(e.target.value))}
					>
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</select>
					<button
						className="jp-btn"
						onClick={() => {
							addItem(product, qty);
							setView({ name: "cart" });
						}}
					>
						Add to Cart
					</button>
					<button
						className="jp-btn jp-btn--primary"
						onClick={() => {
							addItem(product, qty);
							setView({ name: "checkout" });
						}}
					>
						Buy Now
					</button>
				</aside>
			</div>
		</main>
	);
}
