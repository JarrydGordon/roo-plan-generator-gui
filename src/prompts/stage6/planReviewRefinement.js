// src/prompts/stage6/planReviewRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'planReviewRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading plan review refinement prompt template:", error);
    template = "Error: Could not load plan review refinement template. Plan: {{finalPlan}}, Modes: {{roomodesResult}}, Context: {{structureResultMd}}";
}

/**
 * Generates the prompt for Stage 6.5: Refine roo-plan.md (general review) by reading a template file.
 * @param {string} finalPlan - The plan content to review.
 * @param {string} roomodesResult - The generated .roomodes content for context.
 * @param {string} structureResultMd - The structured markdown for context.
 * @returns {string} The formatted plan review refinement prompt.
 */
function getPlanReviewRefinementPrompt(finalPlan, roomodesResult, structureResultMd) {
  // Replace placeholders in the template
  let prompt = template.replace('{{finalPlan}}', finalPlan);
  prompt = prompt.replace('{{roomodesResult}}', roomodesResult);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  return prompt;
}

module.exports = { getPlanReviewRefinementPrompt };
