// src/prompts/stage4/footgunPromptRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'footgunPromptRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading footgun prompt refinement template:", error);
    template = "Error: Could not load footgun prompt refinement template. Mode: {{footgunTargetMode}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for refining an empty footgun system prompt by reading a template file.
 * @param {string} footgunTargetMode - The specific mode the prompt is for.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted footgun prompt refinement prompt.
 */
function getFootgunRefinementPrompt(footgunTargetMode, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace(/{{footgunTargetMode}}/g, footgunTargetMode); // Use global replace
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getFootgunRefinementPrompt };
