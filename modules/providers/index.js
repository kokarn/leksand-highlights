const SHLProvider = require('./shl');
const BiathlonProvider = require('./biathlon');
const AllsvenskanProvider = require('./allsvenskan');
const OlympicsHockeyProvider = require('./olympics-hockey');
const SvenskaCupenProvider = require('./svenska-cupen');

// Available providers by sport
const providers = {
    shl: SHLProvider,
    allsvenskan: AllsvenskanProvider,
    'svenska-cupen': SvenskaCupenProvider,
    biathlon: BiathlonProvider,
    'olympics-hockey': OlympicsHockeyProvider
};

// Provider instances (singletons per sport)
const providerInstances = {};

/**
 * Get a provider by sport name
 * @param {string} sport - Sport name (e.g., 'shl', 'biathlon')
 * @returns {BaseProvider} The provider instance
 */
function getProvider(sport = 'shl') {
    const sportKey = sport.toLowerCase();

    if (!providerInstances[sportKey]) {
        const Provider = providers[sportKey];

        if (!Provider) {
            throw new Error(`Unknown provider: ${sport}. Available: ${Object.keys(providers).join(', ')}`);
        }

        providerInstances[sportKey] = new Provider();
        console.log(`[Provider] Initialized ${providerInstances[sportKey].getName()} data provider`);
    }

    return providerInstances[sportKey];
}

/**
 * Get all available sport providers
 * @returns {Object} Map of sport name to provider instance
 */
function getAllProviders() {
    return Object.keys(providers).reduce((acc, sport) => {
        acc[sport] = getProvider(sport);
        return acc;
    }, {});
}

/**
 * Get list of available sports
 * @returns {Array<string>} List of sport identifiers
 */
function getAvailableSports() {
    return Object.keys(providers);
}

/**
 * Set a specific provider (useful for testing)
 * @param {string} sport - Sport name
 * @param {BaseProvider} provider - Provider instance
 */
function setProvider(sport, provider) {
    providerInstances[sport.toLowerCase()] = provider;
    console.log(`[Provider] Switched to ${provider.getName()} data provider for ${sport}`);
}

/**
 * Reset a specific provider or all providers (useful for testing)
 * @param {string} sport - Optional sport name. If not provided, resets all.
 */
function resetProvider(sport = null) {
    if (sport) {
        delete providerInstances[sport.toLowerCase()];
    } else {
        Object.keys(providerInstances).forEach(key => delete providerInstances[key]);
    }
}

module.exports = {
    getProvider,
    getAllProviders,
    getAvailableSports,
    setProvider,
    resetProvider,
    providers
};
