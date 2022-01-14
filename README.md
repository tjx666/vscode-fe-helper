# VSCode FE Helper

![GitHub](https://img.shields.io/github/license/tjx666/vscode-fe-helper) [![Build Status](https://travis-ci.org/tjx666/vscode-fe-helper.svg?branch=master)](https://travis-ci.org/tjx666/vscode-fe-helper) [![Known Vulnerabilities](https://snyk.io/test/github/tjx666/vscode-fe-helper/badge.svg?targetFile=package.json)](https://snyk.io/test/github/tjx666/vscode-fe-helper?targetFile=package.json) [![Percentage of issues still open](https://isitmaintained.com/badge/open/tjx666/vscode-fe-helper.svg)](http://isitmaintained.com/project/tjx666/vscode-fe-helper') [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](http://makeapullrequest.com)

## Features

- remove comments
- transform module imports
- pluralize word
- remove irregular whitespace
- transform color format
- paste JSON as code
- space god
- copy with line number
- copy text without syntax
- transform ECMAScript syntax

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

### copy with line number

You can use command: `FE Helper: copy with line number` to copy some content with line number.

![copy with line number](https://github.com/tjx666/vscode-fe-helper/raw/master/images/copy_with_line_number.gif?raw=true)

### copy text without syntax

You can use command: `FE Helper: copy text without syntax` to copy selected text without syntax.

### transform ECMAScript syntax

You can use command: `FE Helper: transform ECMAScript syntax` to transform ECMAScript syntax.

For now, supports:

- ES5 to ES6/ES7
- Using tsc compile code to ES5
- Using tsc compile code to ES3

## TODO

Some of them may be implemented as a standalone extension.

- convert between codePoint and str
- translate
- git pr notify
- Open Folder Context Menus
- regexp preview
- JSON to types
- color highlight
- file info, mp3, mp4 etc
- highlight text
- regexp preview
- path-autocomplete support ignore file
- comment auto complete
- command plate: toggle bracket color guide line
- zip/unzip, vsix
- directory tree
- apng preview like gif preview
- font preview supports checking font info like assent/descent
- command plate: open extension folder
- command plate: open node_modules folder
