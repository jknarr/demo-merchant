// Paze JavaScript SDK loader and wrapper.
// Docs:
//   https://developer.paze.com/public/docs/web-client-sdk-setup
//   https://developer.paze.com/public/docs/initialize
//   https://developer.paze.com/public/docs/cancheckout
//   https://developer.paze.com/public/docs/checkout
//   https://developer.paze.com/public/docs/complete
//   https://developer.paze.com/public/docs/objects
//   https://developer.paze.com/public/docs/review-pay-websdk-guide

const SANDBOX_SDK_URL =
	"https://checkout.wallet.cat.earlywarning.io/web/resources/js/digitalwallet-sdk.js";

const PAZE_CLIENT_ID =
	import.meta.env.VITE_PAZE_CLIENT_ID ??
	"N4O6FK3O3GSHT3KN47W713a0gK51EczMZpgRjKLMGvY40w3w0";

const PAZE_PROFILE_ID = import.meta.env.VITE_PAZE_PROFILE_ID ?? "Jim";

declare global {
	interface Window {
		DIGITAL_WALLET_SDK?: PazeSdk;
		DIGITAL_WALLET_SDK_READY?: Promise<unknown>;
	}
}

export type PazeSdk = {
	initialize: (config: PazeInitOptions) => Promise<void>;
	canCheckout: (input: CanCheckoutInput) => Promise<CanCheckoutResult>;
	checkout: (input: CheckoutInput) => Promise<CheckoutResult>;
	complete: (input: CompleteInput) => Promise<CompleteResult>;
	on?: (event: string, handler: (payload: unknown) => void) => void;
};

export type PazeInitOptions = {
	client: {
		id: string;
		name?: string;
		profileId?: string;
		brandName?: string;
		merchantCategoryCode?: string;
		statementDescriptor?: string;
		url?: string;
	};
};

export type CanCheckoutInput = {
	emailAddress?: string;
	mobileNumber?: string;
};

export type CanCheckoutResult = { consumerPresent: boolean };

export type TransactionValue = {
	transactionCurrencyCode: "USD";
	transactionAmount: string;
	subtotal?: string;
	discountAmount?: string;
	taxAmount?: string;
	shippingAmount?: string;
};

export type CheckoutInput = {
	emailAddress?: string;
	mobileNumber?: string;
	sessionId: string;
	actionCode: "START_FLOW" | "CHANGE_CARD" | "CHANGE_SHIPPING_ADDRESS";
	intent: "REVIEW_AND_PAY" | "EXPRESS_CHECKOUT" | "ADD_CARD";
	transactionValue?: TransactionValue;
	shippingPreference?: "ALL" | "NONE";
	billingPreference?: "ALL" | "ZIP_COUNTRY" | "NONE";
	confirmLaunch?: boolean;
	acceptedPaymentCardNetworks?: ("VISA" | "MASTERCARD" | "DISCOVER")[];
};

export type CheckoutResult = {
	result: "COMPLETE" | "INCOMPLETE";
	checkoutResponse?: string;
};

export type CompleteInput = {
	transactionType: "PURCHASE" | "CARD_ON_FILE" | "BOTH";
	sessionId: string;
	transactionValue?: TransactionValue;
	transactionOptions?: {
		merchantCategoryCode?: string;
		billingPreference?: "ALL" | "ZIP_COUNTRY" | "NONE";
		payloadTypeIndicator?: "ID" | "PAYMENT";
	};
	enhancedTransactionData?: {
		ecomData?: {
			cartContainsGiftCard?: boolean;
			orderForPickup?: boolean;
			orderQuantity?: string;
			orderHighestCost?: string;
		};
	};
};

export type CompleteResult = {
	payloadId?: string;
	sessionId?: string;
	securedPayload?: unknown;
	completeResponse?: string;
};

let loadPromise: Promise<PazeSdk> | null = null;
let initPromise: Promise<PazeSdk> | null = null;
let resolvedSdk: PazeSdk | null = null;

export function getResolvedPazeSdk(): PazeSdk | null {
	return resolvedSdk;
}

export function loadPazeSdk(): Promise<PazeSdk> {
	if (loadPromise) return loadPromise;
	loadPromise = new Promise<PazeSdk>((resolve, reject) => {
		const useExisting = () => {
			if (window.DIGITAL_WALLET_SDK) resolve(window.DIGITAL_WALLET_SDK);
			else reject(new Error("Paze SDK loaded but window.DIGITAL_WALLET_SDK is missing"));
		};
		if (window.DIGITAL_WALLET_SDK) return useExisting();

		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${SANDBOX_SDK_URL}"]`,
		);
		if (existing) {
			if (window.DIGITAL_WALLET_SDK_READY) {
				window.DIGITAL_WALLET_SDK_READY.then(useExisting).catch(reject);
			} else {
				existing.addEventListener("load", useExisting);
				existing.addEventListener("error", () =>
					reject(new Error(`Failed to load Paze SDK from ${SANDBOX_SDK_URL}`)),
				);
			}
			return;
		}

		const script = document.createElement("script");
		script.src = SANDBOX_SDK_URL;
		script.async = true;
		script.onload = () => {
			if (window.DIGITAL_WALLET_SDK_READY) {
				window.DIGITAL_WALLET_SDK_READY.then(useExisting).catch(reject);
			} else {
				useExisting();
			}
		};
		script.onerror = () =>
			reject(new Error(`Failed to load Paze SDK from ${SANDBOX_SDK_URL}`));
		document.head.appendChild(script);
	});
	return loadPromise;
}

export function initializePaze(): Promise<PazeSdk> {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		const sdk = await loadPazeSdk();
		const options: PazeInitOptions = {
			client: {
				id: PAZE_CLIENT_ID,
				name: "Jim Test",
				...(PAZE_PROFILE_ID ? { profileId: PAZE_PROFILE_ID } : {}),
			},
		};
		await sdk.initialize(options);
		resolvedSdk = sdk;
		return sdk;
	})().catch((err) => {
		initPromise = null;
		throw err;
	});
	return initPromise;
}

export async function canPazeCheckout(input: CanCheckoutInput): Promise<boolean> {
	try {
		const sdk = await initializePaze();
		const result = await sdk.canCheckout(input);
		console.log("[paze] canCheckout input:", input, "raw result:", result);
		return Boolean(result?.consumerPresent);
	} catch (err) {
		console.warn("[paze] canCheckout failed:", err);
		return false;
	}
}

export async function pazeCheckout(input: CheckoutInput): Promise<CheckoutResult> {
	const sdk = await initializePaze();
	return sdk.checkout(input);
}

export async function pazeComplete(input: CompleteInput): Promise<CompleteResult> {
	const sdk = await initializePaze();
	return sdk.complete(input);
}

export const pazeConfigSummary = {
	clientId: PAZE_CLIENT_ID,
	profileId: PAZE_PROFILE_ID ?? "(not set)",
	sdkUrl: SANDBOX_SDK_URL,
};
