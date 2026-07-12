import type {
	PazeBrowserHandler,
	PazeBrowserSelection,
	PaymentCheckoutContext,
} from "../../shared/paze-payment";

const PAZE_HANDLER_NAME = "dev.jknarr.paze_checkout";

type HandlerDefinition = {
	id: string;
	config: Record<string, unknown> & { module_url?: string };
};

let handlerPromise: Promise<PazeBrowserHandler> | null = null;
let resolvedHandler: PazeBrowserHandler | null = null;

async function loadHandler(): Promise<PazeBrowserHandler> {
	if (handlerPromise) return handlerPromise;
	handlerPromise = (async () => {
		const response = await fetch("/.well-known/ucp", { headers: { accept: "application/json" } });
		if (!response.ok) throw new Error(`Merchant UCP profile returned ${response.status}`);
		const profile = (await response.json()) as {
			ucp?: { payment_handlers?: Record<string, HandlerDefinition[]> };
		};
		const definition = profile.ucp?.payment_handlers?.[PAZE_HANDLER_NAME]?.[0];
		if (!definition) throw new Error("Merchant does not advertise the Paze payment handler");
		const moduleUrl = definition.config.module_url;
		if (typeof moduleUrl !== "string") throw new Error("Paze handler module URL is missing");
		const loaded = await import(/* @vite-ignore */ moduleUrl) as {
			default?: PazeBrowserHandler;
		};
		const handler = loaded.default;
		if (!handler || handler.name !== PAZE_HANDLER_NAME) {
			throw new Error("Paze handler module does not implement the negotiated contract");
		}
		await handler.initialize({ ...definition.config, handler_instance_id: definition.id });
		resolvedHandler = handler;
		return handler;
	})().catch((error) => {
		handlerPromise = null;
		throw error;
	});
	return handlerPromise;
}

export function initializePaze(): Promise<PazeBrowserHandler> {
	return loadHandler();
}

export async function canPazeCheckout(input: {
	emailAddress?: string;
	mobileNumber?: string;
}): Promise<boolean> {
	try {
		const handler = await loadHandler();
		return handler.canSelect
			? handler.canSelect({
					email_address: input.emailAddress ?? "",
					mobile_number: input.mobileNumber ?? "",
				})
			: true;
	} catch (error) {
		console.warn("[payment-handler] eligibility check failed:", error);
		return false;
	}
}

export function selectPazePayment(input: {
	checkout: PaymentCheckoutContext;
	lookup?: { emailAddress?: string; mobileNumber?: string };
}): Promise<PazeBrowserSelection> {
	if (!resolvedHandler) throw new Error("Paze handler is not initialized");
	return resolvedHandler.select({
		checkout: input.checkout,
		action: "START_FLOW",
		...(input.lookup
			? {
					consumer: {
						...(input.lookup.emailAddress
							? { email_address: input.lookup.emailAddress }
							: {}),
						...(input.lookup.mobileNumber
							? { mobile_number: input.lookup.mobileNumber }
							: {}),
					},
				}
			: {}),
	});
}

export async function completePazePayment(input: {
	checkout: PaymentCheckoutContext;
	selection: PazeBrowserSelection;
}) {
	const handler = await loadHandler();
	return handler.complete(input);
}

export type { PazeBrowserSelection };
