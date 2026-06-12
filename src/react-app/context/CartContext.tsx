import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { CartItem, Product } from "../types";

type CartContextValue = {
	items: CartItem[];
	itemCount: number;
	subtotal: number;
	addItem: (product: Product, quantity?: number) => void;
	removeItem: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number) => void;
	clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
	const [items, setItems] = useState<CartItem[]>([]);

	const addItem = useCallback((product: Product, quantity = 1) => {
		setItems((prev) => {
			const existing = prev.find((i) => i.product.id === product.id);
			if (existing) {
				return prev.map((i) =>
					i.product.id === product.id
						? { ...i, quantity: i.quantity + quantity }
						: i,
				);
			}
			return [...prev, { product, quantity }];
		});
	}, []);

	const removeItem = useCallback((productId: string) => {
		setItems((prev) => prev.filter((i) => i.product.id !== productId));
	}, []);

	const updateQuantity = useCallback((productId: string, quantity: number) => {
		setItems((prev) =>
			quantity <= 0
				? prev.filter((i) => i.product.id !== productId)
				: prev.map((i) =>
						i.product.id === productId ? { ...i, quantity } : i,
					),
		);
	}, []);

	const clear = useCallback(() => setItems([]), []);

	const value = useMemo<CartContextValue>(() => {
		const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
		const subtotal = items.reduce(
			(sum, i) => sum + i.product.price * i.quantity,
			0,
		);
		return { items, itemCount, subtotal, addItem, removeItem, updateQuantity, clear };
	}, [items, addItem, removeItem, updateQuantity, clear]);

	return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
	const ctx = useContext(CartContext);
	if (!ctx) throw new Error("useCart must be used within CartProvider");
	return ctx;
}
