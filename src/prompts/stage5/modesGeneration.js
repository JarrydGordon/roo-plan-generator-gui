// src/prompts/stage5/modesGeneration.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'modesGeneration.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading modes generation prompt template:", error);
    template = "Error: Could not load modes generation template. Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 5: Dynamic Custom Mode Generation (.roomodes) by reading a template file.
 * @param {string} structureResultMd - The structured markdown from previous stages.
 * @returns {string} The formatted modes generation prompt.
 */
function getModesGenerationPrompt(structureResultMd) {
  // Replace placeholder in the template
  return template.replace('{{structureResultMd}}', structureResultMd);
}

module.exports = { getModesGenerationPrompt };
