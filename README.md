# Roo Plan Generator GUI

A GUI application to generate structured Roo Code plans from project ideas. This desktop application helps streamline the process of creating well-structured development plans using Roo Code methodology.

## Features

- Electron-based desktop application
- Interactive GUI for plan generation
- Multi-stage planning process
- Integration with Google's Generative AI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jarrydgordon/roo-plan-generator-gui.git
cd roo-plan-generator-gui
```

2. Install dependencies:
```bash
npm install
```

## Usage

To start the application:

```bash
npm start
```

## Project Structure

```
├── src/
│   ├── engine.js          # Core engine functionality
│   ├── ipcHandlers.js     # Electron IPC handlers
│   ├── llm.js            # LLM integration
│   ├── utils.js          # Utility functions
│   └── prompts/          # Plan generation prompts
│       ├── stage1/       # Analysis stage
│       ├── stage2/       # Structure stage
│       ├── stage3/       # Outline refinement
│       ├── stage4/       # Rules and configurations
│       ├── stage5/       # Modes generation
│       └── stage6/       # Plan assembly and review
├── main.js               # Electron main process
├── preload.js           # Electron preload script
├── renderer.js          # Renderer process logic
└── index.html           # Main application window
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
