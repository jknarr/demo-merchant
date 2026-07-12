import { Hono } from "hono";
import { saveMerchantOrder } from "./order-store";
import { verifyPaymentInstrument } from "./payment-handlers";
import { registerUcpRoutes } from "./ucp";

const app = new Hono<{ Bindings: Env }>();

registerUcpRoutes(app);

app.get("/api/", (c) => c.json({ name: "Jimporium" }));

type CreateOrderBody = {
	merchantOrderId?: string;
	amount?: number;
	currency?: string;
	emailAddress?: string;
	sessionId?: string;
	totals?: Array<{ type: string; amount: number; display_text?: string }>;
	lineItems?: unknown[];
	payment?: { instruments?: Array<Record<string, unknown>> };
};

app.post("/api/orders", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as CreateOrderBody;
	const instrument = body.payment?.instruments?.find(
		(candidate) => candidate.selected !== false,
	);
	if (!body.sessionId || !instrument) {
		return c.json(
			{ code: "payment_failed", content: "A selected payment instrument is required." },
			400,
		);
	}

	let verified;
	try {
		verified = await verifyPaymentInstrument({
			instrument,
			context: {
				checkout_id: body.sessionId,
				currency: body.currency ?? "USD",
				totals: body.totals ?? [
					{ type: "total", amount: Math.round((body.amount ?? 0) * 100) },
				],
			},
			env: c.env,
		});
	} catch (error) {
		return c.json(
			{
				code: "payment_failed",
				content: error instanceof Error ? error.message : "Payment verification failed.",
			},
			400,
		);
	}

	const orderId =
		body.merchantOrderId ?? `JIM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
	const attachedAt = new Date().toISOString();
	saveMerchantOrder({
		id: orderId,
		checkoutId: body.sessionId,
		currency: body.currency ?? "USD",
		totals: body.totals ?? [
			{ type: "total", amount: Math.round((body.amount ?? 0) * 100) },
		],
		lineItems: body.lineItems ?? [],
		completedAt: attachedAt,
		payment: {
			handler: verified.handler_name,
			instrumentId: verified.instrument_id,
			display: verified.display,
			attachedAt,
			evidence: verified.evidence,
		},
	});

	console.log("Jimporium order received", {
		orderId,
		amount: body.amount,
		currency: body.currency,
		emailAddress: body.emailAddress,
		paymentHandler: verified.handler_name,
		instrumentId: verified.instrument_id,
	});

	return c.json({
		orderId,
		status: "AUTHORIZED",
		amount: body.amount ?? 0,
		currency: body.currency ?? "USD",
		processedAt: attachedAt,
		payment: {
			handler: verified.handler_name,
			display: verified.display,
		},
	});
});

// Fall through to the static-asset binding so the SPA's deep URLs
// (/cart, /checkout, /product/:id, /order/:id) get index.html via
// wrangler's not_found_handling: "single-page-application".
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
