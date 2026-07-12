export type UcpPostalAddress = {
	extended_address?: string;
	street_address?: string;
	address_locality?: string;
	address_region?: string;
	address_country?: string;
	postal_code?: string;
	first_name?: string;
	last_name?: string;
	phone_number?: string;
};

export type PazePaymentDisplay = {
	label?: string;
	card_network?: string;
	pan_last_four?: string;
	buyer_name?: string;
	shipping_address?: UcpPostalAddress;
};

export type PaymentCheckoutContext = {
	id: string;
	currency: string;
	totals: Array<{ type: string; amount: number; display_text?: string }>;
};

export type PazeBrowserSelection = {
	opaque: unknown;
	display: PazePaymentDisplay;
};

export type PazeBrowserHandler = {
	name: string;
	initialize(config: Record<string, unknown>): Promise<void>;
	canSelect?(input: Record<string, string>): Promise<boolean>;
	select(input: {
		checkout: PaymentCheckoutContext;
		action: "START_FLOW" | "CHANGE_PAYMENT_METHOD";
		consumer?: Record<string, string>;
	}): Promise<PazeBrowserSelection>;
	complete(input: {
		checkout: PaymentCheckoutContext;
		selection: PazeBrowserSelection;
	}): Promise<{ instrument: Record<string, unknown> }>;
};

export type PazeDecryptionEvidence = {
	status: "decrypted" | "failed";
	processed_at: string;
	complete_response_verified: boolean;
	secure_payload_decrypted: boolean;
	inner_payload_verified: boolean;
	business_identity_verified: boolean;
	payload_id?: string;
	session_id?: string;
	jwe_alg?: string;
	jwe_enc?: string;
	redacted_payload?: Record<string, unknown>;
	error?: string;
};
