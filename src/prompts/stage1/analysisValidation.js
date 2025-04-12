// src/prompts/stage1/analysisValidation.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let validationPromptTemplate = '';
try {
    const templatePath = path.join(__dirname, 'analysisValidation.txt');
    validationPromptTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading analysis validation prompt template:", error);
    validationPromptTemplate = "Error: Could not load analysis validation template. Analysis: {{analysisResult}}";
}

/**
 * Generates the prompt for Stage 1.5: Analysis Validation by reading a template file.
 * @param {string} analysisResult - The result from the analysis stage.
 * @returns {string} The formatted analysis validation prompt.
 */
function getAnalysisValidationPrompt(analysisResult) {
  // Replace placeholder in the template
  return validationPromptTemplate.replace('{{analysisResult}}', analysisResult);
}

module.exports = { getAnalysisValidationPrompt };
