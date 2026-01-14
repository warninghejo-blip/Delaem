(function () {
    // === MODULAR LORE DATABASE ===

    // Part 1: Identity (depends on Archetype)
    const IDENTITY_DB = {
        DRIFTER: {
            prefixes: ['Silent', 'Nomadic', 'Dust-covered', 'Wandering', 'High-speed', 'Lonely', 'Wind-borne'],
            nouns: ['Strider', 'Runner', 'Ghost', 'Vagrant', 'Scout', 'Pathfinder', 'Traveler']
        },
        MERCHANT: {
            prefixes: ['Golden', 'Calculating', 'Wealthy', 'Neon', 'Licensed', 'Digital', 'Arbitrage'],
            nouns: ['Broker', 'Tycoon', 'Dealer', 'Baron', 'Architect', 'Vendor', 'Executive']
        },
        ENGINEER: {
            prefixes: ['Optimized', 'Overclocked', 'Neural', 'Cybernetic', 'Rooted', 'Encrypted', 'Compiled'],
            nouns: ['Architect', 'Coder', 'Operator', 'Hacker', 'Builder', 'Technomancer', 'Unit']
        },
        SHAMAN: {
            prefixes: ['Mystic', 'Ancient', 'Glowing', 'Ethereal', 'Chanting', 'Prophetic', 'Ritual'],
            nouns: ['Seer', 'Oracle', 'Medium', 'Spirit', 'Summoner', 'Sage', 'Visionary']
        },
        KEEPER: {
            prefixes: ['Eternal', 'Remembering', 'Archived', 'Immutable', 'Silent', 'Watchful', 'Recorded'],
            nouns: ['Librarian', 'Observer', 'Guardian', 'Scribe', 'Witness', 'Custodian', 'Sentinel']
        },
        WALKER: {
            prefixes: ['Timeless', 'Steady', 'Ancient', 'Unstoppable'],
            nouns: ['Pilgrim', 'Walker', 'Monk', 'Entity']
        },
        LORD: {
            prefixes: ['Sovereign', 'Imperial', 'Grand', 'Crowned', 'Absolute', 'Dominant', 'Royal'],
            nouns: ['Ruler', 'Monarch', 'Emperor', 'Regent', 'Overlord', 'Commander', 'King']
        },
        PRIME: {
            prefixes: ['Apex', 'Prime', 'Luminous', 'Perfect', 'Ascended', 'Radiant', 'Supreme'],
            nouns: ['Being', 'Core', 'Form', 'Standard', 'Alpha', 'Source', 'Light']
        },
        SINGULARITY: {
            prefixes: ['Void', 'Infinite', 'Null', 'Event', 'Collapsed', 'Final', 'Undefined'],
            nouns: ['Anomaly', 'Point', 'Horizon', 'Error', 'God', 'Variable', 'Entropy']
        }
    };

    // Part 2: Achievements (depends on Badges and Stats)
    const SUFFIX_DB = {
        // --- BADGES ---
        GENESIS: [
            'forged in the first block.',
            'present since Day Zero.',
            'carrying the Genesis spark.',
            'witnessing the creation.',
            'awakened at the beginning.'
        ],
        WHALE: [
            'manipulating gravity wells.',
            'controlling market tides.',
            'with massive capital allocation.',
            'displacing the mempool.',
            'commanding heavy liquidity.'
        ],
        PROVIDER: [
            'fueling the ecosystem.',
            'stabilizing the flow.',
            'keeping the oasis alive.',
            'bridging the void.',
            'generating yield in silence.'
        ],
        'FENNEC MAXI': [
            'loyal to the Pack.',
            'bleeding orange neon.',
            'guided by the Fox Spirit.',
            'following the True Path.',
            'fully synchronized with Fennec.'
        ],
        'ARTIFACT HUNTER': [
            'collecting digital relics.',
            'archiving rare data.',
            'hunting for inscriptions.',
            'preserving lost history.',
            'with a trove of artifacts.'
        ],
        'RUNE KEEPER': [
            'deciphering ancient glyphs.',
            'reading the rune stream.',
            'etched with protocol magic.',
            'holding runic power.',
            'speaking the old tongue.'
        ],
        'MEMPOOL RIDER': [
            'surfing the zero-block.',
            'faster than confirmation.',
            'living between blocks.',
            'riding the lightning.',
            'bypassing the queue.'
        ],

        // --- STATS ---
        RICH: [
            'accumulating vast resources.',
            'building a digital empire.',
            'shining with gold.',
            'holding the keys to power.'
        ],
        OLD: [
            'surviving every cycle.',
            'eroded by digital winds.',
            'standing the test of time.',
            'watching tokens rise and fall.'
        ],
        NEW: ['just entering the simulation.', 'initializing connection.', 'scanning for signals.', 'ready to evolve.'],

        // --- DEFAULT ---
        DEFAULT: [
            'exploring the fractal depths.',
            'searching for a signal.',
            'navigating the noise.',
            'waiting for the next block.',
            'connected to the grid.'
        ]
    };

    window.getSmartLore = function (data) {
        const m = (data && data.metrics) || {};
        const archObj = (data && data.archetype) || {};

        const archKey = String(archObj.baseKey || 'DRIFTER').toUpperCase();

        const badgesArr = Array.isArray(archObj.badges)
            ? archObj.badges
            : Array.isArray(data && data.badges)
              ? data.badges
              : [];
        const userBadges = badgesArr
            .map(b => {
                try {
                    if (typeof b === 'string') return b;
                    return String(b && b.name ? b.name : '');
                } catch (_) {
                    return '';
                }
            })
            .map(s =>
                String(s || '')
                    .trim()
                    .toUpperCase()
            )
            .filter(Boolean);

        const addr = String(m.address || m.addr || '0x00');

        const getHash = seed => {
            let h = seed;
            for (let i = 0; i < addr.length; i++) h = (h << 5) - h + addr.charCodeAt(i);
            return Math.abs(h);
        };

        let identitySource = IDENTITY_DB[archKey] || IDENTITY_DB.DRIFTER;
        if (!identitySource || !identitySource.prefixes || !identitySource.nouns) identitySource = IDENTITY_DB.DRIFTER;

        const pIdx = getHash(1) % identitySource.prefixes.length;
        const nIdx = getHash(2) % identitySource.nouns.length;

        const prefix = identitySource.prefixes[pIdx];
        const noun = identitySource.nouns[nIdx];

        let possibleSuffixes = [];

        userBadges.forEach(badge => {
            let key = '';
            if (badge.includes('GENESIS')) key = 'GENESIS';
            else if (badge.includes('WHALE')) key = 'WHALE';
            else if (badge.includes('PROVIDER') || badge.includes('LIQUIDITY')) key = 'PROVIDER';
            else if (badge.includes('MAXI')) key = 'FENNEC MAXI';
            else if (badge.includes('ARTIFACT') || badge.includes('COLLECTOR')) key = 'ARTIFACT HUNTER';
            else if (badge.includes('RUNE')) key = 'RUNE KEEPER';
            else if (badge.includes('MEMPOOL')) key = 'MEMPOOL RIDER';

            if (key && SUFFIX_DB[key]) {
                possibleSuffixes.push(...SUFFIX_DB[key]);
                possibleSuffixes.push(...SUFFIX_DB[key]);
                possibleSuffixes.push(...SUFFIX_DB[key]);
            }
        });

        const wealth = parseFloat(m.wealth || m.netWorth || m.netWorthUSD || 0);
        const days = parseInt(m.daysAlive || m.days || 0);

        if (wealth > 500) possibleSuffixes.push(...SUFFIX_DB.RICH);
        if (days > 60) possibleSuffixes.push(...SUFFIX_DB.OLD);
        if (days >= 0 && days < 10) possibleSuffixes.push(...SUFFIX_DB.NEW);

        if (possibleSuffixes.length === 0) {
            possibleSuffixes = SUFFIX_DB.DEFAULT;
        }

        const sIdx = getHash(3 + userBadges.length) % possibleSuffixes.length;
        const suffix = possibleSuffixes[sIdx];

        return `${prefix} ${noun} // ${suffix}`;
    };
})();
