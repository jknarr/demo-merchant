import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	canPazeCheckout,
	completePazePayment,
	initializePaze,
	selectPazePayment,
	type PazeBrowserSelection,
} from "../paze/paze";
import type { PazePaymentDisplay } from "../../shared/paze-payment";
import type { OrderLineItem } from "../order-lines";

declare module "react" {
	// The Paze SDK registers a custom element that is not part of React's built-in JSX types.
	// eslint-disable-next-line @typescript-eslint/no-namespace
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

type Status =
	| { kind: "idle" }
	| { kind: "loading"; message: string }
	| {
			kind: "reviewing";
				selection: PazeBrowserSelection;
	  }
	| { kind: "completing"; message: string }
	| { kind: "error"; message: string };

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

function formatAddress(addr?: PazePaymentDisplay["shipping_address"]): string {
	if (!addr) return "";
	const parts = [
		[addr.first_name, addr.last_name].filter(Boolean).join(" "),
		addr.street_address,
		addr.extended_address,
		[addr.address_locality, addr.address_region, addr.postal_code]
			.filter(Boolean)
			.join(", "),
		addr.address_country,
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
	lineItems,
	onComplete,
}: {
	email: string;
	mobileNumber: string;
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	lineItems: OrderLineItem[];
	onComplete: (result: PazeCompletionResult) => void;
}) {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [ready, setReady] = useState(false);
	const [walletDetected, setWalletDetected] = useState<boolean | null>(null);
	const sessionIdRef = useRef<string>(`JIM-${Date.now()}`);
	const buttonRef = useRef<HTMLElement | null>(null);

	const normalizedEmail = email.trim().toLowerCase();
	const normalizedMobile = mobileNumber.replace(/[^\d]/g, "");
	const mobileValid = normalizedMobile.length > 0 && isValidUSMobile(normalizedMobile);
	const emailValid = normalizedEmail.length > 0 && isValidEmail(normalizedEmail);
	// Include every lookup key that's syntactically valid. Anything malformed
	// or empty is omitted; if neither is provided, no lookup is sent and
	// Paze collects the identifier inside its own popup.
	const lookup = useMemo<{ emailAddress?: string; mobileNumber?: string } | null>(() => {
		const out: { emailAddress?: string; mobileNumber?: string } = {};
		if (mobileValid) out.mobileNumber = normalizedMobile;
		if (emailValid) out.emailAddress = normalizedEmail;
		return Object.keys(out).length > 0 ? out : null;
	}, [emailValid, mobileValid, normalizedEmail, normalizedMobile]);
	const lookupLabel =
		[
			mobileValid ? normalizedMobile : null,
			emailValid ? normalizedEmail : null,
		]
			.filter(Boolean)
			.join(" / ") || "(no lookup — Paze will ask)";

	useEffect(() => {
		let cancelled = false;
		initializePaze()
			.then(() => {
				if (!cancelled) {
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
	}, [ready, lookup]);

	// Per Paze SDK: transactionAmount must equal subtotal - discountAmount
	// (merchandise total, before tax/shipping). Tax and shipping are sent
	// as separate line items and the SDK displays them broken out.
	const ucpTotals = useMemo(
		() => [
			{ type: "subtotal", amount: Math.round(subtotal * 100) },
			{ type: "fulfillment", amount: Math.round(shipping * 100) },
			{ type: "tax", amount: Math.round(tax * 100) },
			{ type: "total", amount: Math.round(total * 100) },
		],
		[shipping, subtotal, tax, total],
	);
	const handlerCheckout = useMemo(
		() => ({ id: sessionIdRef.current, currency: "USD", totals: ucpTotals }),
		[ucpTotals],
	);

	// CRITICAL: keep this handler synchronous up to and including the
	// sdk.checkout() call. Any `await` before sdk.checkout() yields a
	// microtask and breaks the user-gesture chain, causing the SDK's
	// popup to be blocked.
	const handleClick = useCallback(() => {
		if (!ready) {
			setStatus({
				kind: "error",
				message: "Paze SDK not initialized yet. Try again in a moment.",
			});
			return;
		}

		setStatus({ kind: "loading", message: "Opening Paze..." });

		const checkoutPromise = selectPazePayment({
			checkout: handlerCheckout,
			lookup: lookup ?? undefined,
		});

		checkoutPromise
			.then((selection) => {
				setStatus({ kind: "reviewing", selection });
			})
			.catch((err) => {
				const e = err as Error & { code?: string };
				console.error("[paze] checkout error:", e);
				setStatus({
					kind: "error",
					message: `Paze error${e.code ? ` (${e.code})` : ""}: ${e.message || String(err)}`,
				});
			});
		}, [handlerCheckout, lookup, ready]);

	const handleCompletePurchase = useCallback(async () => {
		if (!ready || status.kind !== "reviewing") return;
		const sessionId = sessionIdRef.current;
		const display = status.selection.display;

		setStatus({ kind: "completing", message: "Completing purchase..." });
		try {
			const completed = await completePazePayment({
				checkout: handlerCheckout,
				selection: status.selection,
			});
				const orderResp = await fetch("/api/orders", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					sessionId,
					amount: total,
					currency: "USD",
					totals: ucpTotals,
					lineItems,
					emailAddress: normalizedEmail || undefined,
					mobileNumber: normalizedMobile || undefined,
					payment: { instruments: [completed.instrument] },
					}),
			});
			if (!orderResp.ok) {
				const body = await orderResp.json().catch(() => null) as {
					code?: string;
					content?: string;
				} | null;
				throw new Error(
					body?.content
						? `${body.content} (${body.code ?? orderResp.status})`
						: `Order API returned ${orderResp.status}`,
				);
			}
			const order = (await orderResp.json()) as {
				orderId?: string;
				};
				const resultId = order.orderId ?? sessionId;

			onComplete({
				orderId: resultId,
				cardBrand: display.card_network,
				panLastFour: display.pan_last_four,
				buyerName: display.buyer_name,
			});
		} catch (err) {
			const e = err as Error & { code?: string };
			console.error("[paze] complete error:", e);
			setStatus({
				kind: "error",
				message: `Paze complete error${e.code ? ` (${e.code})` : ""}: ${e.message || String(err)}`,
			});
		}
	}, [
		status,
		handlerCheckout,
		ucpTotals,
		total,
		lineItems,
		normalizedEmail,
		normalizedMobile,
			onComplete,
			ready,
	]);

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
		status.kind === "error";
	return (
		<div>
			{status.kind === "reviewing" && (
				<PazeReviewPanel
					display={status.selection.display}
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
			{status.kind === "error" && (
				<div className="jp-paze-status jp-paze-status--err">
					{status.message}
				</div>
			)}
		</div>
	);
}

function PazeReviewPanel({
	display,
	subtotal,
	tax,
	shipping,
	total,
	onCompletePurchase,
	onCancel,
}: {
	display: PazePaymentDisplay;
	subtotal: number;
	tax: number;
	shipping: number;
	total: number;
	onCompletePurchase: () => void;
	onCancel: () => void;
}) {
	const cardLabel = display.card_network || display.pan_last_four
		? `${display.card_network ?? "Card"} ending in ${display.pan_last_four ?? "????"}`
		: "Selected Paze card";

	return (
		<div className="jp-paze-review">
			<h3 style={{ marginTop: 0 }}>Review your Paze payment</h3>

			<div className="jp-paze-review__row">
				<div className="jp-paze-review__label">Buyer</div>
				<div className="jp-paze-review__value">
					{display.buyer_name ?? "—"}
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
					{formatAddress(display.shipping_address) || "—"}
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
