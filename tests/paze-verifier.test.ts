import { strict as assert } from "node:assert";
import {
	CompactEncrypt,
	exportPKCS8,
	generateKeyPair,
} from "jose";
import {
	buildPazeDecryptionEvidence,
	pazeMerchantVerifier,
} from "../src/worker/paze-verifier";

const { publicKey, privateKey: privateCryptoKey } = await generateKeyPair(
	"RSA-OAEP-256",
	{ modulusLength: 2048, extractable: true },
);
const privateKey = await exportPKCS8(privateCryptoKey);
const securedPayload = await new CompactEncrypt(
	new TextEncoder().encode(JSON.stringify({
		payload: {
			clientId: "merchant-test",
			profileId: "test-profile",
			paymentCardNetwork: "MASTERCARD",
			consumer: { fullName: "Demo Buyer", emailAddress: "buyer@example.com" },
			token: {
				paymentToken: "5200000000002812",
				tokenExpirationMonth: "12",
				tokenExpirationYear: "2030",
				paymentAccountReference: "PAR-TEST-1234",
			},
			dynamicData: [{ dynamicDataType: "PURCHASE", dynamicData: "SECRET-CRYPTOGRAM" }],
		},
	})),
).setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" }).encrypt(publicKey);

const evidence = await buildPazeDecryptionEvidence(
	{ payloadId: "test", securedPayload },
	privateKey,
	{ expectedClientId: "merchant-test" },
);
assert.equal(evidence.status, "decrypted");
assert.equal(evidence.business_identity_verified, true);
assert.match(JSON.stringify(evidence.redacted_payload), /redacted cryptogram/);
assert.doesNotMatch(
	JSON.stringify(evidence.redacted_payload),
	/SECRET-CRYPTOGRAM|5200000000002812/,
);

const mismatch = await buildPazeDecryptionEvidence(
	{ sessionId: "different-checkout", securedPayload },
	privateKey,
	{ expectedSessionId: "checkout-test" },
);
assert.equal(mismatch.status, "failed");
assert.match(mismatch.error ?? "", /session does not match/);

const wrongBusiness = await buildPazeDecryptionEvidence(
	{ payloadId: "test", securedPayload },
	privateKey,
	{ expectedClientId: "another-business" },
);
assert.equal(wrongBusiness.status, "failed");
assert.match(wrongBusiness.error ?? "", /different business/);

await assert.rejects(
	pazeMerchantVerifier.verifyInstrument({
		instrument: {
			id: "expired-paze",
			handler_id: "jimporium_paze_sdk",
			type: "paze",
			session_id: "checkout-test",
			credential: {
				type: "paze_encrypted_payload",
				checkout_response: "opaque",
				complete_response: { sessionId: "checkout-test", securedPayload },
				expiry: "2020-01-01T00:00:00.000Z",
			},
		},
		context: {
			checkout_id: "checkout-test",
			handler_id: "jimporium_paze_sdk",
			currency: "USD",
			totals: [],
		},
		config: {
			private_key_pem: privateKey,
			expected_client_id: "merchant-test",
		},
	}),
	/expired/,
);

const verified = await pazeMerchantVerifier.verifyInstrument({
	instrument: {
		id: "valid-paze",
		handler_id: "jimporium_paze_sdk",
		type: "paze",
		session_id: "checkout-test",
		credential: {
			type: "paze_encrypted_payload",
			checkout_response: "opaque",
			complete_response: { sessionId: "checkout-test", securedPayload },
			expiry: new Date(Date.now() + 60_000).toISOString(),
		},
	},
	context: {
		checkout_id: "checkout-test",
		handler_id: "jimporium_paze_sdk",
		currency: "USD",
		totals: [],
	},
	config: {
		private_key_pem: privateKey,
		expected_client_id: "merchant-test",
	},
});
assert.equal(verified.evidence.business_identity_verified, true);
console.log("Merchant-owned Paze verification/decryption test passed");
