// src/prompts/stage4/rooignoreRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'rooignoreRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading rooignore refinement prompt template:", error);
    template = "Error: Could not load rooignore refinement template. Invalid Output: {{rooignoreResult}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.5.1: Validate/Refine .rooignore by reading a template file.
 * @param {string} rooignoreResult - The raw output from the .rooignore generation stage.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted .rooignore refinement prompt.
 */
function getRooignoreRefinementPrompt(rooignoreResult, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace('{{rooignoreResult}}', rooignoreResult);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getRooignoreRefinementPrompt };
