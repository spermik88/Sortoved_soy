import { LocalSheetKey } from '../types/app';

export const PLOTS_SHEET_NAME = 'делянки';
export const META_SHEET_NAME = '00.meta';
export const TEMPLATE_VERSION = '2026-04-24-drive-photo-v1';

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

const PHENOLOGY_BLOCK_HEADER_ROW = [
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
] as const;

const CHOICE_BLOCK_HEADER_ROW = [
  'значение делянка 1',
  'фото делянка 1',
  'мета делянка 1',
  '',
  'значение делянка 2',
  'фото делянка 2',
  'мета делянка 2',
  '',
  'значение делянка 3',
  'фото делянка 3',
  'мета делянка 3',
] as const;

const SCORE_BLOCK_HEADER_ROW = [
  'оценка делянка 1',
  'фото делянка 1',
  'мета делянка 1',
  '',
  'оценка делянка 2',
  'фото делянка 2',
  'мета делянка 2',
  '',
  'оценка делянка 3',
  'фото делянка 3',
  'мета делянка 3',
] as const;

const YIELD_BLOCK_HEADER_ROW = [
  'масса сырого зерна делянка 1',
  'влажность делянка 1',
  'площадь делянка 1',
  'урожайность делянка 1',
  'мета делянка 1',
  '',
  'масса сырого зерна делянка 2',
  'влажность делянка 2',
  'площадь делянка 2',
  'урожайность делянка 2',
  'мета делянка 2',
  '',
  'масса сырого зерна делянка 3',
  'влажность делянка 3',
  'площадь делянка 3',
  'урожайность делянка 3',
  'мета делянка 3',
] as const;

const THOUSAND_SEED_WEIGHT_HEADER_ROW = [
  'источник пробы',
  'масса пробы 1, г',
  'масса пробы 2, г',
  'масса пробы 3, г',
  'выбранная пара',
  'суммарная масса пары, г',
  'фактическое расхождение, г',
  'допустимое расхождение, г',
  'масса 1000 семян, г',
  'статус анализа',
  'мета',
] as const;

const STRUCTURE_HEADER_ROW = [
  'выборка',
  'делянка',
  'номер растения',
  'значение',
  'фото',
  'мета',
] as const;

function createDiseaseSheetTemplate() {
  return [
    [1, '', '', '', '', 2, '', '', '', '', 3, '', '', '', ''],
    [...DISEASE_BLOCK_HEADER_ROW],
  ] as (string | number)[][];
}

function createPhenologySheetTemplate(title: string) {
  return [[title, '', '', '', '', '', '', '', '', '', ''], [...PHENOLOGY_BLOCK_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

function createChoiceSheetTemplate(title: string) {
  return [[title, '', '', '', '', '', '', '', '', '', ''], [...CHOICE_BLOCK_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

function createScoreSheetTemplate(title: string) {
  return [[title, '', '', '', '', '', '', '', '', '', ''], [...SCORE_BLOCK_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

function createYieldSheetTemplate(title: string) {
  return [[title, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], [...YIELD_BLOCK_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

function createThousandSeedWeightSheetTemplate(title: string) {
  return [[title, '', '', '', '', '', '', '', '', '', ''], [...THOUSAND_SEED_WEIGHT_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

function createLabContentSheetTemplate(title: string, contentLabel: string) {
  return [
    [title, '', '', '', '', ''],
    ['источник пробы', 'масса навески, г', 'метод анализа', contentLabel, 'статус навески', 'мета'],
  ] as (string | number)[][];
}

function createStructureSheetTemplate(title: string) {
  return [[title, '', '', '', '', ''], [...STRUCTURE_HEADER_ROW]] as (
    | string
    | number
  )[][];
}

export const SHEET_ALIASES: Record<LocalSheetKey, { local: string; futureRemote: string }> = {
  fusarium_sheet: { local: '1.Фузариоз', futureRemote: '1.Фузариоз' },
  septoria_sheet: { local: '2.Септориоз', futureRemote: '2.Септориоз' },
  flea_sheet: { local: '3.Повреждение блошкой', futureRemote: '3.Повреждение блошкой' },
  start_flowering_sheet: { local: '4.Начало цветения', futureRemote: '4.Начало цветения' },
  full_flowering_sheet: { local: '5.Полное цветение', futureRemote: '5.Полное цветение' },
  bacteriosis_sheet: { local: '6.Бактериоз', futureRemote: '6.Бактериоз' },
  peronosporosis_sheet: { local: '7.Пероноспороз', futureRemote: '7.Пероноспороз' },
  cercosporosis_sheet: { local: '8.Церкоспороз', futureRemote: '8.Церкоспороз' },
  aphid_damage_sheet: { local: '9.Повреждение тлей', futureRemote: '9.Повреждение тлей' },
  flower_color_sheet: { local: '10.Цветок: окраска', futureRemote: '10.Цветок: окраска' },
  end_flowering_sheet: { local: '11.Конец цветения', futureRemote: '11.Конец цветения' },
  leaf_shape_sheet: {
    local: '12.Лист: форма бокового листочка',
    futureRemote: '12.Лист: форма бокового листочка',
  },
  full_maturity_sheet: { local: '13.Полное созревание', futureRemote: '13.Полное созревание' },
  stem_pubescence_color_sheet: {
    local: '14.Растение: окраска опушения главного стебля',
    futureRemote: '14.Растение: окраска опушения главного стебля',
  },
  lodging_resistance_sheet: {
    local: '15.Устойчивость к полеганию',
    futureRemote: '15.Устойчивость к полеганию',
  },
  shattering_resistance_sheet: {
    local: '16.Устойчивость к осыпанию',
    futureRemote: '16.Устойчивость к осыпанию',
  },
  stem_length_sheet: { local: '17.Длина стебля', futureRemote: '17.Длина стебля' },
  lower_pod_attachment_sheet: {
    local: '18.Высота прикрепления нижнего боба',
    futureRemote: '18.Высота прикрепления нижнего боба',
  },
  productive_nodes_sheet: {
    local: '19.Количество продуктивных узлов на главном стебле',
    futureRemote: '19.Количество продуктивных узлов на главном стебле',
  },
  branch_count_sheet: { local: '20.Количество ветвей', futureRemote: '20.Количество ветвей' },
  productive_pods_sheet: {
    local: '21.Количество продуктивных бобов',
    futureRemote: '21.Количество продуктивных бобов',
  },
  pods_per_node_sheet: {
    local: '22.Количество бобов на продуктивный узел',
    futureRemote: '22.Количество бобов на продуктивный узел',
  },
  seeds_per_plant_sheet: {
    local: '23.Количество семян с растения',
    futureRemote: '23.Количество семян с растения',
  },
  seeds_per_pod_sheet: {
    local: '24.Количество семян в бобе',
    futureRemote: '24.Количество семян в бобе',
  },
  seed_weight_per_plant_sheet: {
    local: '25.Масса семян с растения',
    futureRemote: '25.Масса семян с растения',
  },
  yield_per_area_sheet: {
    local: '26.Урожайность с единицы площади',
    futureRemote: '26.Урожайность с единицы площади',
  },
  thousand_seed_weight_sheet: {
    local: '27.Масса 1000 семян',
    futureRemote: '27.Масса 1000 семян',
  },
  protein_content_sheet: { local: '28.Содержание белка', futureRemote: '28.Содержание белка' },
  fat_content_sheet: { local: '29.Содержание жира', futureRemote: '29.Содержание жира' },
};

export const TEMPLATE_SHEETS: Record<string, (string | number)[][]> = {
  [META_SHEET_NAME]: [
    ['key', 'value'],
    ['templateVersion', TEMPLATE_VERSION],
    ['creatorEmail', ''],
    ['rootFolderId', ''],
    ['rootFolderUrl', ''],
    ['varietyFolderId', ''],
    ['varietyFolderUrl', ''],
    [],
    ['sheetName', 'folderId', 'folderUrl'],
  ],
  [PLOTS_SHEET_NAME]: [
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
  [SHEET_ALIASES.start_flowering_sheet.local]: createPhenologySheetTemplate('4. Начало цветения'),
  [SHEET_ALIASES.full_flowering_sheet.local]: createPhenologySheetTemplate('5. Полное цветение'),
  [SHEET_ALIASES.bacteriosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.peronosporosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.cercosporosis_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.aphid_damage_sheet.local]: createDiseaseSheetTemplate(),
  [SHEET_ALIASES.flower_color_sheet.local]: createChoiceSheetTemplate('10. Цветок: окраска'),
  [SHEET_ALIASES.end_flowering_sheet.local]: createPhenologySheetTemplate('11. Конец цветения'),
  [SHEET_ALIASES.leaf_shape_sheet.local]: createChoiceSheetTemplate('12. Лист: форма бокового листочка'),
  [SHEET_ALIASES.full_maturity_sheet.local]: createPhenologySheetTemplate('13. Полное созревание'),
  [SHEET_ALIASES.stem_pubescence_color_sheet.local]: createChoiceSheetTemplate(
    '14. Растение: окраска опушения главного стебля',
  ),
  [SHEET_ALIASES.lodging_resistance_sheet.local]: createScoreSheetTemplate('15. Устойчивость к полеганию'),
  [SHEET_ALIASES.shattering_resistance_sheet.local]: createScoreSheetTemplate('16. Устойчивость к осыпанию'),
  [SHEET_ALIASES.stem_length_sheet.local]: createStructureSheetTemplate('17. Длина стебля'),
  [SHEET_ALIASES.lower_pod_attachment_sheet.local]: createStructureSheetTemplate(
    '18. Высота прикрепления нижнего боба',
  ),
  [SHEET_ALIASES.productive_nodes_sheet.local]: createStructureSheetTemplate(
    '19. Количество продуктивных узлов на главном стебле',
  ),
  [SHEET_ALIASES.branch_count_sheet.local]: createStructureSheetTemplate('20. Количество ветвей'),
  [SHEET_ALIASES.productive_pods_sheet.local]: createStructureSheetTemplate(
    '21. Количество продуктивных бобов',
  ),
  [SHEET_ALIASES.pods_per_node_sheet.local]: createStructureSheetTemplate(
    '22. Количество бобов на продуктивный узел',
  ),
  [SHEET_ALIASES.seeds_per_plant_sheet.local]: createStructureSheetTemplate(
    '23. Количество семян с растения',
  ),
  [SHEET_ALIASES.seeds_per_pod_sheet.local]: createStructureSheetTemplate('24. Количество семян в бобе'),
  [SHEET_ALIASES.seed_weight_per_plant_sheet.local]: createStructureSheetTemplate(
    '25. Масса семян с растения',
  ),
  [SHEET_ALIASES.yield_per_area_sheet.local]: createYieldSheetTemplate('26. Урожайность с единицы площади'),
  [SHEET_ALIASES.thousand_seed_weight_sheet.local]: createThousandSeedWeightSheetTemplate('27. Масса 1000 семян'),
  [SHEET_ALIASES.protein_content_sheet.local]: createLabContentSheetTemplate(
    '28. Содержание белка',
    'содержание белка, %',
  ),
  [SHEET_ALIASES.fat_content_sheet.local]: createLabContentSheetTemplate(
    '29. Содержание жира',
    'содержание жира, %',
  ),
};

export const TEMPLATE_WORKSHEET_NAMES = [
  META_SHEET_NAME,
  PLOTS_SHEET_NAME,
  ...Object.values(SHEET_ALIASES).map((entry) => entry.futureRemote),
];

export const PHOTO_FOLDER_SHEET_NAMES = [
  PLOTS_SHEET_NAME,
  ...Object.values(SHEET_ALIASES).map((entry) => entry.futureRemote),
];

export const GENERIC_TRAIT_HEADERS = [['значение', 'фото', 'мета', 'делянка']];
export const EMPTY_TRAIT_SHEETS: string[] = [];
