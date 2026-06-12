import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { View } from "../types";

type NavContextValue = {
	view: View;
	category: string;
	query: string;
	setView: (v: View) => void;
	setCategory: (c: string) => void;
	setQuery: (q: string) => void;
	goHome: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

function viewToPath(v: View): string {
	switch (v.name) {
		case "home":
			return "/";
		case "product":
			return `/product/${encodeURIComponent(v.productId)}`;
		case "cart":
			return "/cart";
		case "checkout":
			return "/checkout";
		case "confirmation":
			return `/order/${encodeURIComponent(v.orderId)}`;
	}
}

function pathToView(pathname: string): View {
	const p = pathname.replace(/\/+$/, "") || "/";
	if (p === "/" || p === "") return { name: "home" };
	if (p === "/cart") return { name: "cart" };
	if (p === "/checkout") return { name: "checkout" };
	const productMatch = p.match(/^\/product\/([^/]+)$/);
	if (productMatch) {
		return { name: "product", productId: decodeURIComponent(productMatch[1]) };
	}
	const orderMatch = p.match(/^\/order\/([^/]+)$/);
	if (orderMatch) {
		return { name: "confirmation", orderId: decodeURIComponent(orderMatch[1]) };
	}
	return { name: "home" };
}

function readInitialView(): View {
	if (typeof window === "undefined") return { name: "home" };
	const state = window.history.state as { view?: View } | null;
	if (state?.view) return state.view;
	return pathToView(window.location.pathname);
}

export function NavProvider({ children }: { children: ReactNode }) {
	const [view, setViewState] = useState<View>(readInitialView);
	const [category, setCategory] = useState<string>("All");
	const [query, setQuery] = useState<string>("");

	useEffect(() => {
		// Seed history with the current view so the very first popstate
		// (after at least one pushState) has somewhere to land.
		if (!(window.history.state as { view?: View } | null)?.view) {
			window.history.replaceState({ view }, "", viewToPath(view));
		}
		const onPopState = (e: PopStateEvent) => {
			const v: View =
				(e.state as { view?: View } | null)?.view ??
				pathToView(window.location.pathname);
			setViewState(v);
			window.scrollTo({ top: 0, behavior: "instant" });
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const setView = useCallback((v: View) => {
		window.history.pushState({ view: v }, "", viewToPath(v));
		setViewState(v);
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);

	const goHome = useCallback(() => {
		setQuery("");
		setCategory("All");
		setView({ name: "home" });
	}, [setView]);

	const value = useMemo<NavContextValue>(
		() => ({ view, category, query, setView, setCategory, setQuery, goHome }),
		[view, category, query, setView, goHome],
	);

	return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
	const ctx = useContext(NavContext);
	if (!ctx) throw new Error("useNav must be used within NavProvider");
	return ctx;
}
