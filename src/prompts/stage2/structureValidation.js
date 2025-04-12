// src/prompts/stage2/structureValidation.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let validationPromptTemplate = '';
try {
    const templatePath = path.join(__dirname, 'structureValidation.txt');
    validationPromptTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading structure validation prompt template:", error);
    validationPromptTemplate = "Error: Could not load structure validation template. Output: {{structureResultRaw}}";
}


/**
 * Generates the prompt for Stage 2.5: Structure Validation by reading a template file.
 * @param {string} structureResultRaw - The raw output from the structuring stage.
 * @returns {string} The formatted structure validation prompt.
 */
function getStructureValidationPrompt(structureResultRaw) {
  // Replace placeholder in the template
  return validationPromptTemplate.replace('{{structureResultRaw}}', structureResultRaw);
}

module.exports = { getStructureValidationPrompt };
