const path = require('path');
const XLSX = require('xlsx');

const outPath = path.join(
  __dirname,
  'phenology_steps_4_5_11_13_proposal.xlsx',
);

const sheets = [
  {
    title: '4. Начало цветения',
    sheetName: '4.Начало цветения',
    criterion: 'Зацвело 10% растений на делянке',
  },
  {
    title: '5. Полное цветение',
    sheetName: '5.Полное цветение',
    criterion:
      'Зацвело не менее 50% растений в средней части центральных побегов',
  },
  {
    title: '11. Конец цветения',
    sheetName: '11.Конец цветения',
    criterion: 'Цветки на верхнем ярусе засыхают',
  },
  {
    title: '13. Полное созревание',
    sheetName: '13.Полное созревание',
    criterion: 'Созрело 50% бобов на делянке',
  },
];

function buildSheet(title, criterion) {
  const rows = [
    [title, '', '', '', '', '', '', '', '', '', ''],
    [
      'подтверждение делянка 1',
      'фото делянка 1',
      'мета делянка 1',
      '',
      'подтверждение делянка 2',
      'фото делянка 2',
      'мета делянка 2',
      '',
      'подтверждение делянка 3',
      'фото делянка 3',
      'мета делянка 3',
    ],
    [
      criterion,
      'photo_pending_upload',
      'HH:mm DD.MM.YYYY, email, https://maps.google.com/...',
      '',
      criterion,
      'photo_pending_upload',
      'HH:mm DD.MM.YYYY, email, https://maps.google.com/...',
      '',
      criterion,
      'photo_pending_upload',
      'HH:mm DD.MM.YYYY, email, https://maps.google.com/...',
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 52 },
    { wch: 4 },
    { wch: 28 },
    { wch: 22 },
    { wch: 52 },
    { wch: 4 },
    { wch: 28 },
    { wch: 22 },
    { wch: 52 },
  ];
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  return sheet;
}

const workbook = XLSX.utils.book_new();

for (const item of sheets) {
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(item.title, item.criterion),
    item.sheetName,
  );
}

XLSX.writeFile(workbook, outPath);
console.log(outPath);
