// src/prompts/stage4/rulesGeneration.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'rulesGeneration.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading rules generation prompt template:", error);
    template = "Error: Could not load rules generation template. Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4: Rules Generation (.clinerules-code) by reading a template file.
 * @param {string} structureResultMd - The structured markdown from previous stages.
 * @returns {string} The formatted rules generation prompt.
 */
function getRulesGenerationPrompt(structureResultMd) {
  // Replace placeholder in the template
  return template.replace('{{structureResultMd}}', structureResultMd);
}

module.exports = { getRulesGenerationPrompt };
