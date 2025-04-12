// renderer.js - Handles UI logic for the Roo Plan Generator

const projectIdeaTextarea = document.getElementById('project-idea');
const generatePlanBtn = document.getElementById('generate-plan-btn');
const loadingIndicator = document.getElementById('loading-indicator');
// Removed references to output elements as they will be deleted from HTML

// --- Event Listeners ---

generatePlanBtn.addEventListener('click', async () => {
    const idea = projectIdeaTextarea.value.trim();
    if (!idea) {
        alert('Please enter a project idea.');
        return;
    }

    // Disable UI elements during processing
    setLoadingState(true);
    // Output area is removed, no need to clear/hide elements here

    try {
        // Call the main process function via preload script
        // The main process now handles generation AND saving via dialog
        const result = await window.electronAPI.generatePlan(idea);

        // Basic check if the main process reported success/failure/cancellation
        // Specific handling might depend on the structure returned by the updated main process function
        if (result && result.error) {
             alert(`Error during plan generation or saving: ${result.error}`);
        } else if (result && result.cancelled) {
            console.log('Save operation cancelled by user.');
            // Optionally provide feedback that saving was cancelled
            // alert('Save cancelled.');
        } else if (result && result.success) {
             console.log('Plan generated and saved successfully.');
             // Optionally provide feedback
             // alert('Plan generated and saved!');
        }
        // No need to display plan or files here anymore
    } catch (error) {
        console.error('Error invoking generatePlan IPC:', error);
        alert(`An unexpected error occurred while communicating with the generation process: ${error.message}`);
        // No output area to display error in
    } finally {
        // Re-enable UI elements
        setLoadingState(false);
    }
});

// Removed event listeners for copy, export, and save config buttons
// as the output section is removed and saving is handled by main process.


// --- Helper Functions ---

function setLoadingState(isLoading) {
    if (isLoading) {
        loadingIndicator.style.display = 'block';
        generatePlanBtn.disabled = true;
        // Removed disabling of other buttons
    } else {
        loadingIndicator.style.display = 'none';
        generatePlanBtn.disabled = false;
        // Removed re-enabling of other buttons
    }
}

// Removed displayConfigFiles function as it's no longer needed.

console.log('Renderer script loaded.');