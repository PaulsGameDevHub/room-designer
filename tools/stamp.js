// Rewrites the BUILD constant in index.html with the current date and time, so
// the stamp shown in the app's bottom-right corner always matches what was last
// deployed. Run before committing:
//
//   node tools/stamp.js
//
// Prints the new stamp, which is the value to quote when telling someone which
// build to expect.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
const VERSION = 'v16';

const pad = n => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${VERSION} · ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} `
            + `${pad(now.getHours())}:${pad(now.getMinutes())}`;

const src = fs.readFileSync(FILE, 'utf8');
const re = /^const BUILD = '[^']*';(\s*\/\*BUILD_STAMP\*\/)/m;
if(!re.test(src)){
  console.error('Could not find the BUILD line marked /*BUILD_STAMP*/ in index.html');
  process.exit(1);
}
const out = src.replace(re, `const BUILD = '${stamp}';$1`);
if(out === src){
  console.log('stamp unchanged: ' + stamp);
}else{
  fs.writeFileSync(FILE, out);
  console.log('stamped: ' + stamp);
}
