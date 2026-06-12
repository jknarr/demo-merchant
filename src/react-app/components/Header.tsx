import { useCart } from "../context/CartContext";
import { useNav } from "../context/NavContext";
import { CATEGORIES } from "../data/products";

export function Header() {
	const { itemCount } = useCart();
	const { setView, goHome, category, setCategory, query, setQuery } = useNav();

	return (
		<>
			<header className="jp-header">
				<button className="jp-header__logo" onClick={goHome} aria-label="Jimporium home">
					Jim<span className="accent">porium</span>
				</button>

				<div className="jp-header__deliver" title="Demo address">
					<div>Deliver to</div>
					<strong>Scottsdale 85258</strong>
				</div>

				<div className="jp-search" role="search">
					<select
						className="jp-search__cat"
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						aria-label="Search category"
					>
						{CATEGORIES.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
					<input
						className="jp-search__input"
						placeholder="Search Jimporium"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") setView({ name: "home" });
						}}
					/>
					<button
						className="jp-search__btn"
						onClick={() => setView({ name: "home" })}
						aria-label="Search"
					>
						🔍
					</button>
				</div>

				<div className="jp-header__right">
					<button className="jp-header__item" type="button">
						<small>Hello, Guest</small>
						<strong>Account & Lists</strong>
					</button>
					<button className="jp-header__item" type="button">
						<small>Returns</small>
						<strong>& Orders</strong>
					</button>
					<button
						className="jp-header__item jp-cart-btn"
						onClick={() => setView({ name: "cart" })}
						aria-label={`Cart with ${itemCount} items`}
					>
						<span style={{ fontSize: 22 }}>🛒</span>
						<span className="jp-cart-btn__count">{itemCount}</span>
						<span>Cart</span>
					</button>
				</div>
			</header>

			<nav className="jp-subnav" aria-label="Categories">
				{CATEGORIES.map((c) => (
					<button
						key={c}
						className={category === c ? "active" : ""}
						onClick={() => {
							setCategory(c);
							setView({ name: "home" });
						}}
					>
						{c}
					</button>
				))}
			</nav>
		</>
	);
}
