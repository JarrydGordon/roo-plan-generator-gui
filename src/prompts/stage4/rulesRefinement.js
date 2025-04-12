// src/prompts/stage4/rulesRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'rulesRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading rules refinement prompt template:", error);
    template = "Error: Could not load rules refinement template. Invalid Output: {{rawRulesResult}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.1: Validate/Refine .clinerules-code by reading a template file.
 * @param {string} rawRulesResult - The raw output from the rules generation stage.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted rules refinement prompt.
 */
function getRulesRefinementPrompt(rawRulesResult, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace('{{rawRulesResult}}', rawRulesResult);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getRulesRefinementPrompt };
