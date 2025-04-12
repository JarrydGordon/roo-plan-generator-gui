// src/engine.js - Core multi-stage reasoning engine for plan generation (Refactored)

const { callLLM } = require('./llm'); // Import the LLM call function
const { getAnalysisPrompt } = require('./prompts/stage1/analysis');
const { getAnalysisValidationPrompt } = require('./prompts/stage1/analysisValidation');
const { getStructurePrompt } = require('./prompts/stage2/structure');
const { getStructureValidationPrompt } = require('./prompts/stage2/structureValidation');
const { getOutlineRefinementPrompt } = require('./prompts/stage3/outlineRefinement');
const { getRulesGenerationPrompt } = require('./prompts/stage4/rulesGeneration');
const { getRulesRefinementPrompt } = require('./prompts/stage4/rulesRefinement');
const { getRooignoreGenerationPrompt } = require('./prompts/stage4/rooignoreGeneration');
const { getRooignoreRefinementPrompt } = require('./prompts/stage4/rooignoreRefinement');
const { getWorkspaceRulesGenerationPrompt } = require('./prompts/stage4/workspaceRulesGeneration');
const { getWorkspaceRulesRefinementPrompt } = require('./prompts/stage4/workspaceRulesRefinement');
const { getFootgunPromptGenerationPrompt } = require('./prompts/stage4/footgunPromptGeneration');
const { getFootgunRefinementPrompt } = require('./prompts/stage4/footgunPromptRefinement');
const { getModesGenerationPrompt } = require('./prompts/stage5/modesGeneration');
const { getPlanAssemblyPrompt } = require('./prompts/stage6/planAssembly');
const { getPlanRefinementPrompt } = require('./prompts/stage6/planRefinement'); // For validation failure
const { getPlanReviewRefinementPrompt } = require('./prompts/stage6/planReviewRefinement'); // For general review
const { parseStructureFromJsonMd, parseOutlinesFromMd } = require('./utils'); // Import parsing functions
const log = require('electron-log'); // Use electron-log

// Define CancellationError if not already defined globally or imported
class CancellationError extends Error {
  constructor(message = "Operation cancelled by user.") {
    super(message);
    this.name = "CancellationError";
  }
}

/**
 * Helper function to report progress via callback and logger.
 * @param {Function|null} callback - The callback function to send progress updates to.
 * @param {string} stage - The current stage name.
 * @param {string} message - The progress message.
 */
function reportProgress(callback, stage, message) {
    log.info(`Progress - ${stage}: ${message}`); // Use log.info
    if (callback && typeof callback === 'function') {
        callback({ stage, message });
    }
}

// --- Stage 1: Analysis ---
/**
 * Runs the analysis stage of the plan generation.
 * @param {string} projectIdea - The user's project idea.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string>} The analysis result (potentially refined).
 * @throws {Error|CancellationError} If the LLM call fails critically or is cancelled.
 */
async function runAnalysisStage(projectIdea, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Analysis', 'Analyzing project idea...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const analysisPrompt = getAnalysisPrompt(projectIdea);
    let analysisResult;
    try {
        analysisResult = await callLLM(analysisPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 1 LLM call: ${error.message}`);
        throw new Error(`Analysis stage failed: ${error.message}`); // Re-throw for handler
    }

    // --- Stage 1.5: Analysis Validation/Refinement ---
    reportProgress(progressCallback, 'Analysis Validation', 'Validating analysis...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const analysisValidationPrompt = getAnalysisValidationPrompt(analysisResult);
    let validationResponse;
    try {
        reportProgress(progressCallback, 'Analysis Validation', 'Calling LLM for validation...');
        validationResponse = await callLLM(analysisValidationPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 1.5 LLM call: ${error.message}`);
        // Non-critical validation failure, proceed with unvalidated analysis but log warning
        log.warn("Analysis validation failed. Proceeding with potentially unrefined analysis.");
        return analysisResult; // Return the original result
    }

    if (validationResponse.trim().toUpperCase() !== "OK") {
        log.info("Analysis refined by validation step.");
        analysisResult = validationResponse; // Use the refined analysis
    } else {
        log.info("Analysis passed validation.");
    }
    return analysisResult;
}

// --- Stage 2: Structuring ---
/**
 * Runs the structuring stage, generating Markdown structure and a concise command.
 * @param {string} projectIdea - The user's project idea.
 * @param {string} analysisResult - The result from the analysis stage.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{structureResultMd: string, conciseCommand: string}>} Object containing the structured Markdown and concise command.
 * @throws {Error|CancellationError} If the LLM call fails critically or is cancelled.
 */
async function runStructuringStage(projectIdea, analysisResult, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Structuring', 'Generating structure and concise command...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const structurePrompt = getStructurePrompt(projectIdea, analysisResult);
    let structureResultRaw;
    try {
        structureResultRaw = await callLLM(structurePrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 2 LLM call: ${error.message}`);
        throw new Error(`Structuring stage failed: ${error.message}`);
    }

    // --- Stage 2.5: Structure Validation/Refinement ---
    reportProgress(progressCallback, 'Structure Validation', 'Validating structured output...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const structureValidationPrompt = getStructureValidationPrompt(structureResultRaw);
    let structureValidationResponse;
    try {
        reportProgress(progressCallback, 'Structure Validation', 'Calling LLM for validation...');
        structureValidationResponse = await callLLM(structureValidationPrompt, undefined, cancellationToken);
    } catch (error) {
        log.error(`Error during Stage 2.5 LLM call: ${error.message}`);
        log.warn("Structure validation failed. Proceeding with potentially invalid structure.");
        // Proceed with the potentially unrefined structureResultRaw
    }

    if (structureValidationResponse && structureValidationResponse.trim().toUpperCase() !== "OK") {
        log.info("Structured output refined by validation step.");
        structureResultRaw = structureValidationResponse; // Use the refined structure
    } else {
        log.info("Structured output passed validation.");
    }

    // Extract the main structured part and the concise command
    const structureParts = structureResultRaw.split("--- CONCISE ONE-SHOT COMMAND BELOW ---");
    let structureResultMd = structureParts[0]?.trim();
    let conciseCommand = structureParts[1]?.trim();

    if (!structureResultMd || !conciseCommand) {
        log.error("Failed to split structured result and concise command after validation. Using fallbacks.");
        structureResultMd = structureResultMd || "# Error: Could not parse structured result after validation.";
        conciseCommand = conciseCommand || "Build the project as described (parsing error).";
        // Consider throwing a more specific error if this split is absolutely critical
        // throw new Error("Critical failure: Could not extract structured Markdown and concise command.");
    }

    return { structureResultMd, conciseCommand };
}

// --- Stage 3: Outline Refinement ---
/**
 * Runs the outline refinement stage, improving the core logic outlines within the structured Markdown.
 * @param {string} analysisResult - The result from the analysis stage.
 * @param {string} structureResultMd - The structured Markdown from the previous stage.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string>} The structured Markdown with refined outlines.
 * @throws {Error|CancellationError} If the LLM call fails critically or is cancelled.
 */
async function runOutlineRefinementStage(analysisResult, structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Outlines', 'Refining core logic outlines...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    let preliminaryOutlines = "";
    const prelimOutlineParser = /### Core Logic Outlines\s*([\s\S]*?)(?:##|$)/;
    const prelimOutlineMatch = structureResultMd.match(prelimOutlineParser);
    if (prelimOutlineMatch && prelimOutlineMatch[1]) {
        preliminaryOutlines = prelimOutlineMatch[1].trim();
    }

    const outlineRefinementPrompt = getOutlineRefinementPrompt(analysisResult, structureResultMd, preliminaryOutlines);

    let refinedOutlinesContent;
    try {
        reportProgress(progressCallback, 'Outlines', 'Calling LLM for refinement...');
        if (cancellationToken.isCancellationRequested) throw new CancellationError();
        refinedOutlinesContent = await callLLM(outlineRefinementPrompt, undefined, cancellationToken);
    } catch (error) {
        log.error(`Error during Stage 3 LLM call: ${error.message}`);
        // If refinement fails, we might want to proceed with the original outlines or throw
        // For now, let's proceed with original structureResultMd but log the error
        log.warn("Outline refinement failed. Proceeding without refined outlines.");
        return structureResultMd; // Return the unrefined structure
    }


    // Replace the old outlines section in structureResultMd with the refined one
    let updatedStructureResultMd = structureResultMd;
    if (prelimOutlineMatch) {
        log.info("Replacing original outlines section with refined version (including heading).");
        updatedStructureResultMd = structureResultMd.replace(prelimOutlineMatch[0], '\n' + refinedOutlinesContent.trim() + '\n');
    } else {
        log.info("Adding refined outlines section (including heading).");
        const structureJsonEndRegex = /```\s*$/m;
        const matchJsonEnd = structureResultMd.match(structureJsonEndRegex);
        if (matchJsonEnd && matchJsonEnd.index !== undefined) {
            const insertIndex = matchJsonEnd.index + matchJsonEnd[0].length;
            updatedStructureResultMd = structureResultMd.slice(0, insertIndex) + '\n\n' + refinedOutlinesContent.trim() + structureResultMd.slice(insertIndex);
        } else {
            updatedStructureResultMd += '\n\n' + refinedOutlinesContent.trim();
        }
    }
    return updatedStructureResultMd; // Return the structure MD with refined outlines
}

// --- Stage 4: Rules Generation (.clinerules-code) ---
/**
 * Runs the generation and validation stage for .clinerules-code.
 * @param {string} structureResultMd - The structured Markdown containing project details.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string|null>} The generated rules content, or null if generation/validation fails.
 * @throws {CancellationError} If cancelled.
 */
async function runRulesGenerationStage(structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Rules', 'Generating .clinerules-code...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const rulesPrompt = getRulesGenerationPrompt(structureResultMd);
    let rawRulesResult;
    try {
        rawRulesResult = await callLLM(rulesPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 4 LLM call: ${error.message}`);
        log.warn("Failed to generate .clinerules-code. Skipping artifact.");
        return null; // Indicate failure for this artifact
    }
    let rulesResult = rawRulesResult?.trim();

    // --- Stage 4.1: Validate/Refine .clinerules-code ---
    reportProgress(progressCallback, 'Rules Validation', 'Validating .clinerules-code...');
    // No LLM call here, just validation logic
    if (rulesResult?.startsWith('```') && rulesResult.endsWith('```')) {
        rulesResult = rulesResult.substring(rulesResult.indexOf('\n') + 1, rulesResult.lastIndexOf('```')).trim();
    }
    rulesResult = rulesResult?.replace(/^(here is|here's) the content:?\s*/i, '');

    const rulesHeaderRegex = /^\/\/ \.clinerules-code for .*/;
    const rulesTechStackRegex = /^\/\/ Primary Tech Stack:/m;
    let isValidRules = rulesResult && rulesHeaderRegex.test(rulesResult) && rulesTechStackRegex.test(rulesResult);

    if (!isValidRules) {
        reportProgress(progressCallback, 'Rules Validation', '.clinerules-code failed initial validation. Attempting refinement...');
        if (cancellationToken.isCancellationRequested) throw new CancellationError();
        const rulesRefinementPrompt = getRulesRefinementPrompt(rawRulesResult, structureResultMd);
        let refinedRawResult;
        try {
            reportProgress(progressCallback, 'Rules Validation', 'Calling LLM for refinement...');
            refinedRawResult = await callLLM(rulesRefinementPrompt, undefined, cancellationToken);
        } catch (error) {
            log.error(`Error during Stage 4.1 LLM call: ${error.message}`);
            log.warn("Failed to refine .clinerules-code. Skipping artifact.");
            return null; // Indicate failure
        }
        rulesResult = refinedRawResult?.trim();
        if (rulesResult?.startsWith('```') && rulesResult.endsWith('```')) {
            rulesResult = rulesResult.substring(rulesResult.indexOf('\n') + 1, rulesResult.lastIndexOf('```')).trim();
        }
        rulesResult = rulesResult?.replace(/^(here is|here's) the content:?\s*/i, '');

        isValidRules = rulesResult && rulesHeaderRegex.test(rulesResult) && rulesTechStackRegex.test(rulesResult);
        if (!isValidRules) {
            log.error("Failed to generate valid .clinerules-code after refinement. Skipping.");
            return null; // Return null if invalid
        } else {
            log.info(".clinerules-code refined successfully.");
        }
    } else {
        log.info(".clinerules-code passed validation.");
    }
    return rulesResult;
}

// --- Stage 4.5: Generate .rooignore ---
/**
 * Runs the generation and validation stage for .rooignore.
 * @param {string} structureResultMd - The structured Markdown containing project details.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string|null>} The generated .rooignore content, or null if generation/validation fails.
 * @throws {CancellationError} If cancelled.
 */
async function runRooignoreGenerationStage(structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Ignore Rules', 'Generating .rooignore...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const rooignorePrompt = getRooignoreGenerationPrompt(structureResultMd);
    let rooignoreResult;
    try {
        rooignoreResult = await callLLM(rooignorePrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 4.5 LLM call: ${error.message}`);
        log.warn("Failed to generate .rooignore. Skipping artifact.");
        return null; // Indicate failure
    }


    // --- Stage 4.5.1: Validate/Refine .rooignore ---
    reportProgress(progressCallback, 'Ignore Rules Validation', 'Validating .rooignore...');
    // No LLM call here
    const rooignoreHeaderRegex = /^# \.rooignore for .*/;
    if (!rooignoreResult || !rooignoreHeaderRegex.test(rooignoreResult)) {
        reportProgress(progressCallback, 'Ignore Rules Validation', '.rooignore failed initial validation. Attempting refinement...');
        if (cancellationToken.isCancellationRequested) throw new CancellationError();
        const rooignoreRefinementPrompt = getRooignoreRefinementPrompt(rooignoreResult, structureResultMd);
        try {
            reportProgress(progressCallback, 'Ignore Rules Validation', 'Calling LLM for refinement...');
            rooignoreResult = await callLLM(rooignoreRefinementPrompt, undefined, cancellationToken);
        } catch (error) {
            log.error(`Error during Stage 4.5.1 LLM call: ${error.message}`);
            log.warn("Failed to refine .rooignore. Skipping artifact.");
            return null; // Indicate failure
        }
        if (!rooignoreResult || !rooignoreHeaderRegex.test(rooignoreResult)) {
            log.error("Failed to generate valid .rooignore after refinement. Skipping.");
            return null;
        } else {
            log.info(".rooignore refined successfully.");
        }
    } else {
        log.info(".rooignore passed validation.");
    }
    return rooignoreResult;
}

// --- Stage 4.6: Generate Workspace .clinerules ---
/**
 * Runs the generation and validation stage for the workspace .clinerules file.
 * @param {string} structureResultMd - The structured Markdown containing project details.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string|null>} The generated workspace rules content, or null if generation/validation fails.
 * @throws {CancellationError} If cancelled.
 */
async function runWorkspaceRulesGenerationStage(structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Workspace Rules', 'Generating workspace .clinerules...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const workspaceRulesPrompt = getWorkspaceRulesGenerationPrompt(structureResultMd);
    let workspaceRulesResult;
    try {
        workspaceRulesResult = await callLLM(workspaceRulesPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 4.6 LLM call: ${error.message}`);
        log.warn("Failed to generate workspace .clinerules. Skipping artifact.");
        return null; // Indicate failure
    }


    // --- Stage 4.6.1: Validate/Refine Workspace .clinerules ---
    reportProgress(progressCallback, 'Workspace Rules Validation', 'Validating workspace .clinerules...');
    // No LLM call here
    const workspaceRulesHeaderRegex = /^\/\/ General Workspace \.clinerules for .*/;
    if (!workspaceRulesResult || !workspaceRulesHeaderRegex.test(workspaceRulesResult)) {
        reportProgress(progressCallback, 'Workspace Rules Validation', 'Workspace .clinerules failed initial validation. Attempting refinement...');
        if (cancellationToken.isCancellationRequested) throw new CancellationError();
        const workspaceRulesRefinementPrompt = getWorkspaceRulesRefinementPrompt(workspaceRulesResult, structureResultMd);
        try {
            reportProgress(progressCallback, 'Workspace Rules Validation', 'Calling LLM for refinement...');
            workspaceRulesResult = await callLLM(workspaceRulesRefinementPrompt, undefined, cancellationToken);
        } catch (error) {
            log.error(`Error during Stage 4.6.1 LLM call: ${error.message}`);
            log.warn("Failed to refine workspace .clinerules. Skipping artifact.");
            return null; // Indicate failure
        }
        if (!workspaceRulesResult || !workspaceRulesHeaderRegex.test(workspaceRulesResult)) {
            log.error("Failed to generate valid workspace .clinerules after refinement. Skipping.");
            return null;
        } else {
            log.info("Workspace .clinerules refined successfully.");
        }
    } else {
        log.info("Workspace .clinerules passed validation.");
    }
    return workspaceRulesResult;
}

// --- Stage 4.7: Optional Footgun Prompt Generation ---
/**
 * Checks if a footgun prompt override is needed and generates/refines it if required.
 * @param {string} analysisResult - The result from the analysis stage.
 * @param {string} structureResultMd - The structured Markdown containing project details.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{footgunPromptResult: string|null, footgunTargetMode: string|null}>} Object containing the generated prompt and target mode slug, or nulls if not needed/failed.
 * @throws {CancellationError} If cancelled.
 */
async function runFootgunPromptGenerationStage(analysisResult, structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Footgun Prompt', 'Checking for footgun prompt requirement...');
    let footgunPromptResult = null;
    let footgunTargetMode = null;
    const footgunRegex = /override system prompt for mode\s+([a-z0-9-]+)/i;
    const footgunMatch = (analysisResult + "\n" + structureResultMd).match(footgunRegex);

    if (footgunMatch && footgunMatch[1]) {
        footgunTargetMode = footgunMatch[1].trim().toLowerCase();
        reportProgress(progressCallback, 'Footgun Prompt', `Triggered Footgun Prompt generation for mode: ${footgunTargetMode}`);
        if (cancellationToken.isCancellationRequested) throw new CancellationError();
        const footgunPrompt = getFootgunPromptGenerationPrompt(footgunTargetMode, structureResultMd);
        try {
            reportProgress(progressCallback, 'Footgun Prompt', `Calling LLM to generate prompt for ${footgunTargetMode}...`);
            footgunPromptResult = await callLLM(footgunPrompt, undefined, cancellationToken);
            reportProgress(progressCallback, 'Footgun Prompt', `Generated Footgun Prompt content for ${footgunTargetMode}. Length: ${footgunPromptResult?.length}`);
        } catch (error) {
             log.error(`Error during Stage 4.7 initial LLM call: ${error.message}`);
             log.warn(`Failed to generate footgun prompt for ${footgunTargetMode}. Skipping.`);
             return { footgunPromptResult: null, footgunTargetMode: null }; // Indicate failure
        }


        if (!footgunPromptResult || footgunPromptResult.trim().length === 0) {
            reportProgress(progressCallback, 'Footgun Prompt', `Generated footgun prompt for ${footgunTargetMode} is empty. Attempting refinement...`);
            if (cancellationToken.isCancellationRequested) throw new CancellationError();
            const footgunRefinementPrompt = getFootgunRefinementPrompt(footgunTargetMode, structureResultMd);
                 try { // TRY for refinement call
                     reportProgress(progressCallback, 'Footgun Prompt', `Calling LLM to refine prompt for ${footgunTargetMode}...`);
                     footgunPromptResult = await callLLM(footgunRefinementPrompt, undefined, cancellationToken);
                 } catch (error) { // CATCH for refinement call
                log.error(`Error during Stage 4.7 refinement LLM call: ${error.message}`);
                log.warn(`Failed to refine footgun prompt for ${footgunTargetMode}. Skipping.`);
                return { footgunPromptResult: null, footgunTargetMode: null }; // Indicate failure
            } // END CATCH for refinement call

            if (!footgunPromptResult || footgunPromptResult.trim().length === 0) { // Innermost IF Start
                log.error(`Failed to generate non-empty footgun prompt for ${footgunTargetMode} after refinement. Skipping.`);
                // Return nulls if still empty after refinement
                return { footgunPromptResult: null, footgunTargetMode: null };
            } else { // Innermost ELSE Start
                log.info(`Footgun prompt for ${footgunTargetMode} refined successfully.`);
            } // Innermost ELSE End / Innermost IF End
        } else { // Inner ELSE Start (Initial prompt was non-empty)
            log.info(`Footgun prompt for ${footgunTargetMode} passed initial validation (non-empty).`);
        } // Inner ELSE End / Inner IF End
    } else { // Outer ELSE Start (No footgunMatch)
        log.info("Stage 4.7: No Footgun Prompt requirement detected.");
    } // Outer ELSE End / Outer IF End

    // Return the result (could be nulls if generation/refinement failed)
    return { footgunPromptResult, footgunTargetMode };
}


// --- Stage 5: Dynamic Custom Mode Generation (.roomodes) ---
/**
 * Runs the generation and validation stage for .roomodes file content.
 * Includes fallback generation if LLM fails.
 * @param {string} structureResultMd - The structured Markdown containing project details.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{roomodesResult: string, techSpecificSlugs: string[], parsedModesSuccessfully: boolean}>} Object containing the generated JSON string, extracted tech slugs, and parsing success status.
 * @throws {CancellationError} If cancelled.
 */
async function runModesGenerationStage(structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Modes', 'Generating custom modes (.roomodes)...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const roomodesPrompt = getModesGenerationPrompt(structureResultMd);
    let rawRoomodesResult;
    try {
        rawRoomodesResult = await callLLM(roomodesPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 5 LLM call: ${error.message}`);
        log.warn("Failed to generate .roomodes. Using fallback.");
        // Force fallback generation by setting raw result to something invalid
        rawRoomodesResult = "{}";
    }
    let roomodesResult = rawRoomodesResult.trim();
    let techSpecificSlugs = [];
    let parsedModesSuccessfully = false;

    // Clean potential Markdown fences
    if (roomodesResult.startsWith('```json') && roomodesResult.endsWith('```')) {
        roomodesResult = roomodesResult.substring(7, roomodesResult.length - 3).trim();
    } else if (roomodesResult.startsWith('```') && roomodesResult.endsWith('```')) {
        roomodesResult = roomodesResult.substring(3, roomodesResult.length - 3).trim();
    }

    try {
        const parsedModes = JSON.parse(roomodesResult);
        // --- MODIFIED CONDITION ---
        // Check if customModes exists, is an array, and is not empty. No longer requires 'project-orchestrator'.
        if (parsedModes && Array.isArray(parsedModes.customModes) && parsedModes.customModes.length > 0) {
            // Basic check: Ensure customModes is an array and has at least one mode
             if (!Array.isArray(parsedModes.customModes) || parsedModes.customModes.length === 0) {
                log.warn("LLM returned JSON for .roomodes, but the 'customModes' array is missing or empty.");
                throw new Error("Invalid .roomodes structure: 'customModes' array missing or empty.");
            }
            // Extract slugs correctly after successful parsing
            techSpecificSlugs = parsedModes.customModes.map(mode => mode.slug).filter(Boolean); // Get all defined slugs
            log.info(`Successfully parsed .roomodes JSON from LLM. Slugs: ${techSpecificSlugs.join(', ')}`);
            // --- END ORIGINAL SUCCESS LOGIC MOVED ---

            // Original logic for handling slugs (moved inside the successful parse block)
            techSpecificSlugs = parsedModes.customModes
                .map(mode => mode.slug)
                // Filter out project-orchestrator if it exists, keep others
                .filter(slug => slug && slug !== 'project-orchestrator'); // Keep this filter if orchestrator shouldn't be a delegate

            // Ensure 'code' is added if no other delegates exist
            if (techSpecificSlugs.length === 0) {
                 log.warn("LLM generated modes but no specific delegate slugs found (excluding orchestrator/manager). Adding 'code' as fallback delegate for plan.");
                 // Check if 'code' mode actually exists in the parsed modes before adding it blindly
                 if (parsedModes.customModes.some(m => m.slug === 'code')) {
                    techSpecificSlugs.push('code');
                 } else {
                    // If 'code' doesn't exist either, this indicates a potential issue with mode generation logic
                    log.warn("Neither specific delegates nor a 'code' mode found. Plan generation might rely on incorrect fallback.");
                    // Decide if we should still add 'code' as a placeholder or handle differently
                    techSpecificSlugs.push('code'); // Add 'code' as a last resort for plan generation
                 }
            }
            parsedModesSuccessfully = true;

        } else {
             // This case means JSON was parsed, but customModes was missing, empty, or not an array.
            log.warn(`Invalid .roomodes structure after JSON parsing. 'customModes' is missing, not an array, or empty. Parsed data: ${JSON.stringify(parsedModes)}`);
            throw new Error("Invalid .roomodes structure: 'customModes' array missing, empty, or invalid.");
        }
    } catch (parseError) {
        // This catch block now specifically handles JSON.parse errors
        log.error("Failed to parse JSON for .roomodes from LLM:", parseError.message);
        // Log the raw response snippet
        const rawResponseSnippet = rawRoomodesResult.substring(0, 500) + (rawRoomodesResult.length > 500 ? '...' : '');
        log.warn(`Raw LLM response (snippet): ${rawResponseSnippet}`);
        log.warn("Generating fallback .roomodes structure.");
        // Attempt a slightly more intelligent fallback
        // If structureResultMd suggests a very simple project (e.g., few files, simple goal), maybe just a 'developer' mode. Otherwise, default to manager + code.
        // This is a basic heuristic. A more robust approach might involve another LLM call with a simpler prompt.
        let fallbackModes;
        const simpleProjectHeuristic = structureResultMd.split('\n').length < 20; // Very basic check

        if (simpleProjectHeuristic) {
            log.info("Fallback: Simple project detected, creating single 'developer' mode.");
            fallbackModes = {
                customModes: [
                    {
                        slug: "developer",
                        name: "Developer",
                        roleDefinition: "Implement the project based on the analysis.",
                        groups: ["read", "edit", "command", "attempt_completion"],
                        customInstructions: "Implement features based on the project plan and requirements. Follow any available coding standards. (Fallback due to modes generation error)"
                    }
                ]
            };
            techSpecificSlugs = ['developer'];
        } else {
             log.info("Fallback: Creating 'project-manager' and 'code' modes.");
             fallbackModes = {
                customModes: [
                    {
                        slug: "project-manager",
                        name: "Project Manager",
                        roleDefinition: `Manage the build based on the analysis, delegate tasks.`,
                        groups: ["read", "new_task", "switch_mode"],
                        customInstructions: "Delegate tasks via <new_task> to the 'code' mode. Monitor progress. Use information from the analysis and structure documents. (Fallback due to modes generation error)"
                    },
                    {
                        slug: "code",
                        name: "General Developer",
                        roleDefinition: "Implement delegated tasks.",
                        groups: ["read", "edit", "command", "attempt_completion"],
                        customInstructions: "Implement features based on delegated tasks. Follow any available coding standards. (Fallback due to modes generation error)"
                    }
                ]
            };
             techSpecificSlugs = ['code']; // Only delegate slug needed for plan
        }

        roomodesResult = JSON.stringify(fallbackModes, null, 2);
        parsedModesSuccessfully = false; // Mark as fallback
    }
    return { roomodesResult, techSpecificSlugs, parsedModesSuccessfully };
} // Closing brace for runModesGenerationStage

// --- Stage 6: Assemble Final Roo Code Plan ---
/**
 * Runs the assembly and validation stage for the final roo-plan.md.
 * Includes fallback generation if LLM fails or validation fails.
 * @param {string} conciseCommand - The concise one-shot command generated in Stage 2.
 * @param {string} structureResultMd - The structured Markdown.
 * @param {string[]} techSpecificSlugs - Slugs for tech-specific modes generated in Stage 5.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{finalPlan: string, planIsValid: boolean}>} Object containing the final plan content and its validation status.
 * @throws {CancellationError} If cancelled.
 */
async function runPlanAssemblyStage(conciseCommand, structureResultMd, techSpecificSlugs, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Plan Assembly', 'Assembling execution plan (roo-plan.md)...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const planPrompt = getPlanAssemblyPrompt(conciseCommand, structureResultMd, techSpecificSlugs);
    let finalPlan;
    try {
        finalPlan = await callLLM(planPrompt, undefined, cancellationToken); // Pass token
    } catch (error) {
        log.error(`Error during Stage 6 LLM call: ${error.message}`);
        log.warn("Failed to generate initial roo-plan.md. Using fallback.");
        finalPlan = null; // Will trigger fallback generation below
    }


    // --- Stage 6.1: Validate roo-plan.md ---
    reportProgress(progressCallback, 'Plan Validation', 'Validating roo-plan.md...');
    // No LLM call here
    let planIsValid = false;
    let planValidationIssues = [];
    if (finalPlan && typeof finalPlan === 'string') {
        // --- Updated Validation Logic for Flexible Structure ---
        if (!finalPlan.includes('# Roo Code Execution Plan:')) planValidationIssues.push("Missing Title");
        if (!finalPlan.includes('**Concise Goal:**')) planValidationIssues.push("Missing Concise Goal");
        // Check for *any* initial switch_mode, not just orchestrator
        if (!finalPlan.match(/1\.\s+\*\*.*?Switch.*?\*\*:\s*<switch_mode><mode_slug>[a-z0-9-]+<\/mode_slug><\/switch_mode>/)) {
             planValidationIssues.push("Missing or invalid initial <switch_mode> step (Step 1)");
        }
        // Check for at least one phase header (##)
        if (!finalPlan.includes('## ')) planValidationIssues.push("Missing phase headers (e.g., ## Phase 1: ...)");
        // Check for at least one new_task delegation
        if (!finalPlan.includes('<new_task>')) planValidationIssues.push("Missing at least one <new_task> delegation");

        // Validate JSON within <message> tags (remains the same)
        const messageJsonRegex = /<message>([\s\S]*?)<\/message>/g;
        let match;
        while ((match = messageJsonRegex.exec(finalPlan)) !== null) {
            try {
                JSON.parse(match[1]);
            } catch (e) {
                planValidationIssues.push(`Invalid JSON in <message>: ${e.message}`);
                break;
            }
        }

        if (planValidationIssues.length === 0) {
            log.info("LLM generated roo-plan.md passed validation.");
            planIsValid = true;
        } else {
            reportProgress(progressCallback, 'Plan Validation', `LLM generated roo-plan.md failed validation: ${planValidationIssues.join(', ')}. Attempting refinement...`);
            if (cancellationToken.isCancellationRequested) throw new CancellationError();
            const planRefinementPrompt = getPlanRefinementPrompt(planValidationIssues, finalPlan, structureResultMd, techSpecificSlugs);
            try {
                reportProgress(progressCallback, 'Plan Validation', 'Calling LLM for refinement...');
                finalPlan = await callLLM(planRefinementPrompt, undefined, cancellationToken);
                // Basic re-validation after refinement (could be more thorough)
                if (finalPlan && finalPlan.includes('# Roo Code Execution Plan:')) {
                     reportProgress(progressCallback, 'Plan Validation', 'Plan refined successfully.');
                     planIsValid = true; // Assume refinement worked if it produced a plan-like string
                } else {
                     reportProgress(progressCallback, 'Plan Validation', 'Plan refinement did not produce a valid plan.');
                     planIsValid = false;
                }
            } catch (error) {
                log.error(`Error during Stage 6.1 refinement LLM call: ${error.message}`);
                log.warn("Failed to refine roo-plan.md. Using potentially invalid plan.");
                // Keep planIsValid as false, fallback will be used later
                planIsValid = false;
                // Skip further validation if refinement failed
                finalPlan = finalPlan || ""; // Ensure finalPlan is a string for later checks
                // Jump out of the validation block
            } // <-- Closes inner catch
        } // <-- *** Added missing closing brace for the 'else' block ***
    } else { // <-- This else corresponds to the outer `if (finalPlan && typeof finalPlan === 'string')`
        log.warn("LLM did not return a valid string for roo-plan.md during initial generation.");
        planIsValid = false;
    }

    if (!planIsValid) {
        reportProgress(progressCallback, 'Plan Validation', 'Generating fallback roo-plan.md structure due to validation or refinement failure.');
        // Determine a sensible fallback primary mode slug
        const fallbackPrimarySlug = techSpecificSlugs.find(slug => slug.includes('manager') || slug.includes('orchestrator') || slug.includes('lead')) || 'developer'; // Default to 'developer' if no manager/orchestrator found
        const fallbackDelegateSlug = techSpecificSlugs.find(slug => !slug.includes('manager') && !slug.includes('orchestrator') && !slug.includes('lead')) || 'code'; // Find first non-manager/orchestrator, or default to 'code'

        const fallbackMessageContent = {
            goal: `Implement the core logic for: ${conciseCommand}`,
            contextSummary: `The detailed plan generation failed. Refer to the full project structure and analysis provided separately. Key goal: ${conciseCommand}`,
            detailedInstructions: `1. Review the full project analysis and structure markdown.\n2. Implement the core features required to meet the concise goal.\n3. Adhere strictly to any available .clinerules-code or general coding best practices.\n4. Use attempt_completion with a summary upon success.`,
            toolNotes: "No specific tool notes available due to fallback generation.",
            completionCriteria: "Core functionality implemented as per the concise goal and available analysis."
        };

        // Escape the structureResultMd for embedding in markdown (less critical now as contextSummary is brief)
        // const embeddedContext = structureResultMd.substring(0, 1000).replace(/`/g, '\\`') + (structureResultMd.length > 1000 ? "\n...(truncated)" : "");

        finalPlan = `
# Roo Code Execution Plan: Fallback Plan

**Concise Goal:** ${conciseCommand}

*(Ensure generated .roomodes and .clinerules files are saved in the project root before starting this plan. Plan generation encountered issues, using fallback.)*

## Phase 1: Initialization (Fallback)

1.  **Switch to Primary Mode:**
    <switch_mode><mode_slug>${fallbackPrimarySlug}</mode_slug></switch_mode>
    *(This mode will now delegate the main task based on the fallback plan below)*

## Phase 2: Core Implementation (Fallback)

2.  **Delegate General Implementation Task:**
    <new_task>
    <mode>${fallbackDelegateSlug}</mode> *(Fallback delegate mode)*
    <message>${JSON.stringify(fallbackMessageContent, null, 2)}</message>
    </new_task>
*(Primary mode should monitor completion)*
`;
        log.warn(`Generated fallback plan using primary slug: ${fallbackPrimarySlug} and delegate slug: ${fallbackDelegateSlug}`);
    }
    return { finalPlan, planIsValid };
} // Closing brace for runPlanAssemblyStage

// --- Stage 6.5: Refine roo-plan.md ---
/**
 * Runs an optional final refinement stage for the generated roo-plan.md.
 * @param {string} finalPlan - The plan generated in Stage 6.
 * @param {string} roomodesResult - The generated .roomodes JSON string.
 * @param {string} structureResultMd - The structured Markdown.
 * @param {Function} progressCallback - Callback function for progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<string>} The potentially refined plan content.
 * @throws {CancellationError} If cancelled.
 */
async function runPlanRefinementStage(finalPlan, roomodesResult, structureResultMd, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Plan Refinement', 'Performing final review/refinement of execution plan...');
    if (cancellationToken.isCancellationRequested) throw new CancellationError();
    const planRefinementPrompt = getPlanReviewRefinementPrompt(finalPlan, roomodesResult, structureResultMd);

    try {
        reportProgress(progressCallback, 'Plan Refinement', 'Calling LLM for final review...');
        const planRefinementResponse = await callLLM(planRefinementPrompt, undefined, cancellationToken);
        if (planRefinementResponse.trim().toUpperCase() !== "OK") {
            log.info("roo-plan.md refined by Stage 6.5.");
            return planRefinementResponse.trim(); // Return the refined plan
        } else {
            log.info("roo-plan.md passed Stage 6.5 refinement check (no changes needed).");
            return finalPlan; // Return original plan if OK
        }
    } catch (refinementError) {
        log.warn(`Error during Stage 6.5 plan refinement: ${refinementError.message}. Proceeding with potentially unrefined plan.`);
        return finalPlan; // Return original plan on error
    }
} // Closing brace for runPlanRefinementStage


// --- Main Engine Function ---
/**
 * Orchestrates the multi-stage plan generation process.
 * @param {string} projectIdea - The user's initial project idea.
 * @param {Function} progressCallback - Function to report progress updates.
 * @param {{isCancellationRequested: boolean}} cancellationToken - Token to check for cancellation requests.
 * @returns {Promise<{artifacts: Record<string, string>, structureList: Array<{type: string, path: string}>, outlines: Record<string, string>}>} An object containing generated artifacts, the parsed file structure, and parsed code outlines.
 * @throws {Error|CancellationError} If a critical stage of the engine fails or is cancelled.
 */
async function runAdvancedReasoningEngine(projectIdea, progressCallback, cancellationToken) {
    reportProgress(progressCallback, 'Starting', 'Initiating plan generation...');
    const generatedArtifacts = {};
    let proposedStructureList = [];
    let coreLogicOutlines = {};

    try {
        // Stage 1: Analysis
        const analysisResult = await runAnalysisStage(projectIdea, progressCallback, cancellationToken);
        if (cancellationToken.isCancellationRequested) throw new CancellationError();

        // Stage 2: Structuring
        let { structureResultMd, conciseCommand } = await runStructuringStage(projectIdea, analysisResult, progressCallback, cancellationToken);
        if (cancellationToken.isCancellationRequested) throw new CancellationError();

        // Stage 3: Outline Refinement
        structureResultMd = await runOutlineRefinementStage(analysisResult, structureResultMd, progressCallback, cancellationToken); // Update structureResultMd
        if (cancellationToken.isCancellationRequested) throw new CancellationError();

        // --- Run Stages 4.x and 5 in Parallel ---
        reportProgress(progressCallback, 'Parallel Generation', 'Starting parallel generation of rules, modes, etc...');

        const parallelStagePromises = [
            runRulesGenerationStage(structureResultMd, progressCallback, cancellationToken),         // Stage 4
            runRooignoreGenerationStage(structureResultMd, progressCallback, cancellationToken),      // Stage 4.5
            runWorkspaceRulesGenerationStage(structureResultMd, progressCallback, cancellationToken), // Stage 4.6
            runFootgunPromptGenerationStage(analysisResult, structureResultMd, progressCallback, cancellationToken), // Stage 4.7
            runModesGenerationStage(structureResultMd, progressCallback, cancellationToken)           // Stage 5
        ];

        // Wait for all parallel stages to complete
        const parallelResults = await Promise.all(parallelStagePromises);
        if (cancellationToken.isCancellationRequested) throw new CancellationError("Cancelled during parallel generation stages.");

        // --- Process Parallel Results ---
        reportProgress(progressCallback, 'Parallel Generation', 'Processing results from parallel stages...');

        const rulesResult = parallelResults[0];
        if (rulesResult) generatedArtifacts[".clinerules-code"] = rulesResult;

        const rooignoreResult = parallelResults[1];
        if (rooignoreResult) generatedArtifacts[".rooignore"] = rooignoreResult;

        const workspaceRulesResult = parallelResults[2];
        if (workspaceRulesResult) generatedArtifacts[".clinerules"] = workspaceRulesResult;

        const { footgunPromptResult, footgunTargetMode } = parallelResults[3];
        if (footgunPromptResult && footgunTargetMode) {
            const footgunFilename = `.roo/system-prompt-${footgunTargetMode}`;
            generatedArtifacts[footgunFilename] = footgunPromptResult;
            reportProgress(progressCallback, 'Footgun Prompt', `Adding Footgun Prompt to artifacts: ${footgunFilename}`);
        }

        const { roomodesResult, techSpecificSlugs, parsedModesSuccessfully } = parallelResults[4];
        if (roomodesResult) generatedArtifacts[".roomodes"] = roomodesResult;

        // --- Parse Final Structure & Outlines using utils (can run after parallel stages) ---
        reportProgress(progressCallback, 'Parsing', 'Parsing final structure and outlines...');
        proposedStructureList = parseStructureFromJsonMd(structureResultMd);
        coreLogicOutlines = parseOutlinesFromMd(structureResultMd);
        reportProgress(progressCallback, 'Parsing', `Parsed ${proposedStructureList.length} structure items and outlines for ${Object.keys(coreLogicOutlines).length} files.`);


        // Stage 6: Assemble Final Roo Code Plan
        let { finalPlan, planIsValid } = await runPlanAssemblyStage(conciseCommand, structureResultMd, techSpecificSlugs, progressCallback, cancellationToken);
        if (cancellationToken.isCancellationRequested) throw new CancellationError();

        // Stage 6.5: Refine roo-plan.md (only if initial plan was valid and modes were parsed)
        if (planIsValid && parsedModesSuccessfully && roomodesResult) {
            finalPlan = await runPlanRefinementStage(finalPlan, roomodesResult, structureResultMd, progressCallback, cancellationToken);
        } else if (!parsedModesSuccessfully) {
             reportProgress(progressCallback, 'Plan Refinement', "Skipping Stage 6.5 plan refinement because initial modes generation failed or resulted in fallback.");
        } else if (!planIsValid) {
             reportProgress(progressCallback, 'Plan Refinement', "Skipping Stage 6.5 plan refinement because initial plan generation failed or resulted in fallback.");
        }
        if (cancellationToken.isCancellationRequested) throw new CancellationError();

        if (finalPlan) generatedArtifacts["roo-plan.md"] = finalPlan;


        reportProgress(progressCallback, 'Complete', 'Plan generation complete. Ready for saving.');
        return { artifacts: generatedArtifacts, structureList: proposedStructureList, outlines: coreLogicOutlines };

    } catch (error) {
        if (error instanceof CancellationError) {
             log.warn("Advanced Reasoning Engine cancelled."); // Use log.warn for cancellations
             reportProgress(progressCallback, 'Cancelled', 'Operation cancelled by user.');
             // Re-throw cancellation error specifically if needed by caller
             throw error;
        } else {
            log.error("Error occurred within the Advanced Reasoning Engine:", error); // Use log.error
            reportProgress(progressCallback, 'Error', `Engine failed: ${error.message}`); // Report error via callback
            // Re-throw the error so the caller (ipcHandler) knows it failed
            throw new Error(`Advanced Reasoning Engine failed: ${error.message || 'An unknown internal error occurred.'}`);
        }
    }
}

module.exports = {
    runAdvancedReasoningEngine,
    // Export individual stages for use in ipcHandlers
    runAnalysisStage,
    runStructuringStage,
    runOutlineRefinementStage,
    runRulesGenerationStage,
    runRooignoreGenerationStage,
    runWorkspaceRulesGenerationStage,
    runFootgunPromptGenerationStage,
    runModesGenerationStage,
    runPlanAssemblyStage,
    runPlanRefinementStage, // Added missing comma
};
