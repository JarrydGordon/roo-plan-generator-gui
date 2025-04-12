// src/prompts/stage4/workspaceRulesGeneration.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'workspaceRulesGeneration.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading workspace rules generation prompt template:", error);
    template = "Error: Could not load workspace rules generation template. Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.6: Generate Workspace .clinerules by reading a template file.
 * @param {string} structureResultMd - The structured markdown from previous stages.
 * @returns {string} The formatted workspace rules generation prompt.
 */
function getWorkspaceRulesGenerationPrompt(structureResultMd) {
  // Replace placeholder in the template
  return template.replace('{{structureResultMd}}', structureResultMd);
}

module.exports = { getWorkspaceRulesGenerationPrompt };
