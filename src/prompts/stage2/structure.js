// src/prompts/stage2/structure.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let structurePromptTemplate = '';
try {
    const templatePath = path.join(__dirname, 'structure.txt');
    structurePromptTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading structure prompt template:", error);
    structurePromptTemplate = "Error: Could not load structure prompt template. Project Idea: {{projectIdea}}, Analysis: {{analysisResult}}";
}

/**
 * Generates the prompt for Stage 2: Structuring by reading a template file.
 * @param {string} projectIdea - The user's project description.
 * @param {string} analysisResult - The result from the analysis stage.
 * @returns {string} The formatted structure prompt.
 */
function getStructurePrompt(projectIdea, analysisResult) {
  // Replace placeholders in the template
  let prompt = structurePromptTemplate.replace('{{projectIdea}}', projectIdea);
  prompt = prompt.replace('{{analysisResult}}', analysisResult);
  return prompt;
}

module.exports = { getStructurePrompt };
