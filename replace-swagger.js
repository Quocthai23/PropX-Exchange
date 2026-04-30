const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}
const files = walk('./src');
let changedCount = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('@ApiBearerAuth()')) {
    content = content.replace(/@ApiBearerAuth\(\)/g, "@ApiBearerAuth('accessToken')");
    fs.writeFileSync(file, content);
    changedCount++;
  }
}
console.log('Files changed:', changedCount);
