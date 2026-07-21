const fs = require('fs');
let content = fs.readFileSync('prisma/schema.prisma', 'utf8');
content = content.replace(/@db\.LongText/g, '@db.Text');
fs.writeFileSync('prisma/schema.prisma', content);
