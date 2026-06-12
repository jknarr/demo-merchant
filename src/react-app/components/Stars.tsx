export function Stars({ rating }: { rating: number }) {
	const full = Math.floor(rating);
	const half = rating - full >= 0.5;
	const empty = 5 - full - (half ? 1 : 0);
	return (
		<span className="jp-stars" aria-label={`${rating} out of 5 stars`}>
			{"★".repeat(full)}
			{half ? "⯨" : ""}
			{"☆".repeat(empty)}
		</span>
	);
}
