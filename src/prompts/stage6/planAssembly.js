// src/prompts/stage6/planAssembly.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'planAssembly.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading plan assembly prompt template:", error);
    template = "Error: Could not load plan assembly template. Goal: {{conciseCommand}}, Slugs: {{techSpecificSlugs}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 6: Assemble Final Roo Code Plan by reading a template file.
 * @param {string} conciseCommand - The concise command from stage 2.
 * @param {string} structureResultMd - The structured markdown from previous stages.
 * @param {string[]} techSpecificSlugs - Array of identified mode slugs for delegation.
 * @returns {string} The formatted plan assembly prompt.
 */
function getPlanAssemblyPrompt(conciseCommand, structureResultMd, techSpecificSlugs) {
  // Replace placeholders in the template
  let prompt = template.replace('{{conciseCommand}}', conciseCommand);
  const slugsString = techSpecificSlugs.length > 0 ? techSpecificSlugs.join(', ') : '(Fallback to "code" mode)';
  prompt = prompt.replace('{{techSpecificSlugs}}', slugsString);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getPlanAssemblyPrompt };
