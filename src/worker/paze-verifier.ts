import {
	compactDecrypt,
	compactVerify,
	createRemoteJWKSet,
	decodeProtectedHeader,
	importPKCS8,
} from "jose";
import type {
	PazeDecryptionEvidence,
	PazePaymentDisplay,
} from "../shared/paze-payment";

export const PAZE_HANDLER_NAME = "dev.jknarr.paze_checkout";
const PAZE_INSTRUMENT_TYPE = "paze";
const PAZE_CREDENTIAL_TYPE = "paze_encrypted_payload";
const SANDBOX_JWKS = "https://auth.wallet.cat.earlywarning.io/jwks";
const PRODUCTION_JWKS = "https://auth.wallet.earlywarning.com/jwks";
type JsonRecord = Record<string, unknown>;

type PazeInstrument = {
	id: string;
	handler_id: string;
	type: "paze";
	session_id: string;
	credential: {
		type: "paze_encrypted_payload";
		checkout_response: string;
		complete_response: JsonRecord;
		expiry: string;
	};
	display?: PazePaymentDisplay;
};

export type PazeMerchantVerifierConfig = {
	private_key_pem?: string;
	environment?: "sandbox" | "production";
	expected_client_id?: string;
};

export type PazeVerificationContext = {
	checkout_id: string;
	handler_id: string;
	currency: string;
	totals: Array<{ type: string; amount: number; display_text?: string }>;
};

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPazeInstrument(
	value: unknown,
	input: { sessionId: string; handlerId: string },
): value is PazeInstrument {
	if (!isRecord(value)) return false;
	const credential = isRecord(value.credential) ? value.credential : null;
	return (
		typeof value.id === "string" &&
		value.handler_id === input.handlerId &&
		value.type === PAZE_INSTRUMENT_TYPE &&
		value.session_id === input.sessionId &&
		credential?.type === PAZE_CREDENTIAL_TYPE &&
		typeof credential.checkout_response === "string" &&
		isRecord(credential.complete_response) &&
		typeof credential.expiry === "string" &&
		Number.isFinite(Date.parse(credential.expiry))
	);
}

function normalizePem(value: string): string {
	return value.trim().replace(/^(["'])|(["'])$/g, "").replace(/\\n/g, "\n");
}

function parseJson(value: Uint8Array | string): unknown {
	return JSON.parse(typeof value === "string" ? value : new TextDecoder().decode(value));
}

function lastFour(value: unknown): string | undefined {
	return typeof value === "string" && value.length >= 4 ? value.slice(-4) : undefined;
}

function redactEmail(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const [local, domain] = value.split("@");
	return local && domain ? `${local.slice(0, 1)}***@${domain}` : "[redacted]";
}

function redactPayload(payload: JsonRecord): JsonRecord {
	const consumer = isRecord(payload.consumer) ? payload.consumer : {};
	const token = isRecord(payload.token) ? payload.token : {};
	const dynamicData = Array.isArray(payload.dynamicData)
		? payload.dynamicData.filter(isRecord).map((entry) => ({
				dynamicDataType: entry.dynamicDataType,
				dynamicData: "[redacted cryptogram]",
				dynamicDataExpiration: entry.dynamicDataExpiration,
			}))
		: undefined;
	const paymentTokenLastFour = lastFour(token.paymentToken);
	const parLastFour = lastFour(token.paymentAccountReference);
	return {
		clientId: payload.clientId,
		profileId: payload.profileId,
		paymentCardNetwork: payload.paymentCardNetwork,
		consumer: {
			fullName: consumer.fullName,
			emailAddress: redactEmail(consumer.emailAddress),
		},
		token: {
			paymentToken: paymentTokenLastFour
				? `[redacted token ending ${paymentTokenLastFour}]`
				: "[redacted token]",
			tokenExpirationMonth: token.tokenExpirationMonth,
			tokenExpirationYear: token.tokenExpirationYear,
			paymentAccountReference: parLastFour
				? `[redacted PAR ending ${parLastFour}]`
				: "[redacted PAR]",
		},
		...(dynamicData ? { dynamicData } : {}),
	};
}

function findString(record: JsonRecord, names: string[]): string | undefined {
	for (const name of names) {
		const value = record[name];
		if (typeof value === "string" && value) return value;
	}
	return undefined;
}

export async function buildPazeDecryptionEvidence(
	completeResult: unknown,
	privateKeyPem: string | undefined,
	options: {
		environment?: "sandbox" | "production";
		expectedSessionId?: string;
		expectedClientId?: string;
	} = {},
): Promise<PazeDecryptionEvidence> {
	const evidence: PazeDecryptionEvidence = {
		status: "failed",
		processed_at: new Date().toISOString(),
		complete_response_verified: false,
		secure_payload_decrypted: false,
		inner_payload_verified: false,
		business_identity_verified: false,
	};
	try {
		if (!privateKeyPem) throw new Error("Merchant decryption key is not configured");
		if (!isRecord(completeResult)) throw new Error("Paze complete result is not an object");
		const jwks = createRemoteJWKSet(
			new URL(options.environment === "production" ? PRODUCTION_JWKS : SANDBOX_JWKS),
		);
		const verify = async (jws: string) => {
			const verified = await compactVerify(jws, jwks, {
				algorithms: ["RS256"],
			});
			const payload = parseJson(verified.payload);
			if (!isRecord(payload)) throw new Error("Paze JWS payload is not a JSON object");
			return payload;
		};

		let completePayload = completeResult;
		const completeJws = findString(completeResult, ["completeResponse"]);
		if (completeJws) {
			completePayload = await verify(completeJws);
			evidence.complete_response_verified = true;
		}
		evidence.payload_id = findString(completePayload, ["payloadId"]);
		evidence.session_id = findString(completePayload, ["sessionId"]);
		if (options.expectedSessionId && evidence.session_id !== options.expectedSessionId) {
			throw new Error("Paze session does not match the UCP checkout");
		}
		const securedPayload = findString(completePayload, ["securedPayload", "securePayload"]);
		if (!securedPayload) throw new Error("Verified Paze result contains no secured payload JWE");

		const protectedHeader = decodeProtectedHeader(securedPayload);
		const algorithm = protectedHeader.alg;
		const encryption = protectedHeader.enc;
		if (algorithm !== "RSA-OAEP" && algorithm !== "RSA-OAEP-256") {
			throw new Error(`Unsupported Paze JWE algorithm: ${algorithm ?? "missing"}`);
		}
		if (encryption !== "A256GCM" && encryption !== "A128GCM") {
			throw new Error(`Unsupported Paze JWE encryption: ${encryption ?? "missing"}`);
		}
		evidence.jwe_alg = algorithm;
		evidence.jwe_enc = encryption;
		const key = await importPKCS8(normalizePem(privateKeyPem), algorithm);
		const decrypted = await compactDecrypt(securedPayload, key, {
			keyManagementAlgorithms: [algorithm],
			contentEncryptionAlgorithms: [encryption],
		});
		evidence.secure_payload_decrypted = true;
		const plaintext = new TextDecoder().decode(decrypted.plaintext);
		const decodedPayload =
			plaintext.split(".").length === 3 ? await verify(plaintext) : parseJson(plaintext);
		evidence.inner_payload_verified = plaintext.split(".").length === 3;
		if (!isRecord(decodedPayload)) {
			throw new Error("Decrypted Paze payload is not a JSON object");
		}
		const payload = isRecord(decodedPayload.payload)
			? decodedPayload.payload
			: decodedPayload;
		if (options.expectedClientId && payload.clientId !== options.expectedClientId) {
			throw new Error("Paze credential is bound to a different business");
		}
		evidence.business_identity_verified = options.expectedClientId
			? payload.clientId === options.expectedClientId
			: false;
		evidence.status = "decrypted";
		evidence.redacted_payload = redactPayload(payload);
	} catch (error) {
		evidence.error = error instanceof Error ? error.message : String(error);
	}
	return evidence;
}

export const pazeMerchantVerifier = {
	name: PAZE_HANDLER_NAME,
	async verifyInstrument({
		instrument,
		context,
		config,
	}: {
		instrument: unknown;
		context: PazeVerificationContext;
		config: PazeMerchantVerifierConfig;
	}) {
		if (!isPazeInstrument(instrument, {
			sessionId: context.checkout_id,
			handlerId: context.handler_id,
		})) {
			throw new Error("Paze payment instrument is missing or invalid");
		}
		if (Date.parse(instrument.credential.expiry) <= Date.now()) {
			throw new Error("Paze payment credential has expired");
		}
		const evidence = await buildPazeDecryptionEvidence(
			instrument.credential.complete_response,
			config.private_key_pem,
			{
				environment: config.environment,
				expectedSessionId: context.checkout_id,
				expectedClientId: config.expected_client_id,
			},
		);
		if (evidence.status !== "decrypted") {
			throw new Error(evidence.error ?? "Paze payment credential could not be verified");
		}
		return {
			handler_name: PAZE_HANDLER_NAME,
			handler_id: context.handler_id,
			instrument_id: instrument.id,
			display: instrument.display ?? {},
			evidence,
		};
	},
};
