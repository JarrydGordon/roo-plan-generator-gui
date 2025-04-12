// src/utils.js - Utility functions for file operations and comments

const path = require('path');
const fs = require('fs').promises;
const log = require('electron-log'); // Import electron-log

/**
 * Determines the appropriate line comment prefix for a given file path based on its extension.
 * @param {string} filePath - The path to the file.
 * @returns {string} The line comment prefix (e.g., '//', '#', '--') or '<!--' for HTML/XML/MD. Defaults to '//'.
 */
function getCommentPrefix(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.css':
    case '.scss':
    case '.less':
    case '.java':
    case '.c':
    case '.cpp':
    case '.h':
    case '.cs':
    case '.go':
    case '.swift':
    case '.kt':
    case '.rs':
      return '//';
    case '.py':
    case '.rb':
    case '.sh':
    case '.yaml':
    case '.yml':
    case '.dockerfile':
    case '.r':
      return '#';
    case '.html':
    case '.xml':
    case '.vue':
    case '.md': // Markdown comments are <!-- --> but often # or // are used informally
      return '<!--'; // Use HTML comments for broad compatibility including MDX
    case '.sql':
      return '--';
    case '.lua':
      return '--';
    // Add more cases as needed
    default:
      return '//'; // Default to C-style comments
  }
}

/**
 * Creates directories and files based on a structure list, adding comments and outlines.
 * @param {string} baseDirectory - The root directory for scaffolding.
 * @param {Array<{type: 'dir'|'file', path: string}>} structureList - An array describing the structure.
 * @param {Record<string, string>} [fileOutlines={}] - An object mapping file paths to their outline content.
 * @returns {Promise<Array<{path: string, error: string}>>} A list of errors encountered during scaffolding.
 */
async function scaffoldProject(baseDirectory, structureList, fileOutlines = {}) {
  log.info(`Scaffolding project in: ${baseDirectory}`); // Use log.info
  const errors = []; // Array to collect errors

 if (!structureList || structureList.length === 0) {
   log.info("No structure items provided for scaffolding."); // Use log.info
   return errors; // Return empty error array
 }

 for (const item of structureList) {
   // Basic path sanitization: remove leading slashes/dots that might cause issues with path.join
   // Basic path sanitization and normalization
   let normalizedPath = item.path.replace(/^[\/\.]+|[\/\.]+$/g, ''); // Remove leading/trailing dots/slashes
   if (!normalizedPath) continue; // Skip empty paths after sanitization
   normalizedPath = path.normalize(normalizedPath); // Normalize for OS

   const fullPath = path.join(baseDirectory, normalizedPath);
   try {
     if (item.type === 'dir') {
       log.info(`Creating directory: ${fullPath}`); // Use log.info
       await fs.mkdir(fullPath, { recursive: true });
     } else if (item.type === 'file') {
       // Ensure parent directory exists before writing file
       const parentDir = path.dirname(fullPath);
       // Check if parentDir is different from baseDirectory to avoid unnecessary checks
       if (parentDir !== baseDirectory && parentDir !== '.') {
            await fs.mkdir(parentDir, { recursive: true });
        }
        log.info(`Creating file (or overwriting if outline/comment exists): ${fullPath}`); // Use log.info

        // Determine comment prefix using the original item path for correct extension detection
        const commentPrefix = getCommentPrefix(item.path);
        // Create the file path comment using the normalized path for clarity in the file
        const pathComment = `${commentPrefix} File: ${normalizedPath.replace(/\\/g, '/')} ${commentPrefix === '<!--' ? '-->' : ''}`; // Use forward slashes in comment

        // Get potential boilerplate/outline content using the original, non-normalized path as the key
        const outlineContent = fileOutlines[item.path] || ''; // Use original path for lookup

        // Combine comment and outline content
        const finalFileContent = `${pathComment}\n\n${outlineContent.trim()}`.trim() + '\n'; // Ensure newline at end

        // Write file, overwriting if it exists
        await fs.writeFile(fullPath, finalFileContent);
      }
    } catch (error) {
      // Log errors and add them to the errors array
      log.error(`Error scaffolding item \"${normalizedPath}\" at ${fullPath}:`, error); // Use log.error
      errors.push({ path: normalizedPath, error: error.message }); // Log normalized path in error
   }
 }
 log.info(`Scaffolding complete. Encountered ${errors.length} errors.`); // Use log.info
 return errors; // Return the array of errors
}

/**
 * Parses a Markdown string to extract a JSON array describing the proposed file structure.
 * Looks for a section like "## Proposed Structure" followed by a JSON code block.
 * Tries a flexible primary regex first, then falls back to searching for any ```json block.
 * @param {string} markdownContent - The Markdown content containing the structure definition.
 * @returns {Array<{type: 'dir'|'file', path: string}>} The parsed structure list, or an empty array if not found or invalid.
 */
function parseStructureFromJsonMd(markdownContent) {
    log.info("Parsing proposed structure (JSON) from Markdown..."); // Use log.info
    let proposedStructureList = [];
    let jsonMatch = null;
    let extractedJsonString = null;

    // 1. Primary Regex: Flexible heading, optional text, optional 'json' tag
    const primaryRegex = /[#]{2,3}\s*Proposed (?:File )?Structure(?:\s*\(JSON\))?[\s\S]*?```(?:json)?\s*([\s\S]*?)\s*```/im;
    jsonMatch = markdownContent.match(primaryRegex);

    if (jsonMatch && jsonMatch[1]) {
        log.info("Found structure using primary flexible regex.");
        extractedJsonString = jsonMatch[1].trim();
    } else {
        // 2. Fallback Regex: Just look for any ```json block
        log.warn("Primary regex failed. Trying fallback regex for any ```json block...");
        const fallbackRegex = /```json\s*([\s\S]*?)\s*```/m;
        jsonMatch = markdownContent.match(fallbackRegex);
        if (jsonMatch && jsonMatch[1]) {
            log.info("Found structure using fallback ```json regex.");
            extractedJsonString = jsonMatch[1].trim();
        }
    }

    if (extractedJsonString) {
        try {
            const parsedJson = JSON.parse(extractedJsonString);
            if (Array.isArray(parsedJson)) {
                 proposedStructureList = parsedJson.filter(item =>
                    item && typeof item === 'object' &&
                    (item.type === 'dir' || item.type === 'file') &&
                    typeof item.path === 'string' && item.path.trim()
                ).map(item => ({
                    type: item.type,
                    // Normalize paths: use forward slashes, remove trailing slashes
                    path: item.path.trim().replace(/\\/g, '/').replace(/\/$/, '')
                }));
                // Fix common naming issues like 'gitignore' -> '.gitignore'
                proposedStructureList = proposedStructureList.map(item =>
                    item.path.toLowerCase() === 'gitignore' ? { ...item, path: '.gitignore' } : item
                );
                log.info(`Successfully parsed ${proposedStructureList.length} structure items from JSON.`); // Use log.info
            } else {
                log.warn("Parsed JSON structure is not an array."); // Use log.warn
            }
        } catch (parseError) {
            log.error("Failed to parse extracted JSON structure list:", parseError); // Use log.error
        }
    } else {
        log.warn("Could not find or extract JSON structure block using primary or fallback regex."); // Use log.warn
    }
    return proposedStructureList;
}

/**
 * Parses a Markdown string to extract core logic outlines for different files.
 * Looks for a specific section: ### Core Logic Outlines followed by list items like "- `filepath`:".
 * @param {string} markdownContent - The Markdown content containing the outlines.
 * @returns {Record<string, string>} An object mapping normalized file paths to their outline content.
 */
function parseOutlinesFromMd(markdownContent) {
    log.info("Parsing core logic outlines from Markdown..."); // Use log.info
    const coreLogicOutlines = {};
    // More flexible regex: Allows ## or ### for the heading
    const outlineSectionRegex = /^[#]{2,3}\s*Core Logic Outlines\s*([\s\S]*?)(?:^[#]{2,}\s|\s*$)/m;
    const outlineSectionMatch = markdownContent.match(outlineSectionRegex);

    if (outlineSectionMatch && outlineSectionMatch[1]) {
        const outlineContent = outlineSectionMatch[1];
        const outlineLines = outlineContent.split('\n');
        const outlineFileRegex = /^\s*-\s*`([^`]+)`:/; // Matches "- `filepath`:"
        let currentOutlineFile = null;
        let currentOutline = '';

        for (const line of outlineLines) {
            const fileMatch = line.match(outlineFileRegex);
            if (fileMatch) {
                // Save previous outline if exists
                if (currentOutlineFile && currentOutline.trim()) {
                    // Use the original path from the regex match as the key
                    coreLogicOutlines[currentOutlineFile] = currentOutline.trim();
                }
                // Start new outline, store the original path from regex match
                currentOutlineFile = fileMatch[1].trim(); // Keep original path for key
                currentOutline = ''; // Reset content for the new file
            } else if (currentOutlineFile) {
                // Append line to current outline, preserving relative indentation/formatting
                // Avoid adding leading/trailing empty lines unless they are part of code blocks
                 if (currentOutline.length > 0 || line.trim().length > 0) {
                     // Add line, potentially adjusting indentation if needed (simple approach here)
                     currentOutline += line + '\n';
                 }
            }
        }
        // Save the last outline using the original path key
        if (currentOutlineFile && currentOutline.trim()) {
            coreLogicOutlines[currentOutlineFile] = currentOutline.trim();
        }
    } else {
        log.warn("Could not find or extract Core Logic Outlines section from Markdown."); // Use log.warn
    }
    log.info(`Parsed outlines for ${Object.keys(coreLogicOutlines).length} files.`); // Use log.info
    return coreLogicOutlines;
}


module.exports = {
    getCommentPrefix,
    scaffoldProject,
    parseStructureFromJsonMd,
    parseOutlinesFromMd,
};
