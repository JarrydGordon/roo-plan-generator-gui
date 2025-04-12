// src/prompts/utility/setupCommands.js
const fs = require('fs');
const path = require('path');

// Read the template file synchronously
let template = '';
try {
    const templatePath = path.join(__dirname, 'setupCommands.txt');
    template = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
    console.error("Error reading setup commands prompt template:", error);
    // Provide a basic fallback template in case of error
    template = `Error loading template. Context: {{directoryPath}}, Artifacts: {{artifactList}}, Structure: {{structureSummary}}`;
}

/**
 * Generates the prompt for suggesting setup commands.
 * @param {string} directoryPath - The path to the generated project directory.
 * @param {string[]} artifactList - List of generated artifact filenames.
 * @param {string} structureSummary - A summary of the scaffolded structure (e.g., list of top-level files/dirs).
 * @returns {string} The formatted setup commands prompt.
 */
function getSetupCommandsPrompt(directoryPath, artifactList, structureSummary) {
  let prompt = template.replace('{{directoryPath}}', directoryPath);
  prompt = prompt.replace('{{artifactList}}', artifactList.join(', ') || 'None');
  prompt = prompt.replace('{{structureSummary}}', structureSummary || 'Not available');
  return prompt;
}

module.exports = { getSetupCommandsPrompt };
