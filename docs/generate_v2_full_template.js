const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');
const XLSX = require('xlsx');

const projectRoot = path.resolve(__dirname, '..');

Module._extensions['.ts'] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { templateService } = require(path.join(projectRoot, 'v2/src/services/templateService.ts'));
const { TEMPLATE_WORKSHEET_NAMES } = require(path.join(projectRoot, 'v2/src/config/templateSchema.ts'));

function getSafeSheetName(originalName, usedNames) {
  const normalized = originalName.slice(0, 31);
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }

  let suffix = 2;
  while (suffix < 100) {
    const candidate = `${normalized.slice(0, 31 - String(suffix).length - 1)}_${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    suffix += 1;
  }

  throw new Error(`Could not build unique sheet name for ${originalName}`);
}

const workbookModel = templateService.createLocalWorkbookCopy();
for (const sheetName of TEMPLATE_WORKSHEET_NAMES) {
  if (!workbookModel[sheetName]) {
    workbookModel[sheetName] = [];
  }
}

const wb = XLSX.utils.book_new();
const usedNames = new Set();
for (const sourceName of TEMPLATE_WORKSHEET_NAMES) {
  const rows = workbookModel[sourceName] || [];
  const safeName = getSafeSheetName(sourceName, usedNames);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

const outputPath = path.join(projectRoot, 'docs', 'sortoved_v2_full_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`created: ${outputPath}`);
console.log(`sheets: ${wb.SheetNames.length}`);
