// src/prompts/stage4/rooignoreGeneration.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'rooignoreGeneration.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading rooignore generation prompt template:", error);
    template = "Error: Could not load rooignore generation template. Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 4.5: Generate .rooignore by reading a template file.
 * @param {string} structureResultMd - The structured markdown from previous stages.
 * @returns {string} The formatted .rooignore generation prompt.
 */
function getRooignoreGenerationPrompt(structureResultMd) {
  // Replace placeholder in the template
  return template.replace('{{structureResultMd}}', structureResultMd);
}

module.exports = { getRooignoreGenerationPrompt };
