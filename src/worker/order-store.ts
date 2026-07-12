import type { MerchantPaymentDisplay } from "./payment-handlers";
import { merchantState } from "./durable-state";

export type MerchantOrderRecord = {
	id: string;
	checkoutId: string;
	currency: string;
	totals: Array<{ type: string; amount: number; display_text?: string }>;
	lineItems: unknown[];
	completedAt: string;
	payment: {
		handler: string;
		instrumentId: string;
		display: MerchantPaymentDisplay;
		attachedAt: string;
		evidence: unknown;
	};
};

export async function saveMerchantOrder(
	runtimeEnv: object,
	order: MerchantOrderRecord,
): Promise<void> {
	await merchantState(runtimeEnv).put(`order:${order.id}`, order);
}

export async function getMerchantOrder(
	runtimeEnv: object,
	id: string,
): Promise<MerchantOrderRecord | undefined> {
	return (await merchantState(runtimeEnv).get(`order:${id}`)) as
		| MerchantOrderRecord
		| undefined;
}
