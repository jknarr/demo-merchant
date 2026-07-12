import { useEffect, useState } from "react";
import type {
	PazeDecryptionEvidence,
	PazePaymentDisplay,
} from "../../shared/paze-payment";
import { useNav } from "../context/NavContext";

type EvidenceResponse = {
	payment_attached_at: string;
	evidence: PazeDecryptionEvidence;
};

type OrderLineItem = {
	id?: string;
	item?: {
		id?: string;
		title?: string;
		price?: number;
		image_url?: string;
	};
	quantity?: number;
	totals?: Array<{ type: string; amount: number }>;
};

type OrderResponse = {
	id: string;
	currency: string;
	completed_at?: string;
	line_items: OrderLineItem[];
	totals: Array<{ type: string; amount: number; display_text?: string }>;
	payment?: {
		handler: string;
		display: PazePaymentDisplay;
	};
	payment_evidence?: EvidenceResponse;
};

function formatMoney(amount: number, currency: string): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

function formatCompletedAt(value?: string): string {
	if (!value) return "Not available";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "long",
		timeStyle: "short",
	}).format(date);
}

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
	const [order, setOrder] = useState<OrderResponse | null>(null);
	const [orderChecked, setOrderChecked] = useState(false);

	useEffect(() => {
		fetch(`/orders/${encodeURIComponent(orderId)}`, {
			headers: { accept: "application/json" },
		})
			.then(async (response) => {
				if (response.status === 404) return null;
				if (!response.ok) throw new Error(`Evidence API returned ${response.status}`);
				return (await response.json()) as OrderResponse;
			})
			.then(setOrder)
			.catch((error) => console.warn("Unable to load order details", error))
			.finally(() => setOrderChecked(true));
	}, [orderId]);
	const evidence = order?.payment_evidence ?? null;
	const paymentDisplay = order?.payment?.display;
	const resolvedCardBrand = cardBrand ?? paymentDisplay?.card_network;
	const resolvedPanLastFour = panLastFour ?? paymentDisplay?.pan_last_four;
	const resolvedBuyerName = buyerName ?? paymentDisplay?.buyer_name;
	const cardLine =
		resolvedCardBrand || resolvedPanLastFour
			? `${resolvedCardBrand ?? "Card"}${resolvedPanLastFour ? ` ending in ${resolvedPanLastFour}` : ""}`
			: null;
	const firstName = resolvedBuyerName?.trim().split(/\s+/)[0];
	const greeting = firstName ? `Thanks, ${firstName}.` : "Thanks for your order.";

	return (
		<main className="jp-main">
			<div className="jp-confirm">
				<h2>✓ Order placed</h2>
				<p>
					{greeting} Your order <strong>{orderId}</strong> is on its way.
				</p>

				{order && (
					<section className="jp-confirm__details" aria-labelledby="order-details-heading">
						<div className="jp-confirm__details-header">
							<div>
								<span className="jp-confirm__eyebrow">Order details</span>
								<h3 id="order-details-heading">What you purchased</h3>
							</div>
							<div className="jp-confirm__completed">
								<span>Completed</span>
								<strong>{formatCompletedAt(order.completed_at)}</strong>
							</div>
						</div>
						<div className="jp-confirm__items">
							{order.line_items.map((line, index) => {
								const quantity = line.quantity ?? 1;
								const lineTotal =
									line.totals?.find((total) => total.type === "total")?.amount ??
									(line.item?.price ?? 0) * quantity;
								return (
									<div className="jp-confirm__item" key={line.id ?? `${line.item?.id}-${index}`}>
										<span className="jp-confirm__item-image" aria-hidden="true">
											{line.item?.image_url ?? "📦"}
										</span>
										<div>
											<strong>{line.item?.title ?? "Jimporium item"}</strong>
											<span>Quantity: {quantity}</span>
										</div>
										<strong>{formatMoney(lineTotal, order.currency)}</strong>
									</div>
								);
							})}
						</div>
						<div className="jp-confirm__total">
							<span>Order total</span>
							<strong>
								{formatMoney(
									order.totals.find((total) => total.type === "total")?.amount ?? 0,
									order.currency,
								)}
							</strong>
						</div>
					</section>
				)}
				{!order && !orderChecked && (
					<p style={{ color: "var(--jp-text-muted)" }}>Loading order details…</p>
				)}

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
					You can continue shopping or review the payment-processing evidence
					below.
				</p>

				{evidence && (
					<section
						style={{
							margin: "24px auto",
							maxWidth: 760,
							textAlign: "left",
							border: "1px solid #c6d6f0",
							borderRadius: 12,
							overflow: "hidden",
						}}
					>
						<div style={{ padding: 16, background: "#f3f7ff" }}>
							<strong>Merchant-side Paze payload evidence</strong>
							<p style={{ margin: "6px 0 0", color: "var(--jp-text-muted)" }}>
								This view was generated by Jimporium after securely processing the
								payment. Tokens and cryptograms are redacted.
							</p>
						</div>
						<div style={{ padding: 16 }}>
							<div>Status: <strong>{evidence.evidence.status}</strong></div>
							<div>Complete response verified: {String(evidence.evidence.complete_response_verified)}</div>
							<div>Secure payload decrypted: {String(evidence.evidence.secure_payload_decrypted)}</div>
							<div>Inner payload verified: {String(evidence.evidence.inner_payload_verified)}</div>
							<div>Business identity verified: {String(evidence.evidence.business_identity_verified)}</div>
							<div>JWE: {evidence.evidence.jwe_alg ?? "—"} / {evidence.evidence.jwe_enc ?? "—"}</div>
							{evidence.evidence.error && (
								<p style={{ color: "#b12704" }}>{evidence.evidence.error}</p>
							)}
							{evidence.evidence.redacted_payload && (
								<pre
									style={{
										marginTop: 14,
										padding: 14,
										borderRadius: 8,
										background: "#101828",
										color: "#e6edf7",
										overflowX: "auto",
										fontSize: 12,
									}}
								>
									{JSON.stringify(evidence.evidence.redacted_payload, null, 2)}
								</pre>
							)}
						</div>
					</section>
				)}
				<button className="jp-btn jp-btn--primary" onClick={goHome}>
					Continue shopping
				</button>
			</div>
		</main>
	);
}
