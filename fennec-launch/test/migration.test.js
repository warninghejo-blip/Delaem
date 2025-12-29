import test from 'node:test';
import assert from 'node:assert/strict';
import { createLaunchState, buy } from '../lib/curve_engine.js';
import { canMigrate, migrate } from '../lib/migration_manager.js';

test('migration adds 100% of reserve to LP', () => {
    const state = createLaunchState({
        tokenSymbol: 'FENNEC',
        saleSupply: 1000,
        lpSupply: 250,
        startPrice: 1,
        slope: 0.01
    });

    const q1 = buy(state, 400);
    const q2 = buy(state, 600);

    const raised = q1.cost + q2.cost;
    assert.equal(state.sold, 1000);
    assert.equal(state.reserve, raised);
    assert.equal(canMigrate(state), true);

    const lp = migrate(state);
    assert.equal(lp.reserveAmount, raised);
    assert.equal(state.reserve, 0);
    assert.equal(state.migrated, true);
    assert.equal(state.lp.reserveAmount, raised);
});
