# VSCode FE Helper

[![Version](https://img.shields.io/visual-studio-marketplace/v/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items/YuTengjing.vscode-fe-helper/changelog) [![Installs](https://img.shields.io/visual-studio-marketplace/i/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper) [![Rating Star](https://img.shields.io/visual-studio-marketplace/stars/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper&ssr=false#review-details) [![Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/YuTengjing.vscode-fe-helper)](https://github.com/tjx666/vscode-fe-helper)

![test](https://github.com/tjx666/vscode-fe-helper/actions/workflows/test.yml/badge.svg) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](http://makeapullrequest.com) [![Percentage of issues still open](https://isitmaintained.com/badge/open/tjx666/vscode-fe-helper.svg)](http://isitmaintained.com/project/tjx666/vscode-fe-helper') [![MIT License](https://img.shields.io/github/license/tjx666/vscode-fe-helper)](https://github.com/tjx666/vscode-fe-helper/blob/master/LICENSE)

## Usage

All the features are used by run command. You can show command plate by keyboard shortcut <kbd>ctrl</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd> on **Windows** or <kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd> on **MacOS**. All commands provided by this extension is prefixed with `FE Helper:`.

## Features

### Remove Comments

command: `FE Helper: Remove Comments`

supported languages:

- html/xml
- css/sass/scss/less
- javascript/javascriptreact/typescript/typescriptreact
- jsonc
- vue
- markdown
- editorconfig
- yaml
- ignore (eg: .gitignore, .eslintignore)

![Remove Comments](https://github.com/tjx666/vscode-fe-helper/raw/master/images/remove_comments.gif?raw=true)

### Transform Module Imports

Command: `FE Helper: Transform Module Imports`

This feature allow you to convert import statements between `commonjs` and `esm`.

![Transform Module Imports](https://github.com/tjx666/vscode-fe-helper/raw/master/images/transform_module_imports.gif?raw=true)

### Transform ECMAScript Syntax

Command: `FE Helper: Transform ECMAScript Syntax`

For now, supports:

- ES5 to ES6/ES7
- Using tsc compile code to ES5
- Using tsc compile code to ES3

### Pluralize

command: `FE Helper: Pluralize`

Pluralize all the words selected in current active editor.

![Pluralize](https://github.com/tjx666/vscode-fe-helper/raw/master/images/pluralize.gif?raw=true)

### Remove Irregular Whitespace

Command: `FE Helper: Remove Irregular Whitespace`

Sometime I copy description from LeetCode problem and paste into VSCode, but there are some irregular whitespace in the text. For that time, this feature is very useful and convenient.

![Remove Irregular Whitespace](https://github.com/tjx666/vscode-fe-helper/raw/master/images/remove_irregular_whitespace.gif?raw=true)

### Transform Color Format

Command: `FE Helper: Transform Color Format`

supported formats:

- hex
- rgb/rgba
- cmyk
- hsv
- hsl
- ansi16
- ansi256

![Transform Color Format](https://github.com/tjx666/vscode-fe-helper/raw/master/images/transform_color_format.gif?raw=true)

### Paste JSON as Object

You can copy JSON content, and paste as JavaScript code. The principle behind this functionality is very simple:

```javascript
const jsCode = jsonFromClipboard.replace(/"([^"]*)"\s*:/gm, '$1:');
```

![Paste JSON as Object](https://github.com/tjx666/vscode-fe-helper/raw/master/images/jsonToCode.gif?raw=true)

### SpaceGod

For Chinese users, there should be space between English word, number, and punctuation. It's very convenient to add space between them by command `FE Helper: SpaceGod`。

![SpaceGod](https://github.com/tjx666/vscode-fe-helper/raw/master/images/space_god.gif?raw=true)

### Other Useful FrontEnd Tools Commands

- `FE Helper: Force Prettier`
- `FE Helper: Force ESLint`
- `FE Helper: Force Stylelint`
- `FE Helper: Force Markdownlint`
- `FE Helper: Show Active File ESLint Performance`
- `FE Helper: Show Active File ESLint Config`
- `FE Helper: Show Active File Stylelint Config`

## My extensions

- [Open in External App](https://github.com/tjx666/open-in-external-app)
- [Package Manager Enhancer](https://github.com/tjx666/package-manager-enhancer)
- [Neo File Utils](https://github.com/tjx666/vscode-neo-file-utils)
- [VSCode FE Helper](https://github.com/tjx666/vscode-fe-helper)
- [VSCode archive](https://github.com/tjx666/vscode-archive)
- [Better Colorizer](https://github.com/tjx666/better-colorizer/tree/main)
- [Modify File Warning](https://github.com/tjx666/modify-file-warning)
- [Power Edit](https://github.com/tjx666/power-edit)
- [Reload Can Solve Any Problems](https://github.com/tjx666/reload-can-solve-any-problems)

Check all here: [publishers/YuTengjing](https://marketplace.visualstudio.com/publishers/YuTengjing)
