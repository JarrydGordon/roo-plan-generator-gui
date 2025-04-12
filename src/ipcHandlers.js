// src/ipcHandlers.js - Handles IPC communication for plan generation

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const log = require('electron-log'); // Import electron-log
const { runAdvancedReasoningEngine } = require('./engine'); // Import the main engine function
const { scaffoldProject, parseStructureFromJsonMd, parseOutlinesFromMd } = require('./utils'); // Import utils including parsers
const { callLLM } = require('./llm'); // Import the LLM call function
const { getSetupCommandsPrompt } = require('./prompts/utility/setupCommands'); // Import the new prompt loader

// Define CancellationError if not already defined globally or imported
class CancellationError extends Error {
  constructor(message = "Operation cancelled by user.") {
    super(message);
    this.name = "CancellationError";
  }
}

// Store active cancellation tokens (simple in-memory store)
const activeGenerationTokens = new Map();

// --- Helper Functions for generate-plan ---

/**
 * Prompts the user to select a directory to save the generated project files.
 * Creates the directory if it doesn't exist.
 * @param {Function} progressCallback - Function to report progress.
 * @returns {Promise<{cancelled: boolean, directoryPath: string|null}>} Object indicating if cancelled and the selected directory path.
 * @throws {Error} If directory creation fails.
 */
async function promptForSaveFolder(progressCallback) {
    progressCallback({ stage: 'Saving', message: 'Awaiting save location...' });
    const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
        title: 'Save Generated Project Files',
        buttonLabel: 'Save Files Here',
        defaultPath: 'roo-generated-project/placeholder.txt', // Suggest a subdirectory
        properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (canceled || !selectedPath) {
        log.info('Save dialog cancelled by user.'); // Use log.info
        progressCallback({ stage: 'Cancelled', message: 'Save operation cancelled.' });
        return { cancelled: true, directoryPath: null };
    }

    const directoryPath = path.dirname(selectedPath);
    // Ensure the target directory exists
    try {
        await fs.mkdir(directoryPath, { recursive: true });
    } catch (mkdirError) {
        if (mkdirError.code !== 'EEXIST') {
            log.error(`Failed to create target directory: ${directoryPath}`, mkdirError); // Use log.error
            progressCallback({ stage: 'Error', message: `Failed to create directory: ${mkdirError.message}` });
            throw new Error(`Failed to create directory: ${mkdirError.message}`); // Throw to be caught by main handler
        }
    }
    return { cancelled: false, directoryPath };
}

/**
 * Scaffolds the project directory structure based on the provided list.
 * @param {string} directoryPath - The base directory to scaffold within.
 * @param {Array<{type: string, path: string}>} proposedStructureList - List of files and directories to create.
 * @param {Record<string, string>} coreLogicOutlines - Outlines to add as comments to scaffolded files.
 * @param {Function} progressCallback - Function to report progress.
 * @returns {Promise<Array<{path: string, error: string}>>} A list of errors encountered during scaffolding.
 */
async function runScaffolding(directoryPath, proposedStructureList, coreLogicOutlines, progressCallback) {
    progressCallback({ stage: 'Scaffolding', message: 'Creating directory structure...' });
    let scaffoldingErrors = [];
    if (proposedStructureList && proposedStructureList.length > 0) {
        log.info(`Starting scaffolding for ${proposedStructureList.length} items...`); // Use log.info
        scaffoldingErrors = await scaffoldProject(directoryPath, proposedStructureList, coreLogicOutlines); // scaffoldProject logs internally now
        if (scaffoldingErrors.length > 0) {
            progressCallback({ stage: 'Scaffolding', message: `Scaffolding completed with ${scaffoldingErrors.length} error(s).` });
            log.warn(`Scaffolding completed with ${scaffoldingErrors.length} error(s):`, scaffoldingErrors); // Use log.warn
        } else {
            progressCallback({ stage: 'Scaffolding', message: 'Scaffolding completed successfully.' });
        }
    } else {
        // Log a warning if no structure list was provided or it was empty
        log.warn("runScaffolding called with no proposed structure list. Skipping scaffolding.");
        progressCallback({ stage: 'Scaffolding', message: 'No structure to scaffold.' });
    }
    return scaffoldingErrors;
}

/**
 * Saves the generated artifact files (like roo-plan.md, .clinerules, etc.) to the specified directory.
 * @param {string} directoryPath - The directory to save artifacts in.
 * @param {Record<string, string>} generatedArtifacts - An object where keys are filenames and values are file contents.
 * @param {Function} progressCallback - Function to report progress.
 * @returns {Promise<{savedArtifactCount: number, artifactSaveErrors: Array<{path: string, error: string}>}>} Object with count of saved files and any errors.
 */
async function saveGeneratedArtifacts(directoryPath, generatedArtifacts, progressCallback) {
    progressCallback({ stage: 'Saving Artifacts', message: 'Saving generated files...' });
    let savedArtifactCount = 0;
    let artifactSaveErrors = [];
    if (generatedArtifacts && Object.keys(generatedArtifacts).length > 0) {
        log.info(`Saving ${Object.keys(generatedArtifacts).length} artifact(s) to: ${directoryPath}`); // Use log.info
        for (const filename in generatedArtifacts) {
            if (Object.hasOwnProperty.call(generatedArtifacts, filename)) {
                const content = generatedArtifacts[filename];
                if (content === null || typeof content === 'undefined') {
                    log.warn(`Skipping saving artifact "${filename}" because content is null or undefined.`); // Use log.warn
                    continue;
                }
                const fullFilePath = path.join(directoryPath, filename);
                const fileDir = path.dirname(fullFilePath);
                if (fileDir !== directoryPath && fileDir !== '.') {
                    try {
                        await fs.mkdir(fileDir, { recursive: true });
                    } catch (mkdirError) {
                        if (mkdirError.code !== 'EEXIST') {
                            log.error(`Failed to create subdirectory for artifact: ${fileDir}`, mkdirError); // Use log.error
                            artifactSaveErrors.push({ path: filename, error: `Failed to create subdirectory: ${mkdirError.message}` });
                            continue;
                        }
                    }
                }
                try {
                    await fs.writeFile(fullFilePath, content);
                    log.info(`Saved: ${fullFilePath}`); // Use log.info
                    savedArtifactCount++;
                } catch (writeError) {
                    log.error(`Error saving artifact "${filename}" to ${fullFilePath}:`, writeError); // Use log.error
                    artifactSaveErrors.push({ path: filename, error: `File write error: ${writeError.message}` });
                }
            }
        }
        progressCallback({ stage: 'Saving Artifacts', message: `${savedArtifactCount} of ${Object.keys(generatedArtifacts).length} artifacts saved.` });
        if (artifactSaveErrors.length > 0) {
             log.warn(`Encountered ${artifactSaveErrors.length} error(s) while saving artifacts.`); // Use log.warn
        }
    } else {
         progressCallback({ stage: 'Saving Artifacts', message: 'No artifacts were generated to save.' });
         log.warn("No artifacts were generated to save."); // Use log.warn
    }
    return { savedArtifactCount, artifactSaveErrors };
}

/**
 * Generates suggested terminal commands for initial project setup (cd, npm install, git init, etc.).
 * @param {string} directoryPath - The path to the generated project directory.
 * @param {Record<string, string>} generatedArtifacts - The generated artifact files.
 * @param {Array<{type: string, path: string}>} proposedStructureList - The scaffolded project structure.
 * @param {Function} progressCallback - Function to report progress.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{suggestedCommands: string[], commandSuggestionText: string}>} Object with the list of commands and formatted text for display.
 */
async function suggestSetupCommandsLLM(directoryPath, generatedArtifacts, proposedStructureList, progressCallback, cancellationToken) {
    progressCallback({ stage: 'Setup Commands', message: 'Generating setup command suggestions...' }); // Corrected call
    if (cancellationToken.isCancellationRequested) throw new CancellationError("Cancelled before suggesting setup commands.");

    const artifactList = generatedArtifacts ? Object.keys(generatedArtifacts) : [];
    // Create a simple summary of the top-level structure
    const structureSummary = proposedStructureList
        ?.filter(item => !item.path.includes(path.sep)) // Filter for top-level items
        .map(item => `${item.type}: ${item.path}`)
        .join(', ') || 'N/A';

    const prompt = getSetupCommandsPrompt(directoryPath, artifactList, structureSummary);
    let suggestedCommands = [];
    let commandSuggestionText = "";

    try {
        let llmResponse = await callLLM(prompt, undefined, cancellationToken); // Pass token
        llmResponse = llmResponse.trim(); // Trim whitespace first

        // Clean potential Markdown fences before parsing
        if (llmResponse.startsWith('```json') && llmResponse.endsWith('```')) {
            llmResponse = llmResponse.substring(7, llmResponse.length - 3).trim();
        } else if (llmResponse.startsWith('```') && llmResponse.endsWith('```')) {
            llmResponse = llmResponse.substring(3, llmResponse.length - 3).trim();
        }

        // Attempt to parse the cleaned JSON response
        const parsedCommands = JSON.parse(llmResponse);
        if (Array.isArray(parsedCommands) && parsedCommands.every(cmd => typeof cmd === 'string')) {
            suggestedCommands = parsedCommands;
            log.info(`LLM suggested setup commands: ${suggestedCommands.join(', ')}`);
        } else {
            throw new Error("LLM response was not a valid JSON array of strings.");
        }
    } catch (error) {
        log.error(`Failed to generate or parse setup commands via LLM: ${error.message}`);
        log.warn("Falling back to basic setup command suggestions.");
        // Fallback to basic hardcoded logic
        suggestedCommands.push(`cd "${directoryPath}"`);
        const hasPackageJson = artifactList.includes('package.json') || proposedStructureList?.some(item => item.path.endsWith('package.json'));
        if (hasPackageJson) suggestedCommands.push(`npm install`);
        const hasRequirementsTxt = artifactList.includes('requirements.txt') || proposedStructureList?.some(item => item.path.endsWith('requirements.txt'));
        if (hasRequirementsTxt) suggestedCommands.push(`pip install -r requirements.txt`);
        suggestedCommands.push(`git init && git add . && git commit -m "Initial commit from RooCodeGen"`);
    }

    if (suggestedCommands.length > 0) {
        // Format for display (ensure 'cd' is first if not already)
        if (suggestedCommands[0] !== `cd "${directoryPath}"`) {
            suggestedCommands = suggestedCommands.filter(cmd => cmd !== `cd "${directoryPath}"`);
            suggestedCommands.unshift(`cd "${directoryPath}"`);
        }
        // Join commands appropriately for display in bash block
        const displayCommands = suggestedCommands.map((cmd, index) => {
            // Avoid adding '&& \' before the first command or after the last
            const suffix = index < suggestedCommands.length - 1 ? ' && \\' : '';
            return `${cmd}${suffix}`;
        });
        commandSuggestionText = `\n\nRecommended next steps in your terminal:\n\`\`\`bash\n${displayCommands.join('\n')}\n\`\`\``;
    }

    return { suggestedCommands, commandSuggestionText };
}


// --- Main IPC Handlers ---

/**
 * Sets up the main IPC handlers for plan generation and cancellation.
 */
function setupIpcHandlers() {
    // Handler for starting plan generation
    ipcMain.handle('generate-plan', async (event, projectIdea) => {
        const sender = event.sender; // Get the sender for sending progress updates
        const generationId = Date.now().toString(); // Simple unique ID for this generation task
        const cancellationToken = { isCancellationRequested: false };
        activeGenerationTokens.set(generationId, cancellationToken); // Store the token

        // Define the progress callback function
        const progressCallback = (progressData) => {
            // Ensure progressData has the expected structure
            if (progressData && progressData.stage && progressData.message) {
                // Include generationId for UI to potentially show cancel button
                sender.send('generation-progress', { ...progressData, generationId });
            } else {
                log.warn("Received invalid progress data:", progressData); // Use log.warn
                sender.send('generation-progress', { stage: 'Update', message: 'Processing...', generationId });
            }
        };

        try {
            // --- Run the entire generation engine with the callback and token ---
            const { artifacts: generatedArtifacts, structureList: proposedStructureList, outlines: coreLogicOutlines } = await runAdvancedReasoningEngine(projectIdea, progressCallback, cancellationToken);

            // --- Prompt for Save Location ---
            // Check cancellation *before* showing dialog
            if (cancellationToken.isCancellationRequested) throw new CancellationError("Operation cancelled before saving.");
            const { cancelled, directoryPath } = await promptForSaveFolder(progressCallback);
            if (cancelled) {
                 // If dialog was cancelled, ensure we clean up the token
                 activeGenerationTokens.delete(generationId);
                 log.info(`Generation ${generationId} cancelled by user during save dialog.`); // Use log.info
                 return { cancelled: true };
            }
             if (cancellationToken.isCancellationRequested) throw new CancellationError("Operation cancelled after save dialog."); // Check again after dialog

            // --- Run Scaffolding ---
            const scaffoldingErrors = await runScaffolding(directoryPath, proposedStructureList, coreLogicOutlines, progressCallback);
             if (cancellationToken.isCancellationRequested) throw new CancellationError("Operation cancelled during scaffolding."); // Check after scaffolding

            // --- Save Artifacts ---
            const { savedArtifactCount, artifactSaveErrors } = await saveGeneratedArtifacts(directoryPath, generatedArtifacts, progressCallback);
             if (cancellationToken.isCancellationRequested) throw new CancellationError("Operation cancelled during artifact saving."); // Check after saving

            // --- Prepare Final Response ---
            progressCallback({ stage: 'Complete', message: 'Generation process finished.' });
            const allErrors = [...scaffoldingErrors, ...artifactSaveErrors];
            let finalMessage = `Project generation complete. Files saved to ${directoryPath}.`;
            if (allErrors.length > 0) {
                const scaffoldErrorCount = scaffoldingErrors.length;
                const artifactErrorCount = artifactSaveErrors.length;
                let errorSummary = "Encountered errors: ";
                if (scaffoldErrorCount > 0) errorSummary += `${scaffoldErrorCount} scaffolding error(s)`;
                if (scaffoldErrorCount > 0 && artifactErrorCount > 0) errorSummary += " and ";
                if (artifactErrorCount > 0) errorSummary += `${artifactErrorCount} artifact saving error(s)`;
                finalMessage += ` ${errorSummary}. Check console logs.`;
                log.error("Detailed Errors during generation:", JSON.stringify(allErrors, null, 2)); // Use log.error
            }
            if (savedArtifactCount === 0 && scaffoldingErrors.length === 0 && (!proposedStructureList || proposedStructureList.length === 0)) {
                finalMessage = "Plan generated, but no artifacts or structure were created.";
            }
             if (cancellationToken.isCancellationRequested) throw new CancellationError("Operation cancelled before suggesting setup commands."); // Check before final step

            // --- Suggest Commands (using LLM) ---
            const { suggestedCommands, commandSuggestionText } = await suggestSetupCommandsLLM(directoryPath, generatedArtifacts, proposedStructureList, progressCallback, cancellationToken);
            finalMessage += commandSuggestionText;

            return {
                success: true,
                directoryPath: directoryPath,
                message: finalMessage,
                errors: allErrors,
                suggestedCommands: suggestedCommands
            };

        } catch (error) {
            // Catch errors from engine, saving, or scaffolding helpers
            log.error(`Error during generate-plan process (ID: ${generationId}):`, error); // Use log.error
            const errorMessage = error.message || 'An unknown critical error occurred.';
            // Check if it was a cancellation error
            if (error instanceof CancellationError) {
                 progressCallback({ stage: 'Cancelled', message: errorMessage });
                 // Return specific cancellation status
                 return { cancelled: true, error: errorMessage };
            } else {
                // Handle other errors
                progressCallback({ stage: 'Critical Error', message: `Generation failed: ${errorMessage}` });
                // Return a structured error object
                return {
                     success: false, // Indicate failure
                     error: errorMessage,
                     stage: error.stage || 'Unknown' // Optionally add stage info if engine throws custom errors
                    };
            }
        } finally {
             // Always remove the token when the operation finishes or errors out
             activeGenerationTokens.delete(generationId);
             log.info(`Cleaned up token for generation ID: ${generationId}`); // Use log.info
        }
    });

    // Handler for cancelling plan generation
    ipcMain.handle('cancel-generation', async (event, generationId) => { // Use handle for potential async operations or return value
        log.info(`IPC: Received cancel-generation request for ID: ${generationId}`); // Use log.info
        const token = activeGenerationTokens.get(generationId);
        if (token) {
            token.isCancellationRequested = true;
            log.info(`Cancellation requested for generation ID: ${generationId}`); // Use log.info
            return { success: true, message: `Cancellation requested for ${generationId}.` };
        } else {
            log.warn(`Could not find active generation token for ID: ${generationId} to cancel.`); // Use log.warn
            return { success: false, message: `No active generation found for ID ${generationId}.` };
        }
    });

    // Removed API Key Management IPC Handlers as they are no longer needed
    // after hardcoding the key and removing secure storage logic.

    log.info("IPC Handlers setup complete (excluding API key management)."); // Use log.info
}

module.exports = {
    setupIpcHandlers,
};
