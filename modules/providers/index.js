const SHLProvider = require('./shl');

// Available providers
const providers = {
    shl: SHLProvider
};

// Active provider instance (singleton)
let activeProvider = null;

/**
 * Get the active data provider
 * @returns {BaseProvider} The active provider instance
 */
function getProvider() {
    if (!activeProvider) {
        // Default to SHL provider
        const providerName = process.env.DATA_PROVIDER || 'shl';
        const Provider = providers[providerName.toLowerCase()];

        if (!Provider) {
            throw new Error(`Unknown provider: ${providerName}. Available: ${Object.keys(providers).join(', ')}`);
        }

        activeProvider = new Provider();
        console.log(`[Provider] Using ${activeProvider.getName()} data provider`);
    }
    return activeProvider;
}

/**
 * Set a specific provider (useful for testing)
 * @param {BaseProvider} provider - Provider instance
 */
function setProvider(provider) {
    activeProvider = provider;
    console.log(`[Provider] Switched to ${provider.getName()} data provider`);
}

/**
 * Reset the provider (useful for testing)
 */
function resetProvider() {
    activeProvider = null;
}

module.exports = {
    getProvider,
    setProvider,
    resetProvider,
    providers
};
