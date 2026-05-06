const fs = require('fs');
const path = require('path');

const searchDir = path.join(__dirname, '../frontend/src/app/pages');

const oldRegex = /<div class="bg-gradient-to-r from-\[#C8102E\] to-\[#A00D24\] pt-28 pb-10 px-4">/g;

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      if (oldRegex.test(content)) {
        console.log(`Processing file: ${fullPath}`);
        
        // Find existing indentation of the matched div to match it for the new element
        content = content.replace(/^(\s*)<div class="bg-gradient-to-r from-\[#C8102E\] to-\[#A00D24\] pt-28 pb-10 px-4">/gm, (match, indent) => {
           return `${indent}<div class="bg-gradient-peru-hero pt-28 pb-10 px-4 relative overflow-hidden">\n${indent}  <div class="absolute top-0 right-0 w-[400px] h-[400px] rounded-full border border-[var(--ceniza-claro)]"></div>`;
        });
        
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

processDirectory(searchDir);
console.log('Done!');
