import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Jimporium" }));

type CreateOrderBody = {
	merchantOrderId?: string;
	amount?: number;
	currency?: string;
	emailAddress?: string;
	pazeResult?: unknown;
};

app.post("/api/orders", async (c) => {
	const body = (await c.req.json().catch(() => ({}))) as CreateOrderBody;

	const orderId =
		body.merchantOrderId ?? `JIM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

	// In a real integration, the Paze encrypted payload would be decrypted
	// here using the merchant's private key, then handed to a payment processor.
	// For this demo we simply echo back an order ID after logging what we got.
	console.log("Jimporium order received", {
		orderId,
		amount: body.amount,
		currency: body.currency,
		emailAddress: body.emailAddress,
		hasPazeResult: Boolean(body.pazeResult),
	});

	return c.json({
		orderId,
		status: "AUTHORIZED",
		amount: body.amount ?? 0,
		currency: body.currency ?? "USD",
		processedAt: new Date().toISOString(),
	});
});

// Fall through to the static-asset binding so the SPA's deep URLs
// (/cart, /checkout, /product/:id, /order/:id) get index.html via
// wrangler's not_found_handling: "single-page-application".
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
