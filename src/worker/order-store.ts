import type { MerchantPaymentDisplay } from "./payment-handlers";

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

const orders = new Map<string, MerchantOrderRecord>();

export function saveMerchantOrder(order: MerchantOrderRecord): void {
	orders.set(order.id, order);
}

export function getMerchantOrder(id: string): MerchantOrderRecord | undefined {
	return orders.get(id);
}
