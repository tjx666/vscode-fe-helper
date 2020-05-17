const { resolve } = require('path');
const fs = require('fs-extra');

const cssStr = fs.readFileSync(resolve(__dirname, './test.css'), 'utf-8');
console.log(cssStr);
console.log(cssStr.replace(/\/\*(.|\n|\r)*?\*\//gm, ''));
