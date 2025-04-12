// src/prompts/stage6/planRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'planRefinement.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading plan refinement prompt template:", error);
    template = "Error: Could not load plan refinement template. Issues: {{planValidationIssues}}, Invalid Plan: {{finalPlan}}, Context: {{structureResultMd}}, Slugs: {{techSpecificSlugs}}";
}

/**
 * Generates the prompt for Stage 6.1: Refine roo-plan.md (validation failure) by reading a template file.
 * @param {string[]} planValidationIssues - Array of issues found during validation.
 * @param {string} finalPlan - The invalid plan content.
 * @param {string} structureResultMd - The structured markdown for context.
 * @param {string[]} techSpecificSlugs - Array of identified mode slugs.
 * @returns {string} The formatted plan refinement prompt.
 */
function getPlanRefinementPrompt(planValidationIssues, finalPlan, structureResultMd, techSpecificSlugs) {
  // Replace placeholders in the template
  let prompt = template.replace('{{planValidationIssues}}', planValidationIssues.join(', '));
  prompt = prompt.replace('{{finalPlan}}', finalPlan);
  prompt = prompt.replace('{{structureResultMd}}', structureResultMd);
  const slugsString = techSpecificSlugs.length > 0 ? techSpecificSlugs.join(', ') : '(Fallback to "code" mode)';
  prompt = prompt.replace('{{techSpecificSlugs}}', slugsString);
  return prompt;
}

module.exports = { getPlanRefinementPrompt };
