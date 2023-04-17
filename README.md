# VSCode FE Helper

[![Version](https://img.shields.io/visual-studio-marketplace/v/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items/YuTengjing.vscode-fe-helper/changelog) [![Installs](https://img.shields.io/visual-studio-marketplace/i/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper) [![Rating Star](https://img.shields.io/visual-studio-marketplace/stars/YuTengjing.vscode-fe-helper)](https://marketplace.visualstudio.com/items?itemName=YuTengjing.vscode-fe-helper&ssr=false#review-details) [![Last Updated](https://img.shields.io/visual-studio-marketplace/last-updated/YuTengjing.vscode-fe-helper)](https://github.com/tjx666/vscode-fe-helper)

![test](https://github.com/tjx666/vscode-fe-helper/actions/workflows/test.yml/badge.svg) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](http://makeapullrequest.com) [![Percentage of issues still open](https://isitmaintained.com/badge/open/tjx666/vscode-fe-helper.svg)](http://isitmaintained.com/project/tjx666/vscode-fe-helper') [![MIT License](https://img.shields.io/github/license/tjx666/vscode-fe-helper)](https://github.com/tjx666/vscode-fe-helper/blob/master/LICENSE)

## Features

- remove comments
- transform module imports
- transform ECMAScript syntax
- pluralize word
- remove irregular whitespace
- transform color format
- paste JSON as code
- space god

## Usage

All the features using by run it's command. You can show command panel by keyboard shortcut <kbd>ctrl</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd> on **Windows** or <kbd>⌘</kbd>+<kbd>⇧</kbd>+<kbd>P</kbd> on **MacOS**.

## Details

### remove comments

command: `remove comments`

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

![remove comments](https://github.com/tjx666/vscode-fe-helper/raw/master/images/remove_comments.gif?raw=true)

### transform module imports

command: `transform module imports`

This feature allow you to convert between `commonjs` and `esm`.

![transform module imports](https://github.com/tjx666/vscode-fe-helper/raw/master/images/transform_module_imports.gif?raw=true)

### transform ECMAScript syntax

You can use command: `FE Helper: transform ECMAScript syntax` to transform ECMAScript syntax.

For now, supports:

- ES5 to ES6/ES7
- Using tsc compile code to ES5
- Using tsc compile code to ES3

### pluralize word

command: `pluralize`

Pluralize all the words selected in current active editor.

![pluralize word](https://github.com/tjx666/vscode-fe-helper/raw/master/images/pluralize.gif?raw=true)

### remove irregular whitespace

command: `remove irregular whitespace`

Sometime I copy description from LeetCode problem and paste into VSCode, but there are some irregular whitespace in the text. For that time, this feature is very useful and convenient.

![remove irregular whitespace](https://github.com/tjx666/vscode-fe-helper/raw/master/images/remove_irregular_whitespace.gif?raw=true)

### transform color format

command: `transform color format`

supported formats:

- hex
- rgb/rgba
- cmyk
- hsv
- hsl
- ansi16
- ansi256

![transform color format](https://github.com/tjx666/vscode-fe-helper/raw/master/images/transform_color_format.gif?raw=true)

### paste JSON as Object

You can copy JSON content, and paste as JavaScript code. The principle behind this functionality is very simple:

```javascript
const jsCode = jsonFromClipboard.replace(/"([^"]*)"\s*:/gm, '$1:');
```

![paste JSON as code](https://github.com/tjx666/vscode-fe-helper/raw/master/images/jsonToCode.gif?raw=true)

### space god

For Chinese users, there should be space between English word, number, and punctuation. It's very convenient to add space between them by command `FE Helper: spaceGod`。

![space god](https://github.com/tjx666/vscode-fe-helper/raw/master/images/space_god.gif?raw=true)

### Copy Commands

following commands had been migrated to another extension: [Clipboard Master](https://marketplace.visualstudio.com/items?itemName=YuTengjing.clipboard-master)

- copy with line number
- copy text without syntax
- smart copy
- copy as markdown code block

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
- [Neo File Utils](https://github.com/tjx666/vscode-neo-file-utils)
- [Package Manager Enhancer](https://github.com/tjx666/package-manager-enhancer)
- [VSCode archive](https://github.com/tjx666/vscode-archive)
- [Modify File Warning](https://github.com/tjx666/modify-file-warning)
- [Power Edit](https://github.com/tjx666/power-edit)
- [Adobe Extension Development Tools](https://github.com/tjx666/vscode-adobe-extension-devtools)
- [Scripting Listener](https://github.com/tjx666/scripting-listener)

Check all here: [publishers/YuTengjing](https://marketplace.visualstudio.com/publishers/YuTengjing)
