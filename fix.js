const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');
content = content.replace(/, map: "[^"]+"/g, '');
fs.writeFileSync('prisma/schema.prisma', content);
