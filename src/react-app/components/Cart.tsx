import { useCart } from "../context/CartContext";
import { useNav } from "../context/NavContext";
import { PazeButton, type PazeCompletionResult } from "./PazeButton";

export function Cart() {
	const { items, subtotal, itemCount, updateQuantity, removeItem, clear } =
		useCart();
	const { setView, goHome } = useNav();

	if (items.length === 0) {
		return (
			<main className="jp-main">
				<div className="jp-empty">
					<h2>Your Jimporium Cart is empty</h2>
					<p>Add some Knarr-tested goods.</p>
					<button className="jp-btn jp-btn--primary" onClick={goHome}>
						Shop now
					</button>
				</div>
			</main>
		);
	}

	const shipping = subtotal > 35 ? 0 : 5.99;
	const tax = +(subtotal * 0.086).toFixed(2);
	const total = +(subtotal + shipping + tax).toFixed(2);

	const onPaymentComplete = (result: PazeCompletionResult) => {
		clear();
		setView({
			name: "confirmation",
			orderId: result.orderId,
			cardBrand: result.cardBrand,
			panLastFour: result.panLastFour,
			buyerName: result.buyerName,
		});
	};

	return (
		<main className="jp-main">
			<div className="jp-page">
				<section className="jp-panel">
					<h2>Shopping Cart</h2>
					<p style={{ color: "var(--jp-text-muted)" }}>Price</p>
					{items.map(({ product, quantity }) => (
						<div key={product.id} className="jp-cart-row">
							<div className="jp-cart-row__img">{product.image}</div>
							<div>
								<h3 className="jp-cart-row__title">{product.title}</h3>
								<div style={{ color: "var(--jp-success)", fontSize: 13 }}>
									In Stock
								</div>
								{product.prime && (
									<div style={{ color: "#007185", fontSize: 13 }}>
										✓ prime FREE delivery
									</div>
								)}
								<div className="jp-cart-row__controls">
									<label>
										Qty:{" "}
										<select
											value={quantity}
											onChange={(e) =>
												updateQuantity(product.id, Number(e.target.value))
											}
										>
											{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
												<option key={n} value={n}>
													{n}
												</option>
											))}
										</select>
									</label>
									<span>|</span>
									<button
										className="jp-link"
										onClick={() => removeItem(product.id)}
									>
										Delete
									</button>
								</div>
							</div>
							<div className="jp-cart-row__price">
								${(product.price * quantity).toFixed(2)}
							</div>
						</div>
					))}
					<div className="jp-subtotal" style={{ textAlign: "right" }}>
						Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}):{" "}
						<strong>${subtotal.toFixed(2)}</strong>
					</div>
				</section>

				<aside className="jp-panel">
					<div className="jp-subtotal">
						Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"}):{" "}
						<strong>${subtotal.toFixed(2)}</strong>
					</div>
					<button
						className="jp-btn jp-btn--primary"
						style={{ marginTop: 14 }}
						onClick={() => setView({ name: "checkout" })}
					>
						Proceed to checkout
					</button>

					<div
						style={{
							margin: "14px 0 6px",
							textAlign: "center",
							color: "var(--jp-text-muted)",
							fontSize: 12,
						}}
					>
						— or —
					</div>

					<PazeButton
						email=""
						mobileNumber=""
						subtotal={subtotal}
						tax={tax}
						shipping={shipping}
						total={total}
						onComplete={onPaymentComplete}
					/>
				</aside>
			</div>
		</main>
	);
}
