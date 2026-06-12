import { useCart } from "../context/CartContext";
import { useNav } from "../context/NavContext";
import { PazeButton, type PazeCompletionResult } from "./PazeButton";

export function Checkout() {
	const { items, subtotal, itemCount, clear } = useCart();
	const { setView, goHome } = useNav();

	const shipping = subtotal > 35 ? 0 : 5.99;
	const tax = +(subtotal * 0.086).toFixed(2);
	const total = +(subtotal + shipping + tax).toFixed(2);

	if (items.length === 0) {
		return (
			<main className="jp-main">
				<div className="jp-empty">
					<h2>Nothing to check out</h2>
					<p>Your cart is empty.</p>
					<button className="jp-btn jp-btn--primary" onClick={goHome}>
						Continue shopping
					</button>
				</div>
			</main>
		);
	}

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
			<h2 style={{ margin: "8px 4px 14px" }}>Checkout</h2>
			<div className="jp-checkout-grid">
				<div>
					<div className="jp-section">
						<h3>1 · Review items</h3>
						{items.map(({ product, quantity }) => (
							<div
								key={product.id}
								style={{
									display: "flex",
									justifyContent: "space-between",
									padding: "6px 0",
									borderBottom: "1px solid var(--jp-border)",
								}}
							>
								<span>
									{product.image} {product.title} × {quantity}
								</span>
								<span>${(product.price * quantity).toFixed(2)}</span>
							</div>
						))}
					</div>

					<div className="jp-section">
						<h3>2 · Payment</h3>
						<p style={{ color: "var(--jp-text-muted)", marginTop: 0 }}>
							Paze is an online checkout experience that makes it easy for you
							to make purchases. Offered by participating banks and credit
							unions.
						</p>

						<PazeButton
							email=""
							mobileNumber=""
							subtotal={subtotal}
							tax={tax}
							shipping={shipping}
							total={total}
							onComplete={onPaymentComplete}
						/>
					</div>
				</div>

				<aside className="jp-panel" style={{ height: "fit-content" }}>
					<h2 style={{ fontSize: 18 }}>Order Summary</h2>
					<div className="jp-summary-row">
						<span>Items ({itemCount}):</span>
						<span>${subtotal.toFixed(2)}</span>
					</div>
					<div className="jp-summary-row">
						<span>Shipping:</span>
						<span>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
					</div>
					<div className="jp-summary-row">
						<span>Estimated tax:</span>
						<span>${tax.toFixed(2)}</span>
					</div>
					<div className="jp-summary-row jp-summary-row--total">
						<span>Order total:</span>
						<span>${total.toFixed(2)}</span>
					</div>
				</aside>
			</div>
		</main>
	);
}
