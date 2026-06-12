import { useCallback, useEffect, useRef, useState } from "react";
import {
	canPazeCheckout,
	getResolvedPazeSdk,
	initializePaze,
	pazeConfigSummary,
	type PazeSdk,
	type TransactionValue,
} from "../paze/paze";

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"paze-button": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement> & {
					color?: string;
					shape?: string;
					label?: string;
					disableMaxHeight?: string;
				},
				HTMLElement
			>;
		}
	}
}

type DecodedAddress = {
	name?: string;
	line1?: string;
	line2?: string;
	line3?: string;
	city?: string;
	state?: string;
	zip?: string;
	countryCode?: string;
};

type DecodedConsumer = {
	firstName?: string;
	lastName?: string;
	fullName?: string;
	emailAddress?: string;
};

type DecodedMaskedCard = {
	panLastFour?: string;
	paymentCardBrand?: string;
	paymentCardType?: string;
	paymentCardDescriptor?: string;
	billingAddress?: DecodedAddress;
};

type DecodedCheckoutPayload = {
	sessionId?: string;
	consumer?: DecodedConsumer;
	maskedCard?: DecodedMaskedCard;
	shippingAddress?: DecodedAddress;
};

type Status =
	| { kind: "idle" }
	| { kind: "loading"; message: string }
	| { kind: "info"; message: string }
	| {
			kind: "reviewing";
			checkoutJws: string;
			decoded: DecodedCheckoutPayload;
	  }
	| { kind: "completing"; message: string }
	| { kind: "error"; message: string }
	| { kind: "success"; message: string };

const CAN_CHECKOUT_DEBOUNCE_MS = 300;

// US phone numbers accepted by Paze: 10 digits, or 11 digits starting with 1.
function isValidUSMobile(digits: string): boolean {
	if (digits.length === 10) return true;
	if (digits.length === 11 && digits.startsWith("1")) return true;
	return false;
}

// Loose RFC 5322 sanity check — Paze rejects malformed addresses upstream.
function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function base64UrlDecode(input: string): string {
	const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
	const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
	return atob(b64);
}

function decodeJwsPayload(jws: string): DecodedCheckoutPayload | null {
	const parts = jws.split(".");
	if (parts.length < 2) return null;
	try {
		const json = base64UrlDecode(parts[1]);
		return JSON.parse(json) as DecodedCheckoutPayload;
	} catch (err) {
		console.warn("[paze] failed to decode checkoutResponse JWS:", err);
		return null;
	}
}

function formatAddress(addr?: DecodedAddress): string {
	if (!addr) return "";
	const parts = [
		addr.name,
		addr.line1,
		addr.line2,
		addr.line3,
		[addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
		addr.countryCode,
	].filter(Boolean);
	return parts.join(" · ");
}

export type PazeCompletionResult = {
	orderId: string;
	cardBrand?: string;
	panLastFour?: string;
	buyerName?: string;
};

export function PazeButton({
	email,
	mobileNumber,
	subtotal,
	tax,
	shipping,
	total,
	onComplete,
}: {
	email: string;
	mobileNumber: string;
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	onComplete: (result: PazeCompletionResult) => void;
}) {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [ready, setReady] = useState(false);
	const [walletDetected, setWalletDetected] = useState<boolean | null>(null);
	const sessionIdRef = useRef<string>(`JIM-${Date.now()}`);
	const buttonRef = useRef<HTMLElement | null>(null);
	const sdkRef = useRef<PazeSdk | null>(null);

	const normalizedEmail = email.trim().toLowerCase();
	const normalizedMobile = mobileNumber.replace(/[^\d]/g, "");
	const mobileValid = normalizedMobile.length > 0 && isValidUSMobile(normalizedMobile);
	const emailValid = normalizedEmail.length > 0 && isValidEmail(normalizedEmail);
	// Include every lookup key that's syntactically valid. Anything malformed
	// or empty is omitted; if neither is provided, no lookup is sent and
	// Paze collects the identifier inside its own popup.
	const lookup: { emailAddress?: string; mobileNumber?: string } | null = (() => {
		const out: { emailAddress?: string; mobileNumber?: string } = {};
		if (mobileValid) out.mobileNumber = normalizedMobile;
		if (emailValid) out.emailAddress = normalizedEmail;
		return Object.keys(out).length > 0 ? out : null;
	})();
	const lookupLabel =
		[
			mobileValid ? normalizedMobile : null,
			emailValid ? normalizedEmail : null,
		]
			.filter(Boolean)
			.join(" / ") || "(no lookup — Paze will ask)";

	useEffect(() => {
		let cancelled = false;
		const existing = getResolvedPazeSdk();
		if (existing) {
			sdkRef.current = existing;
			setReady(true);
			return;
		}
		initializePaze()
			.then((sdk) => {
				if (!cancelled) {
					sdkRef.current = sdk;
					setReady(true);
				}
			})
			.catch((err: Error) => {
				if (!cancelled) {
					setStatus({
						kind: "error",
						message: `Failed to initialize Paze SDK: ${err.message}`,
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!ready || !lookup) {
			setWalletDetected(null);
			return;
		}
		let cancelled = false;
		const timer = window.setTimeout(() => {
			canPazeCheckout(lookup).then((ok) => {
				if (!cancelled) setWalletDetected(ok);
			});
		}, CAN_CHECKOUT_DEBOUNCE_MS);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [ready, lookup?.emailAddress, lookup?.mobileNumber]);

	// Per Paze SDK: transactionAmount must equal subtotal - discountAmount
	// (merchandise total, before tax/shipping). Tax and shipping are sent
	// as separate line items and the SDK displays them broken out.
	const txnValue: TransactionValue = {
		transactionCurrencyCode: "USD",
		transactionAmount: subtotal.toFixed(2),
		subtotal: subtotal.toFixed(2),
		taxAmount: tax.toFixed(2),
		shippingAmount: shipping.toFixed(2),
	};

	// CRITICAL: keep this handler synchronous up to and including the
	// sdk.checkout() call. Any `await` before sdk.checkout() yields a
	// microtask and breaks the user-gesture chain, causing the SDK's
	// popup to be blocked.
	const handleClick = useCallback(() => {
		const sdk = sdkRef.current;
		if (!sdk) {
			setStatus({
				kind: "error",
				message: "Paze SDK not initialized yet. Try again in a moment.",
			});
			return;
		}

		const sessionId = sessionIdRef.current;
		setStatus({ kind: "loading", message: "Opening Paze..." });

		const checkoutPromise = sdk.checkout({
			...(lookup ?? {}),
			sessionId,
			actionCode: "START_FLOW",
			intent: "REVIEW_AND_PAY",
			transactionValue: txnValue,
			shippingPreference: "ALL",
			billingPreference: "ALL",
		});

		checkoutPromise
			.then((checkoutResp) => {
				console.log("[paze] checkout response:", checkoutResp);

				if (checkoutResp?.result !== "COMPLETE") {
					setStatus({
						kind: "info",
						message:
							`Paze returned ${checkoutResp?.result ?? "no result"} — no popup was shown. ` +
							"Per the docs this means the consumer was ineligible or cancelled. " +
							"Try a Paze-provided sandbox test wallet credential.",
					});
					return;
				}

				const jws = checkoutResp.checkoutResponse;
				if (!jws) {
					setStatus({
						kind: "error",
						message:
							"Paze returned COMPLETE but no checkoutResponse JWS was attached.",
					});
					return;
				}
				const decoded = decodeJwsPayload(jws) ?? {};
				console.log("[paze] decoded checkoutResponse payload:", decoded);
				setStatus({ kind: "reviewing", checkoutJws: jws, decoded });
			})
			.catch((err) => {
				const e = err as Error & { code?: string };
				console.error("[paze] checkout error:", e);
				setStatus({
					kind: "error",
					message: `Paze error${e.code ? ` (${e.code})` : ""}: ${e.message || String(err)}`,
				});
			});
	}, [
		lookup?.emailAddress,
		lookup?.mobileNumber,
		txnValue.transactionAmount,
		txnValue.taxAmount,
		txnValue.shippingAmount,
	]);

	const handleCompletePurchase = useCallback(async () => {
		const sdk = sdkRef.current;
		if (!sdk || status.kind !== "reviewing") return;
		const sessionId = sessionIdRef.current;
		const checkoutJws = status.checkoutJws;
		const card = status.decoded.maskedCard;
		const consumer = status.decoded.consumer;
		const buyerName =
			consumer?.fullName ||
			[consumer?.firstName, consumer?.lastName].filter(Boolean).join(" ") ||
			undefined;

		setStatus({ kind: "completing", message: "Completing purchase..." });
		try {
			const completeResp = await sdk.complete({
				transactionType: "PURCHASE",
				sessionId,
				transactionValue: txnValue,
				transactionOptions: {
					payloadTypeIndicator: "PAYMENT",
					billingPreference: "ALL",
				},
				enhancedTransactionData: {
					ecomData: {
						cartContainsGiftCard: false,
						orderForPickup: false,
					},
				},
			});
			console.log("[paze] complete response:", completeResp);

			const orderResp = await fetch("/api/orders", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					sessionId,
					amount: total,
					currency: "USD",
					emailAddress: normalizedEmail || undefined,
					mobileNumber: normalizedMobile || undefined,
					checkoutResponse: checkoutJws,
					completeResponse: completeResp,
				}),
			});
			if (!orderResp.ok) {
				throw new Error(`Order API returned ${orderResp.status}`);
			}
			const order = (await orderResp.json()) as { orderId: string };

			setStatus({
				kind: "success",
				message: `Order ${order.orderId} — $${total.toFixed(2)} confirmed via Paze.`,
			});
			onComplete({
				orderId: order.orderId,
				cardBrand: card?.paymentCardBrand,
				panLastFour: card?.panLastFour,
				buyerName,
			});
		} catch (err) {
			const e = err as Error & { code?: string };
			console.error("[paze] complete error:", e);
			setStatus({
				kind: "error",
				message: `Paze complete error${e.code ? ` (${e.code})` : ""}: ${e.message || String(err)}`,
			});
		}
	}, [status, txnValue, total, normalizedEmail, normalizedMobile, onComplete]);

	const handleCancelReview = useCallback(() => {
		setStatus({ kind: "idle" });
	}, []);

	// Wire the click handler and _onError callback to the <paze-button>
	// custom element. _onError surfaces lifecycle errors from the SDK.
	useEffect(() => {
		const btn = buttonRef.current as
			| (HTMLElement & {
					_onError?: (err: unknown, button: HTMLElement) => void;
			  })
			| null;
		if (!ready || !btn) return;
		btn.addEventListener("click", handleClick);
		btn._onError = (err) => {
			console.error("[paze] <paze-button> _onError:", err);
			const message =
				err && typeof err === "object" && "message" in err
					? String((err as { message: unknown }).message)
					: JSON.stringify(err);
			setStatus({
				kind: "error",
				message: `Paze button error: ${message}`,
			});
		};
		return () => btn.removeEventListener("click", handleClick);
	}, [ready, handleClick]);

	const showPazeButton =
		status.kind === "idle" ||
		status.kind === "loading" ||
		status.kind === "info" ||
		status.kind === "error";

	return (
		<div>
			{status.kind === "reviewing" && (
				<PazeReviewPanel
					decoded={status.decoded}
					subtotal={subtotal}
					tax={tax}
					shipping={shipping}
					total={total}
					onCompletePurchase={handleCompletePurchase}
					onCancel={handleCancelReview}
				/>
			)}

			{showPazeButton &&
				(ready ? (
					<paze-button
						ref={buttonRef as React.RefObject<HTMLElement>}
						color="pazeblue"
						shape="pill"
						label="checkout with"
					/>
				) : (
					<button className="jp-paze-btn" disabled aria-label="Loading Paze">
						<span className="jp-paze-btn__logo">Paze</span>
						<span>Loading…</span>
					</button>
				))}

			{status.kind === "idle" && walletDetected === true && (
				<div className="jp-paze-status jp-paze-status--ok">
					✓ Paze wallet detected for {lookupLabel}.
				</div>
			)}
			{status.kind === "idle" && walletDetected === false && lookup && (
				<div className="jp-paze-status">
					No Paze wallet detected for {lookupLabel} — clicking will still launch
					the Paze experience.
				</div>
			)}
			{status.kind === "loading" && (
				<div className="jp-paze-status">{status.message}</div>
			)}
			{status.kind === "completing" && (
				<div className="jp-paze-status">{status.message}</div>
			)}
			{status.kind === "info" && (
				<div className="jp-paze-status">{status.message}</div>
			)}
			{status.kind === "error" && (
				<div className="jp-paze-status jp-paze-status--err">
					{status.message}
				</div>
			)}
			{status.kind === "success" && (
				<div className="jp-paze-status jp-paze-status--ok">{status.message}</div>
			)}

			<details
				style={{
					marginTop: 10,
					fontSize: 12,
					color: "var(--jp-text-muted)",
				}}
			>
				<summary>Paze sandbox config</summary>
				<pre style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>
					{`clientId  : ${pazeConfigSummary.clientId}
profileId : ${pazeConfigSummary.profileId}
sdk       : ${pazeConfigSummary.sdkUrl}
sessionId : ${sessionIdRef.current}`}
				</pre>
			</details>
		</div>
	);
}

function PazeReviewPanel({
	decoded,
	subtotal,
	tax,
	shipping,
	total,
	onCompletePurchase,
	onCancel,
}: {
	decoded: DecodedCheckoutPayload;
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	onCompletePurchase: () => void;
	onCancel: () => void;
}) {
	const card = decoded.maskedCard;
	const ship = decoded.shippingAddress;
	const consumer = decoded.consumer;
	const cardLabel = card
		? `${card.paymentCardBrand ?? "Card"} ${card.paymentCardType ? `(${card.paymentCardType})` : ""} ending in ${card.panLastFour ?? "????"}`
		: "Selected Paze card";

	return (
		<div className="jp-paze-review">
			<h3 style={{ marginTop: 0 }}>Review your Paze payment</h3>

			<div className="jp-paze-review__row">
				<div className="jp-paze-review__label">Buyer</div>
				<div className="jp-paze-review__value">
					{consumer?.fullName ||
						[consumer?.firstName, consumer?.lastName]
							.filter(Boolean)
							.join(" ") ||
						"—"}
					{consumer?.emailAddress ? ` · ${consumer.emailAddress}` : ""}
				</div>
			</div>

			<div className="jp-paze-review__row">
				<div className="jp-paze-review__label">Payment</div>
				<div className="jp-paze-review__value">
					<span className="jp-paze-review__card">{cardLabel}</span>
				</div>
			</div>

			<div className="jp-paze-review__row">
				<div className="jp-paze-review__label">Ship to</div>
				<div className="jp-paze-review__value">
					{formatAddress(ship) || "—"}
				</div>
			</div>

			<div className="jp-paze-review__totals">
				<div className="jp-summary-row">
					<span>Subtotal:</span>
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
			</div>

			<button
				className="jp-btn jp-btn--primary"
				onClick={onCompletePurchase}
				style={{ marginTop: 14 }}
			>
				Complete Purchase
			</button>
			<button className="jp-btn jp-btn--secondary" onClick={onCancel}>
				Use a different payment method
			</button>
		</div>
	);
}
