import type { Product } from "../types";

export const CATEGORIES = [
	"All",
	"Electronics",
	"Home & Kitchen",
	"Books",
	"Outdoors",
	"Toys",
	"Grocery",
] as const;

export const PRODUCTS: Product[] = [
	{
		id: "p-001",
		title: "Knarrwhal Wireless Noise-Cancelling Headphones",
		price: 129.99,
		category: "Electronics",
		rating: 4.5,
		reviewCount: 8421,
		image: "🎧",
		description:
			"Crystal-clear sound, 40-hour battery life, and active noise cancellation. Pair with any device over Bluetooth 5.3.",
		prime: true,
	},
	{
		id: "p-002",
		title: "Jimporium Echo Smart Speaker (3rd Gen)",
		price: 79.0,
		category: "Electronics",
		rating: 4.6,
		reviewCount: 12903,
		image: "🔊",
		description:
			"Premium sound and a built-in smart hub. Just ask — turn on lights, play music, or order more Knarr-brand snacks.",
		prime: true,
	},
	{
		id: "p-003",
		title: "JimKindle Paperwhite E-Reader",
		price: 149.99,
		category: "Electronics",
		rating: 4.7,
		reviewCount: 30245,
		image: "📱",
		description:
			"7-inch glare-free display, 10-week battery, waterproof. Holds thousands of books — read like a Viking.",
		prime: true,
	},
	{
		id: "p-004",
		title: "Knarr-Brew 12-Cup Programmable Coffee Maker",
		price: 49.95,
		category: "Home & Kitchen",
		rating: 4.3,
		reviewCount: 2104,
		image: "☕",
		description:
			"Wake up to fresh coffee. Programmable 24-hour timer, pause-and-pour, and a permanent gold-tone filter.",
		prime: true,
	},
	{
		id: "p-005",
		title: "Jimporium Stainless Steel Kitchen Knife Set",
		price: 89.0,
		category: "Home & Kitchen",
		rating: 4.4,
		reviewCount: 5520,
		image: "🔪",
		description:
			"8-piece pro chef set with hardwood block. Forged from German stainless steel. Comes with a sharpener.",
	},
	{
		id: "p-006",
		title: "The Knarr Saga: A Viking's Guide to E-Commerce",
		price: 18.99,
		category: "Books",
		rating: 4.8,
		reviewCount: 412,
		image: "📚",
		description:
			"A surprisingly relatable memoir from a 9th-century Norse trader who would have absolutely crushed it on a marketplace.",
		prime: true,
	},
	{
		id: "p-007",
		title: "Programming Payments with Paze (2nd Edition)",
		price: 39.99,
		category: "Books",
		rating: 4.6,
		reviewCount: 188,
		image: "📕",
		description:
			"The definitive technical guide to integrating modern wallet checkout. Covers JS SDK, cert handling, and webhook best practices.",
	},
	{
		id: "p-008",
		title: "Jim's 4-Person Family Camping Tent",
		price: 134.5,
		category: "Outdoors",
		rating: 4.5,
		reviewCount: 1804,
		image: "⛺",
		description:
			"Easy-pitch in 60 seconds, double-wall rainfly, taped seams, and a vestibule big enough for boots and gear.",
		prime: true,
	},
	{
		id: "p-009",
		title: "Knarr-Trail Hiking Daypack 30L",
		price: 64.99,
		category: "Outdoors",
		rating: 4.7,
		reviewCount: 3210,
		image: "🎒",
		description:
			"Ripstop nylon, hydration-compatible, ventilated back panel. Hip belt with zip pockets for snacks.",
	},
	{
		id: "p-010",
		title: "Build-A-Knarr Viking Longship LEGO-Style Kit",
		price: 59.99,
		category: "Toys",
		rating: 4.9,
		reviewCount: 922,
		image: "🚢",
		description:
			"1,204 pieces. Functional sail, removable dragon prow, and 8 minifigure rowers. Ages 9+.",
		prime: true,
	},
	{
		id: "p-011",
		title: "Plush Knarrwhal Stuffed Animal — Jumbo",
		price: 24.99,
		category: "Toys",
		rating: 4.8,
		reviewCount: 5601,
		image: "🦄",
		description:
			"24 inches of huggable polyester narwhal. Embroidered eyes, hypoallergenic fill. Official Jimporium mascot.",
		prime: true,
	},
	{
		id: "p-012",
		title: "Knarr Roasters Whole Bean Coffee — 2 lb bag",
		price: 21.99,
		category: "Grocery",
		rating: 4.5,
		reviewCount: 7740,
		image: "🫘",
		description:
			"Medium-dark roast, single-origin Colombian. Notes of dark chocolate, caramel, and a hint of victorious plunder.",
		prime: true,
	},
	{
		id: "p-013",
		title: "Jim's Variety Pack — Artisan Trail Mix (12 ct)",
		price: 17.49,
		category: "Grocery",
		rating: 4.4,
		reviewCount: 2120,
		image: "🥜",
		description:
			"Twelve individually-packed 1.5 oz bags. Almonds, cashews, dried cranberries, dark chocolate.",
	},
	{
		id: "p-014",
		title: "Jimporium Basics USB-C 100W Charger",
		price: 22.99,
		category: "Electronics",
		rating: 4.4,
		reviewCount: 14250,
		image: "🔌",
		description:
			"Compact GaN charger powers laptops, tablets, and phones. Foldable prongs, dual USB-C ports.",
		prime: true,
	},
	{
		id: "p-015",
		title: "Jimporium Basics Memory Foam Pillow (2-pack)",
		price: 34.0,
		category: "Home & Kitchen",
		rating: 4.2,
		reviewCount: 9912,
		image: "🛏️",
		description:
			"Adaptive memory foam, breathable cover, machine washable. Sleep like a king in his longhouse.",
	},
];

export function getProductById(id: string): Product | undefined {
	return PRODUCTS.find((p) => p.id === id);
}
