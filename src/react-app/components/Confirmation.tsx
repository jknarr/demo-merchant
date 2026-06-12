import { useNav } from "../context/NavContext";

export function Confirmation({
	orderId,
	cardBrand,
	panLastFour,
	buyerName,
}: {
	orderId: string;
	cardBrand?: string;
	panLastFour?: string;
	buyerName?: string;
}) {
	const { goHome } = useNav();
	const cardLine =
		cardBrand || panLastFour
			? `${cardBrand ?? "Card"}${panLastFour ? ` ending in ${panLastFour}` : ""}`
			: null;
	const firstName = buyerName?.trim().split(/\s+/)[0];
	const greeting = firstName ? `Thanks, ${firstName}.` : "Thanks for your order.";

	return (
		<main className="jp-main">
			<div className="jp-confirm">
				<h2>✓ Order placed</h2>
				<p>
					{greeting} Your order <strong>{orderId}</strong> is on its way.
				</p>

				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 10,
						marginTop: 10,
						padding: "10px 16px",
						background: "#f3f7ff",
						border: "1px solid #c6d6f0",
						borderRadius: 8,
					}}
				>
					<span
						aria-label="Paze"
						style={{
							background: "#1a3a6e",
							color: "#fff",
							fontWeight: 700,
							borderRadius: 4,
							padding: "4px 10px",
							letterSpacing: 0.5,
						}}
					>
						Paze
					</span>
					{cardLine && (
						<span style={{ fontWeight: 600, color: "#1a3a6e" }}>
							{cardLine}
						</span>
					)}
				</div>

				<p style={{ color: "var(--jp-text-muted)", marginTop: 18 }}>
					A confirmation has been sent to your email. (Just kidding — this is a
					demo.)
				</p>
				<button className="jp-btn jp-btn--primary" onClick={goHome}>
					Continue shopping
				</button>
			</div>
		</main>
	);
}
