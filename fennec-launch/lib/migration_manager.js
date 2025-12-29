export function canMigrate(state) {
    return !state.migrated && state.sold >= state.saleSupply;
}

export function migrate(state) {
    if (!canMigrate(state)) throw new Error('cannot migrate');

    const lp = {
        schema: 'fennec.launch.lp.v1',
        token: state.tokenSymbol,
        tokenAmount: state.lpSupply,
        reserveAmount: state.reserve,
        createdAt: new Date().toISOString()
    };

    state.lp = lp;
    state.reserve = 0;
    state.migrated = true;
    state.updatedAt = new Date().toISOString();

    return lp;
}
