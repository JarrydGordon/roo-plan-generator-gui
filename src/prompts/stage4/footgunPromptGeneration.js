// src/prompts/stage4/footgunPromptGeneration.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'footgunPromptGeneration.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading footgun prompt generation template:", error);
    template = "Error: Could not load footgun prompt generation template. Mode: {{footgunTargetMode}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.7: Optional Footgun Prompt Generation by reading a template file.
 * @param {string} footgunTargetMode - The specific mode to generate the prompt for.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted footgun prompt generation prompt.
 */
function getFootgunPromptGenerationPrompt(footgunTargetMode, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace(/{{footgunTargetMode}}/g, footgunTargetMode); // Use global replace
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getFootgunPromptGenerationPrompt };
