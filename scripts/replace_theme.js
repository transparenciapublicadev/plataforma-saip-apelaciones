const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, '../frontend/src/app');

const replacements = [
  // RED / ERROR
  { regex: /\bbg-red-50\b|\bbg-red-100\b/g, replace: 'bg-[var(--estado-rojo-suave)]' },
  { regex: /\bbg-red-400\b|\bbg-red-500\b|\bbg-red-600\b/g, replace: 'bg-[var(--estado-rojo)]' },
  { regex: /\btext-red-400\b|\btext-red-500\b|\btext-red-600\b|\btext-red-700\b|\btext-red-800\b|\btext-red-900\b/g, replace: 'text-[var(--estado-rojo)]' },
  { regex: /\bborder-red-100\b|\bborder-red-200\b|\bborder-red-300\b/g, replace: 'border-[var(--estado-rojo-borde)]' },

  // AMBER / YELLOW
  { regex: /\bbg-yellow-50\b|\bbg-yellow-100\b|\bbg-amber-50\b|\bbg-amber-100\b/g, replace: 'bg-[var(--estado-ambar-suave)]' },
  { regex: /\bbg-yellow-400\b|\bbg-yellow-500\b|\bbg-amber-400\b|\bbg-amber-500\b/g, replace: 'bg-[var(--estado-ambar)]' },
  { regex: /\btext-yellow-700\b|\btext-yellow-800\b|\btext-amber-600\b|\btext-amber-700\b|\btext-amber-800\b/g, replace: 'text-[var(--estado-ambar)]' },
  { regex: /\bborder-yellow-100\b|\bborder-yellow-200\b|\bborder-amber-100\b|\bborder-amber-200\b/g, replace: 'border-[var(--estado-ambar-borde)]' },
  { regex: /\bhover:bg-amber-600\b|\bhover:bg-amber-700\b/g, replace: 'hover:bg-[var(--peru-oro-profundo)]' },

  // GREEN / SUCCESS
  { regex: /\bbg-green-50\b|\bbg-green-100\b/g, replace: 'bg-[var(--estado-verde-suave)]' },
  { regex: /\bbg-green-400\b|\bbg-green-500\b|\bbg-green-600\b/g, replace: 'bg-[var(--estado-verde)]' },
  { regex: /\btext-green-500\b|\btext-green-600\b|\btext-green-700\b|\btext-green-800\b|\btext-green-900\b/g, replace: 'text-[var(--estado-verde)]' },
  { regex: /\bborder-green-100\b|\bborder-green-200\b|\bborder-green-300\b/g, replace: 'border-[var(--estado-verde-borde)]' },
  { regex: /\bbg-green-200\b/g, replace: 'bg-[var(--estado-verde-borde)]' },

  // BLUE / INFO
  { regex: /\bbg-blue-50\b|\bbg-blue-100\b/g, replace: 'bg-[var(--estado-azul-suave)]' },
  { regex: /\bbg-blue-500\b|\bbg-blue-600\b/g, replace: 'bg-[var(--estado-azul)]' },
  { regex: /\btext-blue-600\b|\btext-blue-700\b|\btext-blue-800\b/g, replace: 'text-[var(--estado-azul)]' },
  { regex: /\bborder-blue-100\b|\bborder-blue-200\b|\bborder-blue-300\b/g, replace: 'border-[var(--estado-azul-borde)]' },

  // VIOLET accents used in design-reference admin/ttaip screens
  { regex: /\bbg-purple-50\b|\bbg-purple-100\b/g, replace: 'bg-[var(--accent-violet-soft)]' },
  { regex: /\bbg-purple-500\b|\bbg-purple-600\b/g, replace: 'bg-[var(--accent-violet)]' },
  { regex: /\btext-purple-600\b|\btext-purple-700\b|\btext-purple-900\b/g, replace: 'text-[var(--accent-violet)]' },
  { regex: /\bborder-purple-100\b|\bborder-purple-200\b|\bborder-purple-300\b/g, replace: 'border-[var(--accent-violet-border)]' },
  { regex: /\bring-purple-100\b|\bring-purple-200\b/g, replace: 'ring-[var(--accent-violet-soft)]' },

  // Hex-based violet shorthand in templates
  { regex: /bg-\[#F5F3FF\]/g, replace: 'bg-[var(--accent-violet-soft)]' },

  // Hex bracket colors -> semantic tokens
  { regex: /\[#C8102E\]/g, replace: '[var(--peru-rojo)]' },
  { regex: /\[#B91C1C\]/g, replace: '[var(--peru-rojo-hover)]' },
  { regex: /\[#10B981\]/g, replace: '[var(--estado-verde)]' },
  { regex: /\[#059669\]/g, replace: '[var(--estado-verde)]' },
  { regex: /\[#065F46\]/g, replace: '[var(--estado-verde)]' },
  { regex: /\[#F0FDF4\]/g, replace: '[var(--estado-verde-suave)]' },
  { regex: /\[#86EFAC\]/g, replace: '[var(--estado-verde-borde)]' },
  { regex: /\[#DC2626\]/g, replace: '[var(--estado-rojo)]' },
  { regex: /\[#FEE2E2\]/g, replace: '[var(--estado-rojo-suave)]' },
  { regex: /\[#FCA5A5\]/g, replace: '[var(--estado-rojo-borde)]' },
  { regex: /\[#D97706\]/g, replace: '[var(--estado-ambar)]' },
  { regex: /\[#F59E0B\]/g, replace: '[var(--estado-ambar)]' },
  { regex: /\[#92400E\]/g, replace: '[var(--estado-ambar)]' },
  { regex: /\[#78350F\]/g, replace: '[var(--estado-ambar)]' },
  { regex: /\[#FFFBEB\]/g, replace: '[var(--estado-ambar-suave)]' },
  { regex: /\[#FDE68A\]/g, replace: '[var(--estado-ambar-borde)]' },
  { regex: /\[#FCD34D\]/g, replace: '[var(--estado-ambar-borde)]' },
  { regex: /\[#EA580C\]/g, replace: '[var(--estado-ambar)]' },
  { regex: /\[#2563EB\]/g, replace: '[var(--estado-azul)]' },
  { regex: /\[#1D4ED8\]/g, replace: '[var(--estado-azul)]' },
  { regex: /\[#EFF6FF\]/g, replace: '[var(--estado-azul-suave)]' },
  { regex: /\[#6366F1\]/g, replace: '[var(--accent-violet)]' },
  { regex: /\[#4338CA\]/g, replace: '[var(--accent-violet)]' },
  { regex: /\[#EEF2FF\]/g, replace: '[var(--accent-violet-soft)]' },

  // Quoted inline style hex values -> semantic variables
  { regex: /'#FEF2F2'/g, replace: "'var(--estado-rojo-suave)'" },
  { regex: /'#F0FDF4'/g, replace: "'var(--estado-verde-suave)'" },
  { regex: /'#DC2626'/g, replace: "'var(--estado-rojo)'" },
  { regex: /'#059669'/g, replace: "'var(--estado-verde)'" },

  // Neutral grays that break dark mode
  { regex: /\bborder-gray-100\b|\bborder-gray-200\b|\bborder-gray-300\b/g, replace: 'border-[var(--border)]' },
  { regex: /\btext-gray-500\b|\btext-gray-600\b|\btext-gray-700\b|\btext-gray-800\b/g, replace: 'text-[var(--muted-foreground)]' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      for (const { regex, replace } of replacements) {
        content = content.replace(regex, replace);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(directory);
