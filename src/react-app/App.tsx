import "./App.css";
import { CartProvider } from "./context/CartContext";
import { NavProvider, useNav } from "./context/NavContext";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { ProductDetail } from "./components/ProductDetail";
import { Cart } from "./components/Cart";
import { Checkout } from "./components/Checkout";
import { Confirmation } from "./components/Confirmation";

function Router() {
	const { view } = useNav();
	switch (view.name) {
		case "home":
			return <Home />;
		case "product":
			return <ProductDetail productId={view.productId} />;
		case "cart":
			return <Cart />;
		case "checkout":
			return <Checkout />;
		case "confirmation":
			return (
				<Confirmation
					orderId={view.orderId}
					cardBrand={view.cardBrand}
					panLastFour={view.panLastFour}
					buyerName={view.buyerName}
				/>
			);
	}
}

function Footer() {
	return (
		<footer className="jp-footer">
			<div className="jp-footer__logo">
				Jim<span className="accent">porium</span>
			</div>
			<div>© Jim Knarr · Demo merchant · Powered by Paze sandbox</div>
		</footer>
	);
}

function App() {
	return (
		<CartProvider>
			<NavProvider>
				<Header />
				<Router />
				<Footer />
			</NavProvider>
		</CartProvider>
	);
}

export default App;
