// src/prompts/stage3/outlineRefinement.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let refinementPromptTemplate = '';
try {
    const templatePath = path.join(__dirname, 'outlineRefinement.txt');
    refinementPromptTemplate = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading outline refinement prompt template:", error);
    refinementPromptTemplate = "Error: Could not load outline refinement template. Analysis: {{analysisResult}}, Structure: {{structureContext}}, Outlines: {{preliminaryOutlines}}";
}

/**
 * Generates the prompt for Stage 3: Outline Refinement by reading a template file.
 * @param {string} analysisResult - The result from the analysis stage.
 * @param {string} structureResultMd - The structured markdown from stage 2.
 * @param {string} preliminaryOutlines - The initial outlines extracted from structureResultMd.
 * @returns {string} The formatted outline refinement prompt.
 */
function getOutlineRefinementPrompt(analysisResult, structureResultMd, preliminaryOutlines) {
  // Remove the old outlines section from the context provided to the LLM
  const prelimOutlineParser = /### Core Logic Outlines\s*([\s\S]*?)(?:##|$)/;
  const structureContext = structureResultMd.replace(prelimOutlineParser, '').trim(); // Trim result

  // Replace placeholders in the template
  let prompt = refinementPromptTemplate.replace('{{analysisResult}}', analysisResult);
  prompt = prompt.replace('{{structureContext}}', structureContext);
  prompt = prompt.replace('{{preliminaryOutlines}}', preliminaryOutlines || "- (No outlines provided in previous step)"); // Handle empty outlines
  return prompt;
}

module.exports = { getOutlineRefinementPrompt };
