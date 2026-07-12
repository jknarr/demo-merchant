import {
	PAZE_HANDLER_NAME,
	pazeMerchantVerifier,
	type PazeMerchantVerifierConfig,
} from "./paze-verifier";
import type { PazePaymentDisplay } from "../shared/paze-payment";

type UcpTotal = { type: string; amount: number; display_text?: string };
export type MerchantPaymentDisplay = PazePaymentDisplay;
type PaymentVerificationContext = {
	checkout_id: string;
	handler_id: string;
	currency: string;
	totals: UcpTotal[];
};
type VerifiedPayment<Evidence = unknown> = {
	handler_name: string;
	handler_id: string;
	instrument_id: string;
	display: MerchantPaymentDisplay;
	evidence: Evidence;
};
type MerchantPaymentHandlerVerifier<Config = unknown, Evidence = unknown> = {
	name: string;
	verifyInstrument(input: {
		instrument: unknown;
		context: PaymentVerificationContext;
		config: Config;
	}): Promise<VerifiedPayment<Evidence>>;
};

type MerchantPaymentEnvironment = {
	PAZE_CLIENT_ID?: string;
	PAZE_PROFILE_ID?: string;
	PAZE_HANDLER_MODULE_URL?: string;
	PAZE_MERCHANT_PRIVATE_KEY?: string;
};

type RegisteredHandler = {
	id: string;
	name: string;
	instrumentType: string;
	spec: string;
	schema: string;
	verifier: MerchantPaymentHandlerVerifier<unknown, unknown>;
	verifierConfig(env: MerchantPaymentEnvironment): unknown;
	profileConfig(env: MerchantPaymentEnvironment): Record<string, unknown>;
};

const PAZE_HANDLER_ID = "jimporium_paze_sdk";
const PAZE_HANDLER_VERSION = "2026-07-11";
const PAZE_SPEC_URL =
	"https://raw.githubusercontent.com/jknarr/paze-ucp-payment-handler/v2026-07-11/spec/2026-07-11/paze-ucp-payment-handler.md";
const PAZE_SCHEMA_URL =
	"https://raw.githubusercontent.com/jknarr/paze-ucp-payment-handler/v2026-07-11/schemas/2026-07-11/handler.schema.json";

function required(value: string | undefined, name: string): string {
	if (!value) throw new Error(`${name} is not configured`);
	return value;
}

const handlers: RegisteredHandler[] = [
	{
		id: PAZE_HANDLER_ID,
		name: PAZE_HANDLER_NAME,
		instrumentType: "paze",
		spec: PAZE_SPEC_URL,
		schema: PAZE_SCHEMA_URL,
		verifier: pazeMerchantVerifier as MerchantPaymentHandlerVerifier<unknown, unknown>,
		verifierConfig: (env) => ({
			private_key_pem: env.PAZE_MERCHANT_PRIVATE_KEY,
			environment: "sandbox",
			expected_client_id: required(env.PAZE_CLIENT_ID, "PAZE_CLIENT_ID"),
		}) satisfies PazeMerchantVerifierConfig,
		profileConfig: (env) => ({
			environment: "sandbox",
			client_id: required(env.PAZE_CLIENT_ID, "PAZE_CLIENT_ID"),
			profile_id: required(env.PAZE_PROFILE_ID, "PAZE_PROFILE_ID"),
			client_name: "Jimporium",
			module_url: required(env.PAZE_HANDLER_MODULE_URL, "PAZE_HANDLER_MODULE_URL"),
			supported_currencies: ["USD"],
			supported_intents: ["REVIEW_AND_PAY"],
		}),
	},
];

export function paymentHandlerProfile(runtimeEnv: object) {
	const env = runtimeEnv as MerchantPaymentEnvironment;
	return Object.fromEntries(
		handlers.map((handler) => [
			handler.name,
			[
				{
					id: handler.id,
					version: PAZE_HANDLER_VERSION,
					spec: handler.spec,
					schema: handler.schema,
					available_instruments: [{ type: handler.instrumentType }],
					config: handler.profileConfig(env),
				},
			],
		]),
	);
}

export function paymentHandlerMetadata() {
	return Object.fromEntries(
		handlers.map((handler) => [
			handler.name,
			[
				{
					id: handler.id,
					version: PAZE_HANDLER_VERSION,
					available_instruments: [{ type: handler.instrumentType }],
				},
			],
		]),
	);
}

export async function verifyPaymentInstrument(input: {
	instrument: unknown;
	context: Omit<PaymentVerificationContext, "handler_id">;
	env: object;
}): Promise<VerifiedPayment> {
	if (!input.instrument || typeof input.instrument !== "object") {
		throw new Error("Payment instrument is missing");
	}
	const handlerId = (input.instrument as { handler_id?: unknown }).handler_id;
	const registration = handlers.find((candidate) => candidate.id === handlerId);
	if (!registration) throw new Error("Payment handler is not supported");
	const env = input.env as MerchantPaymentEnvironment;
	return registration.verifier.verifyInstrument({
		instrument: input.instrument,
		context: { ...input.context, handler_id: registration.id },
		config: registration.verifierConfig(env),
	});
}
