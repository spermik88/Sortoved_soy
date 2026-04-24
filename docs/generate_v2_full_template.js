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
const { SHEET_ALIASES } = require(path.join(projectRoot, 'v2/src/config/templateSchema.ts'));

const SAFE_SHEET_NAME_OVERRIDES = {
  leaf_shape_sheet: '12.Лист_форма_листочка',
  stem_pubescence_color_sheet: '14.Окраска_опушения_стебля',
  yield_per_area_sheet: '26.Урожайность_ед_площади',
  protein_content_sheet: '28.Содержание_белка',
  fat_content_sheet: '29.Содержание_жира',
  lower_pod_attachment_sheet: '18.Высота_нижнего_боба',
  productive_nodes_sheet: '19.Продуктивные_узлы',
  productive_pods_sheet: '21.Продуктивные_бобы',
  pods_per_node_sheet: '22.Бобов_на_прод_узел',
};

function getSafeSheetName(logicalKey, originalName, usedNames) {
  const preferred = SAFE_SHEET_NAME_OVERRIDES[logicalKey] || originalName;
  const normalized = preferred.slice(0, 31);
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

  throw new Error(`Could not build unique sheet name for ${logicalKey}`);
}

const workbookModel = templateService.createLocalWorkbookCopy();
for (const alias of Object.values(SHEET_ALIASES)) {
  if (!workbookModel[alias.local]) {
    workbookModel[alias.local] = [];
  }
}

const wb = XLSX.utils.book_new();
const usedNames = new Set();
const mapRows = [['logicalSheetKey', 'currentAppSheetName', 'xlsxSheetName']];

for (const [logicalKey, alias] of Object.entries(SHEET_ALIASES)) {
  const sourceName = alias.local;
  const rows = workbookModel[sourceName] || [];
  const safeName = getSafeSheetName(logicalKey, sourceName, usedNames);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  mapRows.push([logicalKey, sourceName, safeName]);
}

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mapRows), '00.sheet_map');

const outputPath = path.join(projectRoot, 'docs', 'sortoved_v2_full_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`created: ${outputPath}`);
console.log(`sheets: ${wb.SheetNames.length}`);
