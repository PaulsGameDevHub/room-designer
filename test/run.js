// Runs the whole test suite. Usage: node test/run.js
const {execFileSync} = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const here = __dirname;
const pdf = path.join(os.tmpdir(), 'roomdesigner-test.pdf');
let failed = 0;

function step(title, args){
  console.log('\n' + '─'.repeat(70));
  console.log(title);
  console.log('─'.repeat(70));
  try{
    const out = execFileSync(process.execPath, args, {encoding:'utf8', stdio:'pipe'});
    process.stdout.write(out);
  }catch(e){
    failed++;
    if(e.stdout) process.stdout.write(e.stdout);
    if(e.stderr) process.stderr.write(e.stderr);
  }
}

step('Markup and script wiring', [path.join(here, 'wiring.js')]);
step('Functional smoke test', [path.join(here, 'smoke.js'), pdf]);
if(fs.existsSync(pdf)) step('PDF geometry', [path.join(here, 'pdfcheck.js'), pdf]);

console.log('\n' + '═'.repeat(70));
console.log(failed ? `${failed} stage(s) reported failures` : 'All stages passed');
process.exit(failed ? 1 : 0);
