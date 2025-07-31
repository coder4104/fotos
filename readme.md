Here is the complete `README.md` file formatted in proper Markdown syntax:

````markdown
# 📸 Fotos

Fotos is a cross-platform Electron desktop application for managing and viewing your images efficiently. Built with **Vite**, **Electron**, and **TypeScript**, it offers both a local development environment and a production packaging workflow.

---

## 🚀 Getting Started

### 📦 From a ZIP File

If you're starting from a ZIP:

```bash
cd getfotos-main
cd fotos
npm install
````

### 💻 Run the App Locally

To build and preview the app in a local Electron window:

```bash
npm run preview
```

This runs:

* Vite build
* TypeScript compilation (for Electron)
* Launches the app via Electron

### 📦 Package into a Windows Executable

To build a `.exe` version of the app:

```bash
npm run package
```

This will:

* Build the frontend using Vite
* Transpile Electron files using TypeScript
* Package the app with Electron Packager
* Output to the `release/` directory as a portable executable

---

## 🛠 Scripts Overview

| Script            | Description                                       |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Development mode with Vite + Electron live reload |
| `npm run preview` | Builds and previews the Electron app              |
| `npm run package` | Creates a Windows portable executable             |
| `npm run build`   | Builds app using electron-builder                 |

---

## 📁 Project Structure

```
getfotos-main/
└── fotos/
    ├── public/             # Static assets and electron
    ├── src/                # Frontend code
    ├── dist/               # Build output
    ├── main.js             # Electron entry point
    ├── vite.config.ts      # Vite config
    ├── package.json        # Scripts and dependencies
    └── ...
```

---

## 📤 Output

After running the package script:

```bash
npm run package
```

Your Windows `.exe` file will be available in the `release/` folder.

