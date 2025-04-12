// src/llm.js - Handles LLM interaction (Gemini API)

const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require("@google/generative-ai");
const retry = require('async-retry');
const fs = require('fs').promises;
const path = require('path');
// Removed safeStorage import
const log = require('electron-log'); // Import electron-log

// --- Configuration Variables ---
let GEMINI_API_KEY = null; // Initialize as null, will be loaded
let MODEL_NAME = "gemini-2.5-pro-preview-03-25"; // Default model
let LLM_TEMPERATURE = 1;
let LLM_MAX_OUTPUT_TOKENS = 65536;
let apiKeySource = 'not loaded'; // Track where the key came from

let model; // LLM model instance
let initializationError = null; // Store initialization errors
let configError = null; // Store config read errors

// Define CancellationError if not already defined globally or imported
class CancellationError extends Error {
  constructor(message = "Operation cancelled by user.") {
    super(message);
    this.name = "CancellationError";
  }
}

/**
 * Asynchronously loads configuration from safeStorage, config.json, and environment variables,
 * then initializes the LLM model. Should be called once after app is ready.
 */
async function loadConfigAndInitialize() {
    configError = null; // Reset potential config read errors
    GEMINI_API_KEY = null; // Reset key before loading
    apiKeySource = 'not loaded'; // Reset source

    // 1. Prioritize Environment Variable
    const envApiKey = process.env.GEMINI_API_KEY;
    if (envApiKey) {
        GEMINI_API_KEY = envApiKey;
        apiKeySource = 'environment variable';
        log.info("Using GEMINI_API_KEY from environment variable."); // Use log.info
    }

    // 2. Fallback to config.json (if env var not found)
    const configPath = path.join(__dirname, '..', 'config.json');
    let config = {};
    if (!GEMINI_API_KEY) {
        try {
            log.info(`Attempting to read configuration from: ${configPath}`); // Use log.info
            const configData = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(configData);
            log.info("Successfully read config.json"); // Use log.info

            // Check for API key in config.json
            if (config.GEMINI_API_KEY && typeof config.GEMINI_API_KEY === 'string' && config.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE") {
                GEMINI_API_KEY = config.GEMINI_API_KEY;
                apiKeySource = 'config.json (insecure)';
                log.warn("WARNING: Using GEMINI_API_KEY from insecure config.json. Set environment variable instead."); // Use log.warn
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                log.info("config.json not found. Cannot load API key from it."); // Use log.info
            } else if (error instanceof SyntaxError) {
                log.error(`Error parsing config.json: ${error.message}.`); // Use log.error
                configError = `Error parsing config.json: ${error.message}`;
            } else {
                log.error(`Unexpected error reading config.json: ${error.message}.`); // Use log.error
                configError = `Error reading config.json: ${error.message}`;
            }
        }
    } else {
        // If key came from env var, still try to load other settings from config.json
        try {
            log.info(`Attempting to read other settings from: ${configPath}`);
            const configData = await fs.readFile(configPath, 'utf8');
            config = JSON.parse(configData);
            log.info("Successfully read config.json for other settings.");
        } catch (error) {
             if (error.code !== 'ENOENT') { // Ignore if file not found, but log other errors
                log.error(`Error reading config.json for other settings: ${error.message}`);
                if (!configError) configError = `Error reading config.json: ${error.message}`;
             }
        }
    }

    // 3. Load other config values (Model, Temp, Tokens) from parsed config object (if loaded)
    if (config) {
         MODEL_NAME = (config.LLM_MODEL_NAME && typeof config.LLM_MODEL_NAME === 'string') ? config.LLM_MODEL_NAME : MODEL_NAME;
        if (typeof config.LLM_TEMPERATURE === 'number' && config.LLM_TEMPERATURE >= 0.0 && config.LLM_TEMPERATURE <= 1.0) {
            LLM_TEMPERATURE = config.LLM_TEMPERATURE;
        }
        if (typeof config.LLM_MAX_OUTPUT_TOKENS === 'number' && config.LLM_MAX_OUTPUT_TOKENS > 0) {
            LLM_MAX_OUTPUT_TOKENS = Math.floor(config.LLM_MAX_OUTPUT_TOKENS);
        }
         log.info(`Using Model: ${MODEL_NAME}, Temp: ${LLM_TEMPERATURE ?? 'Default'}, MaxTokens: ${LLM_MAX_OUTPUT_TOKENS ?? 'Default'}`); // Use log.info
    }


    // 4. Final check if key is missing after checking env and config
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
         apiKeySource = 'missing';
         const missingKeyMsg = "GEMINI_API_KEY is missing. Please set the environment variable.";
         log.error(missingKeyMsg); // Use log.error
         configError = (configError ? configError + '; ' : '') + missingKeyMsg;
    }

    // --- Initialize LLM ---
    initializeLLMInternal(); // This function uses the globally set GEMINI_API_KEY
}

/**
 * Internal function to initialize the Google Generative AI model instance.
 * Uses the globally scoped configuration variables.
 */
function initializeLLMInternal() {
    initializationError = configError; // Start with potential config read errors
    model = undefined; // Reset model

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
        const keyErrorMsg = `GEMINI_API_KEY is missing or placeholder (source: ${apiKeySource}). Please set it via the application.`;
        initializationError = (initializationError ? initializationError + '; ' : '') + keyErrorMsg;
        log.error(keyErrorMsg); // Use log.error
    }
    // MODEL_NAME has a default, less critical to check

    // Only attempt initialization if the key seems valid
    if (GEMINI_API_KEY && GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE" && MODEL_NAME) {
        try {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const generationConfig = {};
            if (LLM_TEMPERATURE !== undefined) generationConfig.temperature = LLM_TEMPERATURE;
            if (LLM_MAX_OUTPUT_TOKENS !== undefined) generationConfig.maxOutputTokens = LLM_MAX_OUTPUT_TOKENS;

            model = genAI.getGenerativeModel({
                 model: MODEL_NAME,
                 generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
                });
            log.info(`LLM model "${MODEL_NAME}" initialized successfully using API key from ${apiKeySource}.`); // Use log.info
            log.info(`Generation Config: ${JSON.stringify(generationConfig) || 'Using defaults'}`); // Use log.info
            initializationError = null; // Clear errors on success
        } catch (error) {
            const initErrMsg = `Failed to initialize LLM model "${MODEL_NAME}" with GoogleGenerativeAI (key source: ${apiKeySource}): ${error.message}`;
            initializationError = (initializationError ? initializationError + '; ' : '') + initErrMsg;
            log.error(initErrMsg); // Use log.error
            model = undefined;
        }
    } else {
         log.error("Skipping LLM initialization due to missing or placeholder API key."); // Use log.error
         model = undefined;
    }
}

// --- Helper Functions ---

// Removed isApiKeyStoredSecurely and saveApiKeySecurely functions

/**
 * Calls the configured LLM with the given prompt.
 * Handles retries and potential initialization errors.
 * @param {string} prompt - The prompt to send to the LLM.
 * @param {object} [retryOptions] - Options for async-retry.
 * @param {{isCancellationRequested: boolean}} [cancellationToken] - Optional token to check for cancellation.
 * @returns {Promise<string>} The text response from the LLM.
 * @throws {Error|CancellationError} If initialization failed, the LLM call fails after retries, or is cancelled.
 */
async function callLLM(prompt, retryOptions = { retries: 3, factor: 2, minTimeout: 1000, maxTimeout: 10000 }, cancellationToken) {
    // Check for cancellation before even attempting
    if (cancellationToken?.isCancellationRequested) {
        log.warn("LLM call cancelled before starting."); // Use log.warn
        throw new CancellationError("LLM call cancelled before starting.");
    }

    if (initializationError) {
        // If initialization failed earlier, throw the stored error immediately.
        throw new Error(`LLM Initialization Error: ${initializationError}`);
    }
    if (!model) {
        // This case should theoretically be covered by initializationError, but as a safeguard:
        throw new Error(`LLM model ("${MODEL_NAME}") is not available. Check configuration and logs.`);
    }

    // Default options: 3 retries, exponential backoff (factor 2), starting at 1s, max 10s delay
    return retry(async (bail, attempt) => {
        // Check for cancellation before each retry attempt
        if (cancellationToken?.isCancellationRequested) {
            log.warn(`LLM call cancelled before attempt ${attempt}.`); // Use log.warn
            bail(new CancellationError(`LLM call cancelled before attempt ${attempt}.`)); // Use bail to stop retries
            return; // Exit async function
        }
        try {
            log.info(`Sending prompt to "${MODEL_NAME}" (Attempt ${attempt})... (First ~50 chars: ${prompt.substring(0, 50)}...)`); // Use log.info
            // Note: The Gemini SDK's generateContent might not directly support a cancellation token.
            // We rely on checking the token *before* the potentially long-running call.
            const result = await model.generateContent(prompt);
            const response = result.response;

            // Check for safety ratings or blocks which might indicate an issue
            if (response.promptFeedback?.blockReason) {
                log.error(`LLM call blocked. Reason: ${response.promptFeedback.blockReason}`, response.promptFeedback); // Use log.error
                // Bail immediately if blocked, retrying won't help
                bail(new Error(`LLM call blocked due to safety settings: ${response.promptFeedback.blockReason}`));
                return; // Ensure bail stops execution here
            }

            const text = response.text();
            log.info(`Received response from "${MODEL_NAME}" (Attempt ${attempt}). (Length: ${text.length})`); // Use log.info
            if (!text || text.trim().length === 0) {
                log.warn(`LLM "${MODEL_NAME}" returned empty response on attempt ${attempt}.`); // Use log.warn
                // Throw specific error to trigger retry for empty responses
                throw new Error("LLM returned an empty response."); // Retryable error
            }
            return text;
            } catch (error) {
            log.error(`Error calling "${MODEL_NAME}" on attempt ${attempt}:`, error.message); // Use log.error
            // Check for specific error types that shouldn't be retried
            if (error.message.includes('API key not valid')) {
                log.error("Gemini API key is invalid. Bailing out."); // Use log.error
                bail(new Error(`LLM API call failed due to invalid API key: ${error.message}`));
                return;
            }
            if (error.message.includes('LLM call blocked')) {
                log.error("LLM call blocked by safety settings. Bailing out."); // Use log.error
                bail(error); // Already bailed, just rethrow
                return;
            }
            // Check for potentially non-retryable Google AI errors (e.g., 4xx client errors other than rate limits)
            if (error instanceof GoogleGenerativeAIFetchError && error.status >= 400 && error.status < 500 && error.status !== 429) {
                log.error(`Received client error ${error.status}. Bailing out.`); // Use log.error
                bail(new Error(`LLM call failed with client error ${error.status}: ${error.message}`));
                return;
            }

            // Log reason for retry before throwing
            if (error.message === "LLM returned an empty response.") {
                log.info(`Retrying LLM call due to empty response...`); // Use log.info
            } else if (error instanceof GoogleGenerativeAIFetchError && error.status === 502) {
                log.info(`Retrying LLM call due to 502 Bad Gateway...`); // Use log.info
            } else if (error instanceof GoogleGenerativeAIFetchError && error.status === 429) {
                log.info(`Retrying LLM call due to 429 Rate Limit Exceeded...`); // Use log.info
            } else {
                log.info(`Retrying LLM call due to other error: ${error.name}...`); // Use log.info
            }

            throw error; // Rethrow to trigger retry for retryable errors (like 5xx, 429, empty response, network issues)
        }
    }, retryOptions); // Use the passed or default retryOptions
}

module.exports = {
    callLLM,
    loadConfigAndInitialize, // Export the loader function to be called by main.js
    // Removed exports for isApiKeyStoredSecurely and saveApiKeySecurely
    // Export model name or status if needed by UI, e.g., via another IPC handler
    // getInitializationError: () => initializationError, // Example getter
    // getApiKeySource: () => apiKeySource // Example getter
};
