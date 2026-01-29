# Contributing to GHide

Thank you for your interest in contributing to GHide! We welcome improvements, bug fixes, and new features.

## Getting Started

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally.
3.  Run `npm install` to install dependencies.
4.  Run `npm run dev` to start the build in watch mode.

## Development Workflow

1.  Load the extension in Chrome:
    *   Go to `chrome://extensions/`
    *   Enable **Developer mode**
    *   Click **Load unpacked** and select the `dist/` directory.
2.  Make your changes.
3.  Reload the extension in Chrome to see updates (Vite handles the build, but you often need to reload the extension context).

## Pull Requests

1.  Create a new branch for your feature (`git checkout -b feature/amazing-feature`).
2.  Commit your changes.
3.  Push to the branch (`git push origin feature/amazing-feature`).
4.  Open a Pull Request.

## Code Style

*   Use modern JavaScript (ES Modules).
*   Keep the codebase lightweight (avoid adding heavy dependencies).
*   Follow the existing folder structure (`src/components`, `src/utils`).

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
