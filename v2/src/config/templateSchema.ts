import { DiseaseSheetKey } from '../types/app';

const DISEASE_BLOCK_HEADER_ROW = [
  'зараженные делянка 1',
  'фото делянка 1',
  'мета делянка 1',
  'зараженных на делянке 1',
  'итого, % заболевших делянка 1',
  'зараженные делянка 2',
  'фото делянка 2',
  'мета делянка 2',
  'зараженных на делянке 2',
  'итого, % заболевших делянка 2',
  'зараженные делянка 3',
  'фото делянка 3',
  'мета делянка 3',
  'зараженных на делянке 3',
  'итого, % заболевших делянка 3',
] as const;

function createDiseaseSheetTemplate() {
  return [
    [1, '', '', '', '', 2, '', '', '', '', 3, '', '', '', ''],
    [...DISEASE_BLOCK_HEADER_ROW],
  ] as (string | number)[][];
}

export const SHEET_ALIASES: Record<
  DiseaseSheetKey,
  {
    local: string;
    futureRemote: string;
  }
> = {
  fusarium_sheet: {
    local: 'Лист1',
    futureRemote: '1.фузариоз',
  },
  septoria_sheet: {
    local: '2.Септориоз',
    futureRemote: '2.Септориоз',
  },
  flea_sheet: {
    local: '3.Повреждение блошкой',
    futureRemote: '3.Повреждение блошкой',
  },
  bacteriosis_sheet: {
    local: '6.Бактериоз',
    futureRemote: '6.Бактериоз',
  },
  peronosporosis_sheet: {
    local: '7.Пероноспороз',
    futureRemote: '7.Пероноспороз',
  },
  cercosporosis_sheet: {
    local: '8.Церкоспороз',
    futureRemote: '8.Церкоспороз',
  },
  aphid_damage_sheet: {
    local: '9.Повреждение тлей',
    futureRemote: '9.Повреждение тлей',
  },
};

export const TEMPLATE_SHEETS: Record<string, (string | number)[][]> = {
  делянки: [
    [
      'делянки',
      'дата создания',
      'дата посева',
      'ширина',
      'долгота',
      'ссылка гугл.мэпс',
      'площадь делянки',
      'расстояние междурядья',
      'количество рядков',
      'расстояние между растениями',
      'первое фото делянки',
    ],
    ['делянка 1'],
    ['делянка 2'],
    ['делянка 3'],
  ],
  [SHEET_ALIASES.fusarium_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.septoria_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.flea_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.bacteriosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.peronosporosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.cercosporosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.aphid_damage_sheet.local]: createDiseaseSheetTemplate(),
};

export const GENERIC_TRAIT_HEADERS = [['значение', 'фото', 'мета', 'делянка']];

export const EMPTY_TRAIT_SHEETS = [
  '4.Начало цветения',
  '5.Полное цветение',
  '10.Цветок окраска',
  '11.Конец цветения',
  '12.Лист форма бокового листочка',
  '13.Полное созревание',
  '14.Растение окраска опушения главного стебля',
  '15.Устойчивость к полеганию',
  '16.Устойчивость к осыпанию',
  '17.Длина стебля',
  '18.Высота прикрепления нижнего боба',
  '19.Количество продуктивных узлов на главном стебле',
  '20.Количество ветвей',
  '21.Количество продуктивных бобов',
  '22.Количество бобов на продуктивный узел',
  '23.Количество семян с растения',
  '24.Количество семян в бобе',
  '25.Масса семян с растения',
  '26.Урожайность с единицы площади',
  '27.Масса 1000 семян',
  '28.Содержание белка',
  '29.Содержание жира',
];
