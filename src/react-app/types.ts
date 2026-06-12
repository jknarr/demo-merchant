export type Product = {
	id: string;
	title: string;
	price: number;
	category: string;
	rating: number;
	reviewCount: number;
	image: string;
	description: string;
	prime?: boolean;
};

export type CartItem = {
	product: Product;
	quantity: number;
};

export type View =
	| { name: "home" }
	| { name: "product"; productId: string }
	| { name: "cart" }
	| { name: "checkout" }
	| {
			name: "confirmation";
			orderId: string;
			cardBrand?: string;
			panLastFour?: string;
			buyerName?: string;
	  };
