import type { Context, Hono } from "hono";
import { PRODUCTS } from "../react-app/data/products";
import { getMerchantOrder, saveMerchantOrder } from "./order-store";
import { merchantState } from "./durable-state";
import {
	paymentHandlerMetadata,
	paymentHandlerProfile,
	verifyPaymentInstrument,
	type MerchantPaymentDisplay,
} from "./payment-handlers";

const UCP_VERSION = "2026-04-08";
const SESSION_TTL_MS = 30 * 60 * 1000;
const TAX_RATE = 0.086;

type CheckoutStatus =
	| "incomplete"
	| "requires_escalation"
	| "ready_for_complete"
	| "complete_in_progress"
	| "completed"
	| "canceled";

type CheckoutLineRequest = {
	id?: string;
	item?: { id?: string };
	quantity?: number;
};

type CheckoutRequest = {
	line_items?: CheckoutLineRequest[];
	buyer?: {
		first_name?: string;
		last_name?: string;
		email?: string;
		phone_number?: string;
	};
	payment?: { instruments?: Array<Record<string, unknown>> };
};

type StoredPayment = {
	handlerName: string;
	handlerId: string;
	instrumentId: string;
	display: MerchantPaymentDisplay;
	attachedAt: string;
	evidence: unknown;
};

type StoredCheckout = {
	id: string;
	status: CheckoutStatus;
	createdAt: number;
	expiresAt: number;
	request: CheckoutRequest;
	payment?: StoredPayment;
	orderId?: string;
};

function cents(value: number): number {
	return Math.round(value * 100);
}

function publicBaseUrl(c: Context): string {
	const configured = c.env?.PUBLIC_BASE_URL as string | undefined;
	return configured?.replace(/\/$/, "") ?? new URL(c.req.url).origin;
}

function ucpMetadata(capabilities: string[] = ["dev.ucp.shopping.checkout"]) {
	return {
		version: UCP_VERSION,
		capabilities: Object.fromEntries(
			capabilities.map((name) => [name, [{ version: UCP_VERSION }]]),
		),
		payment_handlers: paymentHandlerMetadata(),
	};
}

function toCatalogProduct(product: (typeof PRODUCTS)[number], baseUrl: string) {
	const amount = cents(product.price);
	return {
		id: product.id,
		handle: product.id,
		title: product.title,
		description: { plain: product.description },
		url: `${baseUrl}/product/${encodeURIComponent(product.id)}`,
		categories: [{ value: product.category, taxonomy: "merchant" }],
		price_range: {
			min: { amount, currency: "USD" },
			max: { amount, currency: "USD" },
		},
		variants: [
			{
				id: product.id,
				sku: product.id.toUpperCase(),
				title: product.title,
				description: { plain: product.description },
				price: { amount, currency: "USD" },
				availability: { available: true },
				tags: [product.category.toLowerCase(), ...(product.prime ? ["prime"] : [])],
				seller: { name: "Jimporium" },
			},
		],
		rating: {
			value: product.rating,
			scale_max: 5,
			count: product.reviewCount,
		},
		metadata: { emoji: product.image },
	};
}

function computeCheckout(stored: StoredCheckout, baseUrl: string) {
	const lineItems = (stored.request.line_items ?? []).flatMap((line, index) => {
		const product = PRODUCTS.find((candidate) => candidate.id === line.item?.id);
		if (!product) return [];
		const quantity = Math.max(1, Math.floor(line.quantity ?? 1));
		const subtotal = cents(product.price) * quantity;
		return [
			{
				id: line.id ?? `li_${index + 1}`,
				item: {
					id: product.id,
					title: product.title,
					price: cents(product.price),
					image_url: product.image,
				},
				quantity,
				totals: [
					{ type: "subtotal", amount: subtotal },
					{ type: "total", amount: subtotal },
				],
			},
		];
	});
	const subtotal = lineItems.reduce(
		(sum, line) => sum + (line.totals[0]?.amount ?? 0),
		0,
	);
	const shipping = subtotal > 3500 ? 0 : 599;
	const tax = Math.round(subtotal * TAX_RATE);
	const total = subtotal + shipping + tax;
	const messages = [] as Array<Record<string, unknown>>;
	if (lineItems.length === 0) {
		messages.push({
			type: "error",
			code: "missing",
			path: "$.line_items",
			content: "At least one valid Jimporium product is required.",
			severity: "recoverable",
		});
	}
	return {
		ucp: ucpMetadata(),
		id: stored.id,
		status: stored.status,
		currency: "USD",
		line_items: lineItems,
		buyer: stored.request.buyer,
		totals: [
			{ type: "subtotal", amount: subtotal },
			{ type: "fulfillment", amount: shipping, display_text: "Standard shipping" },
			{ type: "tax", amount: tax },
			{ type: "total", amount: total },
		],
		...(messages.length ? { messages } : {}),
		links: [
			{ type: "terms_of_service", url: `${baseUrl}/terms` },
			{ type: "privacy_policy", url: `${baseUrl}/privacy` },
		],
		expires_at: new Date(stored.expiresAt).toISOString(),
		payment: {
			instruments: stored.payment
				? [
							{
								id: stored.payment.instrumentId,
								handler_id: stored.payment.handlerId,
								selected: true,
								display: stored.payment.display,
						},
					]
				: [],
		},
		...(stored.orderId
			? {
					order: {
						id: stored.orderId,
						permalink_url: `${baseUrl}/order/${encodeURIComponent(stored.orderId)}`,
					},
				}
			: {}),
	};
}

async function readSession(
	runtimeEnv: object,
	id: string,
): Promise<StoredCheckout | undefined> {
	const state = merchantState(runtimeEnv);
	const session = (await state.get(`checkout:${id}`)) as StoredCheckout | undefined;
	if (!session) return undefined;
	if (session.expiresAt <= Date.now()) {
		await state.delete(`checkout:${id}`);
		return undefined;
	}
	return session;
}

async function writeSession(runtimeEnv: object, session: StoredCheckout): Promise<void> {
	await merchantState(runtimeEnv).put(`checkout:${session.id}`, session);
}

function normalizeLines(lines: CheckoutLineRequest[] | undefined) {
	return (lines ?? []).map((line) => ({
		...(line.id ? { id: line.id } : {}),
		item: { id: String(line.item?.id ?? "") },
		quantity: Math.max(1, Math.floor(Number(line.quantity ?? 1))),
	}));
}

	export function registerUcpRoutes(app: Hono<{ Bindings: Env }>) {
			app.get("/.well-known/ucp", (c) => {
				const baseUrl = publicBaseUrl(c);
		return c.json(
			{
				ucp: {
					version: UCP_VERSION,
					services: {
						"dev.ucp.shopping": [
							{
								version: UCP_VERSION,
								spec: `https://ucp.dev/${UCP_VERSION}/specification/overview`,
								transport: "rest",
								endpoint: baseUrl,
								schema: `https://ucp.dev/${UCP_VERSION}/services/shopping/rest.openapi.json`,
							},
						],
					},
					capabilities: Object.fromEntries(
						[
							"dev.ucp.shopping.catalog.search",
								"dev.ucp.shopping.catalog.lookup",
								"dev.ucp.shopping.checkout",
								"dev.ucp.shopping.order",
						].map((name) => [
							name,
							[
								{
									version: UCP_VERSION,
										spec: `https://ucp.dev/${UCP_VERSION}/specification/${name.includes("catalog") ? "catalog" : name.endsWith("order") ? "order" : "checkout"}`,
										schema: `https://ucp.dev/${UCP_VERSION}/schemas/shopping/${name.endsWith("search") ? "catalog_search" : name.endsWith("lookup") ? "catalog_lookup" : name.endsWith("order") ? "order" : "checkout"}.json`,
								},
							],
						]),
					),
					payment_handlers: paymentHandlerProfile(c.env),
				},
				business: {
					id: "jimporium",
					name: "Jimporium",
					url: baseUrl,
				},
			},
			200,
			{
				"Cache-Control": "public, max-age=300",
				"Access-Control-Allow-Origin": "*",
			},
		);
	});

	app.post("/catalog/search", async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as {
			query?: string;
			filters?: {
				categories?: string[];
				price?: { min?: number; max?: number };
			};
			context?: { currency?: string };
			pagination?: { limit?: number; cursor?: string };
		};
		const query = body.query?.trim().toLowerCase() ?? "";
		const categories = body.filters?.categories?.map((value) => value.toLowerCase());
		const minPrice = body.filters?.price?.min;
		const maxPrice = body.filters?.price?.max;
		const matching = PRODUCTS.filter((product) => {
			const haystack = `${product.title} ${product.description} ${product.category}`.toLowerCase();
			const price = cents(product.price);
			return (
				(!query || haystack.includes(query)) &&
				(!categories?.length || categories.includes(product.category.toLowerCase())) &&
				(minPrice === undefined || price >= minPrice) &&
				(maxPrice === undefined || price <= maxPrice)
			);
		});
		const limit = Math.min(50, Math.max(1, Number(body.pagination?.limit ?? 12)));
		const start = Math.max(0, Number(body.pagination?.cursor ?? 0));
		const page = matching.slice(start, start + limit);
		return c.json({
			ucp: ucpMetadata(["dev.ucp.shopping.catalog.search"]),
			products: page.map((product) => toCatalogProduct(product, publicBaseUrl(c))),
			pagination: {
				...(start + limit < matching.length ? { cursor: String(start + limit) } : {}),
				has_next_page: start + limit < matching.length,
				total_count: matching.length,
			},
		});
	});

	app.post("/catalog/lookup", async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as { ids?: string[] };
		const ids = new Set((body.ids ?? []).map(String));
		const products = PRODUCTS.filter((product) => ids.has(product.id)).map((product) => {
			const mapped = toCatalogProduct(product, publicBaseUrl(c));
			return {
				...mapped,
				variants: mapped.variants.map((variant) => ({
					...variant,
					inputs: [{ id: product.id, match: "exact" }],
				})),
			};
		});
		return c.json({
			ucp: ucpMetadata(["dev.ucp.shopping.catalog.lookup"]),
			products,
			...(products.length < ids.size
				? {
						messages: [
							{
								type: "warning",
								code: "not_found",
								content: "One or more requested products were not found.",
							},
						],
					}
				: {}),
		});
	});

	app.post("/checkout-sessions", async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as CheckoutRequest;
		const id = `chk_${crypto.randomUUID()}`;
		const stored: StoredCheckout = {
			id,
			status: "requires_escalation",
			createdAt: Date.now(),
			expiresAt: Date.now() + SESSION_TTL_MS,
			request: { ...body, line_items: normalizeLines(body.line_items) },
		};
		await writeSession(c.env, stored);
		return c.json(computeCheckout(stored, publicBaseUrl(c)), 201);
	});

	app.get("/checkout-sessions/:id", async (c) => {
		const stored = await readSession(c.env, c.req.param("id"));
		if (!stored) return c.json({ code: "not_found", content: "Checkout not found or expired." }, 404);
		return c.json(computeCheckout(stored, publicBaseUrl(c)));
	});

	app.put("/checkout-sessions/:id", async (c) => {
		const stored = await readSession(c.env, c.req.param("id"));
		if (!stored) return c.json({ code: "not_found", content: "Checkout not found or expired." }, 404);
		if (["completed", "canceled"].includes(stored.status)) {
			return c.json({ code: "conflict", content: `Checkout is ${stored.status}.` }, 409);
		}
		const body = (await c.req.json().catch(() => ({}))) as CheckoutRequest;
		stored.request = {
			...stored.request,
			...body,
			...(body.line_items ? { line_items: normalizeLines(body.line_items) } : {}),
			buyer: { ...stored.request.buyer, ...body.buyer },
		};
		stored.status = stored.payment ? "ready_for_complete" : "requires_escalation";
		await writeSession(c.env, stored);
		return c.json(computeCheckout(stored, publicBaseUrl(c)));
	});

	app.post("/checkout-sessions/:id/cancel", async (c) => {
		const stored = await readSession(c.env, c.req.param("id"));
		if (!stored) return c.json({ code: "not_found", content: "Checkout not found or expired." }, 404);
		if (stored.status === "completed") return c.json({ code: "conflict", content: "Completed checkout cannot be canceled." }, 409);
		stored.status = "canceled";
		await writeSession(c.env, stored);
		return c.json(computeCheckout(stored, publicBaseUrl(c)));
	});

	app.get("/orders/:id", async (c) => {
		const orderId = c.req.param("id");
		const order = await getMerchantOrder(c.env, orderId);
		if (!order) {
			return c.json(
					{ code: "not_found", content: "Order was not found." },
				404,
			);
		}
		return c.json({
			ucp: ucpMetadata(["dev.ucp.shopping.order"]),
			id: orderId,
			checkout_id: order.checkoutId,
			permalink_url: `${publicBaseUrl(c)}/order/${encodeURIComponent(orderId)}`,
			line_items: order.lineItems,
			fulfillment: { expectations: [], events: [] },
			currency: order.currency,
			totals: order.totals,
			completed_at: order.completedAt,
			payment: {
				handler: order.payment.handler,
				display: order.payment.display,
			},
			payment_evidence: {
				payment_attached_at: order.payment.attachedAt,
				handler: order.payment.handler,
				evidence: order.payment.evidence,
			},
		});
	});

	app.post("/checkout-sessions/:id/complete", async (c) => {
		const stored = await readSession(c.env, c.req.param("id"));
		if (!stored) return c.json({ code: "not_found", content: "Checkout not found or expired." }, 404);
		if (stored.status === "completed") return c.json(computeCheckout(stored, publicBaseUrl(c)));
		if (stored.status !== "requires_escalation" && stored.status !== "ready_for_complete") {
			return c.json({ code: "conflict", content: "Checkout is not ready for completion." }, 409);
		}
		const body = (await c.req.json().catch(() => ({}))) as CheckoutRequest;
		const instrument = body.payment?.instruments?.find(
			(candidate) => candidate.selected !== false,
		);
		if (!instrument) {
			return c.json(
				{ code: "payment_failed", content: "The payment handler instrument is missing or invalid." },
				400,
			);
		}
		stored.status = "complete_in_progress";
		await writeSession(c.env, stored);
		const checkout = computeCheckout(stored, publicBaseUrl(c));
		let verified;
		try {
			verified = await verifyPaymentInstrument({
				instrument,
				context: {
					checkout_id: stored.id,
					currency: checkout.currency,
					totals: checkout.totals,
				},
				env: c.env,
			});
		} catch (error) {
			stored.status = "requires_escalation";
			await writeSession(c.env, stored);
			return c.json(
				{
					code: "payment_failed",
					content: error instanceof Error ? error.message : "The payment credential could not be verified.",
				},
				400,
			);
		}
		const completedAt = new Date().toISOString();
		stored.payment = {
			handlerName: verified.handler_name,
			handlerId: verified.handler_id,
			instrumentId: verified.instrument_id,
			display: verified.display,
			attachedAt: completedAt,
			evidence: verified.evidence,
		};
		stored.orderId = `JIM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
		stored.status = "completed";
		await writeSession(c.env, stored);
		const completed = computeCheckout(stored, publicBaseUrl(c));
		await saveMerchantOrder(c.env, {
			id: stored.orderId,
			checkoutId: stored.id,
			currency: completed.currency,
			totals: completed.totals,
			lineItems: completed.line_items,
			completedAt,
			payment: {
				handler: verified.handler_name,
				instrumentId: verified.instrument_id,
				display: verified.display,
				attachedAt: stored.payment.attachedAt,
				evidence: verified.evidence,
			},
		});
		return c.json(completed);
	});
}
