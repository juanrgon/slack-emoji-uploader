# Contributing to Slack Emoji Uploader

We're excited that you're interested in contributing to Slack Emoji Uploader! This document provides guidelines and instructions for contributing to this project.

## Development Setup

Follow these steps to set up the project for development:

1. **Clone the repository**

   ```bash
   git clone https://github.com/juanrgon/slack-emoji-uploader.git
   cd slack-emoji-uploader
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Development workflow**

   To start the development process with automatic compilation and file watching:

   ```bash
   npm run watch
   ```

   This command will:
   - Watch for changes in TypeScript files and recompile them
   - Copy static assets (HTML, CSS, JSON) to the `dist` folder
   - Automatically update the `dist` folder as you make changes

4. **Building for production**

   To create a production build:

   ```bash
   npm run build
   ```

   This will compile all TypeScript files and copy static assets to the `dist` folder.

5. **Loading the extension in Chrome**

   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the `dist` folder from this project

6. **Making changes**

   - Edit files in the `src` folder
   - The `watch` script will automatically recompile and copy files
   - Refresh the extension in Chrome to see your changes

## Project Structure

- `src/`: Source files (TypeScript, HTML, CSS)
- `dist/`: Compiled and copied files (generated, don't edit directly)
- `tsconfig.json`: TypeScript configuration
- `package.json`: Project dependencies and scripts

## Available Scripts

- `npm run watch`: Start development mode with file watching
- `npm run build`: Create a production build
- `npm run lint`: Run ESLint to check code quality (if configured)

## Submitting Changes

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with a clear commit message
4. Push your changes to your fork
5. Submit a pull request to the main repository

## Code Style

[Any specific code style guidelines for the project]

## Testing

[Instructions for running tests, if applicable]

## Reporting Issues

If you find a bug or have a suggestion for improvement, please open an issue on the GitHub repository.

Thank you for contributing to Slack Emoji Uploader!
