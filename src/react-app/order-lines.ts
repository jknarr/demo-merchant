import type { CartItem } from "./types";

export type OrderLineItem = {
	id: string;
	item: {
		id: string;
		title: string;
		price: number;
		image_url?: string;
	};
	quantity: number;
	totals: Array<{ type: string; amount: number }>;
};

export function cartItemsToOrderLines(items: CartItem[]): OrderLineItem[] {
	return items.map(({ product, quantity }, index) => {
		const amount = Math.round(product.price * quantity * 100);
		return {
			id: `li_${index + 1}`,
			item: {
				id: product.id,
				title: product.title,
				price: Math.round(product.price * 100),
				image_url: product.image,
			},
			quantity,
			totals: [
				{ type: "subtotal", amount },
				{ type: "total", amount },
			],
		};
	});
}
