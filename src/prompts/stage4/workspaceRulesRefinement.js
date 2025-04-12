// src/prompts/stage4/workspaceRulesRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'workspaceRulesRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading workspace rules refinement prompt template:", error);
    template = "Error: Could not load workspace rules refinement template. Invalid Output: {{workspaceRulesResult}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.6.1: Validate/Refine Workspace .clinerules by reading a template file.
 * @param {string} workspaceRulesResult - The raw output from the workspace rules generation stage.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted workspace rules refinement prompt.
 */
function getWorkspaceRulesRefinementPrompt(workspaceRulesResult, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace('{{workspaceRulesResult}}', workspaceRulesResult);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getWorkspaceRulesRefinementPrompt };
