export function createLaunchState({ tokenSymbol, saleSupply, lpSupply, startPrice, slope }) {
    const s = Number(saleSupply);
    const l = Number(lpSupply);
    const p0 = Number(startPrice);
    const k = Number(slope);

    if (!tokenSymbol) throw new Error('tokenSymbol required');
    if (!Number.isFinite(s) || s <= 0) throw new Error('saleSupply must be > 0');
    if (!Number.isFinite(l) || l <= 0) throw new Error('lpSupply must be > 0');
    if (!Number.isFinite(p0) || p0 <= 0) throw new Error('startPrice must be > 0');
    if (!Number.isFinite(k) || k < 0) throw new Error('slope must be >= 0');

    return {
        schema: 'fennec.launch.state.v1',
        tokenSymbol: String(tokenSymbol).toUpperCase(),
        saleSupply: s,
        lpSupply: l,
        startPrice: p0,
        slope: k,
        sold: 0,
        reserve: 0,
        migrated: false,
        lp: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

export function priceAt(state, sold) {
    return state.startPrice + state.slope * sold;
}

export function quoteBuy(state, amountTokens) {
    if (state.migrated) throw new Error('launch migrated');
    const dx = Number(amountTokens);
    if (!Number.isFinite(dx) || dx <= 0) throw new Error('amountTokens must be > 0');
    if (state.sold + dx > state.saleSupply) throw new Error('insufficient sale supply');

    const s = state.sold;
    const p0 = state.startPrice;
    const k = state.slope;

    const cost = p0 * dx + k * (s * dx + 0.5 * dx * dx);
    const avgPrice = cost / dx;

    return {
        amountTokens: dx,
        cost,
        avgPrice,
        startPrice: priceAt(state, s),
        endPrice: priceAt(state, s + dx)
    };
}

export function buy(state, amountTokens) {
    const q = quoteBuy(state, amountTokens);
    state.sold += q.amountTokens;
    state.reserve += q.cost;
    state.updatedAt = new Date().toISOString();
    return q;
}
