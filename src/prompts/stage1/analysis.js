// src/prompts/stage1/analysis.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously (or use async/await if preferred in main logic)
let analysisPromptTemplate = '';
try {
    const templatePath = path.join(__dirname, 'analysis.txt');
    analysisPromptTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading analysis prompt template:", error);
    // Fallback or throw error
    analysisPromptTemplate = "Error: Could not load analysis prompt template. Project Idea: {{projectIdea}}";
}


/**
 * Generates the prompt for Stage 1: Analysis by reading a template file.
 * @param {string} projectIdea - The user's project description.
 * @returns {string} The formatted analysis prompt.
 */
function getAnalysisPrompt(projectIdea) {
  // Replace placeholder in the template
  return analysisPromptTemplate.replace('{{projectIdea}}', projectIdea);
}

module.exports = { getAnalysisPrompt };
