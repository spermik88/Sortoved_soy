import { ScreenMappingRule, TaskFlowKind, TaskKind } from '../types/app';

export interface CreationStepDefinition {
  id: string;
  screenId: string;
  title: string;
  type: ScreenMappingRule['type'];
  description: string;
  plot?: '1' | '2' | '3';
  options?: string[];
  field: string;
  sheet: string;
  header?: string;
}

export interface TaskDefinition {
  code: string;
  title: string;
  screenId: string;
  sheetName: string;
  kind: TaskKind;
  flowKind: TaskFlowKind;
  intro: string;
  overviewHint?: string;
  cardsHint?: string;
  observationLabel?: string;
  valueLabel?: string;
  explicitlySpecified: boolean;
}

export const creationSteps: CreationStepDefinition[] = [
  {
    id: 'variety_name',
    screenId: 'screen_64e52250',
    title: 'Название сорта',
    type: 'text',
    description: 'Введите название сорта. Оно станет названием локальной записи сорта.',
    field: 'varietyName',
    sheet: 'делянки',
  },
  {
    id: 'dates',
    screenId: 'screen_73100733',
    title: 'Даты',
    type: 'date',
    description: 'Укажите дату создания делянки и дату посева. Если пропустить, будет использована сегодняшняя дата.',
    field: 'dates',
    sheet: 'делянки',
  },
  {
    id: 'location',
    screenId: 'screen_3c6fdf96',
    title: 'Местоположение',
    type: 'location',
    description: 'Сохраните координаты делянок и ссылку на Google Maps для всех трех делянок.',
    field: 'location',
    sheet: 'делянки',
  },
  {
    id: 'plot1_area',
    screenId: 'screen_951193b7',
    title: 'Делянка 1: площадь',
    type: 'confirm',
    description: 'Подтвердите площадь делянки 1.',
    plot: '1',
    field: 'areaConfirmed',
    sheet: 'делянки',
    header: 'площадь делянки',
  },
  {
    id: 'plot1_row_spacing',
    screenId: 'screen_8caf316b',
    title: 'Делянка 1: расстояние междурядья',
    type: 'choice',
    description: 'Выберите расстояние междурядья.',
    plot: '1',
    options: ['15 см', '45 см', '70 см'],
    field: 'rowSpacing',
    sheet: 'делянки',
    header: 'расстояние междурядья',
  },
  {
    id: 'plot1_row_count',
    screenId: 'screen_86d0a45c',
    title: 'Делянка 1: количество рядков',
    type: 'choice',
    description: 'Выберите количество рядков.',
    plot: '1',
    options: ['4 рядка', '8 рядков', '10 рядков'],
    field: 'rowCount',
    sheet: 'делянки',
    header: 'количество рядков',
  },
  {
    id: 'plot1_plant_spacing',
    screenId: 'screen_781b733c',
    title: 'Делянка 1: расстояние между растениями',
    type: 'confirm',
    description: 'Подтвердите, что расстояние между растениями 8-10 см.',
    plot: '1',
    field: 'plantSpacingConfirmed',
    sheet: 'делянки',
    header: 'расстояние между растениями',
  },
  {
    id: 'plot1_photo',
    screenId: 'screen_0efa24b2',
    title: 'Делянка 1: фото',
    type: 'photo',
    description: 'Сделайте первое фото делянки 1.',
    plot: '1',
    field: 'photoUri',
    sheet: 'делянки',
    header: 'первое фото делянки',
  },
  {
    id: 'plot2_area',
    screenId: 'screen_580db949',
    title: 'Делянка 2: площадь',
    type: 'confirm',
    description: 'Подтвердите площадь делянки 2.',
    plot: '2',
    field: 'areaConfirmed',
    sheet: 'делянки',
    header: 'площадь делянки',
  },
  {
    id: 'plot2_row_spacing',
    screenId: 'screen_b4b9b986',
    title: 'Делянка 2: расстояние междурядья',
    type: 'choice',
    description: 'Выберите расстояние междурядья для делянки 2.',
    plot: '2',
    options: ['15 см', '45 см', '70 см'],
    field: 'rowSpacing',
    sheet: 'делянки',
    header: 'расстояние междурядья',
  },
  {
    id: 'plot2_row_count',
    screenId: 'screen_b9367a28',
    title: 'Делянка 2: количество рядков',
    type: 'choice',
    description: 'Выберите количество рядков для делянки 2.',
    plot: '2',
    options: ['4 рядка', '8 рядков', '10 рядков'],
    field: 'rowCount',
    sheet: 'делянки',
    header: 'количество рядков',
  },
  {
    id: 'plot2_plant_spacing',
    screenId: 'screen_08c5ed90',
    title: 'Делянка 2: расстояние между растениями',
    type: 'confirm',
    description: 'Подтвердите расстояние между растениями для делянки 2.',
    plot: '2',
    field: 'plantSpacingConfirmed',
    sheet: 'делянки',
    header: 'расстояние между растениями',
  },
  {
    id: 'plot2_photo',
    screenId: 'screen_1f45d2c6',
    title: 'Делянка 2: фото',
    type: 'photo',
    description: 'Сделайте первое фото делянки 2.',
    plot: '2',
    field: 'photoUri',
    sheet: 'делянки',
    header: 'первое фото делянки',
  },
  {
    id: 'plot3_area',
    screenId: 'screen_d558d573',
    title: 'Делянка 3: площадь',
    type: 'confirm',
    description: 'Подтвердите площадь делянки 3.',
    plot: '3',
    field: 'areaConfirmed',
    sheet: 'делянки',
    header: 'площадь делянки',
  },
  {
    id: 'plot3_row_spacing',
    screenId: 'screen_460e671b',
    title: 'Делянка 3: расстояние междурядья',
    type: 'choice',
    description: 'Выберите расстояние междурядья для делянки 3.',
    plot: '3',
    options: ['15 см', '45 см', '70 см'],
    field: 'rowSpacing',
    sheet: 'делянки',
    header: 'расстояние междурядья',
  },
  {
    id: 'plot3_row_count',
    screenId: 'screen_0e24676f',
    title: 'Делянка 3: количество рядков',
    type: 'choice',
    description: 'Выберите количество рядков для делянки 3.',
    plot: '3',
    options: ['4 рядка', '8 рядков', '10 рядков'],
    field: 'rowCount',
    sheet: 'делянки',
    header: 'количество рядков',
  },
  {
    id: 'plot3_plant_spacing',
    screenId: 'screen_5eeb03fb',
    title: 'Делянка 3: расстояние между растениями',
    type: 'confirm',
    description: 'Подтвердите расстояние между растениями для делянки 3.',
    plot: '3',
    field: 'plantSpacingConfirmed',
    sheet: 'делянки',
    header: 'расстояние между растениями',
  },
  {
    id: 'plot3_photo',
    screenId: 'screen_75b2fe72',
    title: 'Делянка 3: фото',
    type: 'photo',
    description: 'Сделайте первое фото делянки 3.',
    plot: '3',
    field: 'photoUri',
    sheet: 'делянки',
    header: 'первое фото делянки',
  },
];

function task(
  code: string,
  title: string,
  screenId: string,
  sheetName: string,
  kind: TaskKind,
  flowKind: TaskFlowKind,
  intro: string,
  explicitlySpecified: boolean,
  extra?: Pick<TaskDefinition, 'overviewHint' | 'cardsHint' | 'observationLabel' | 'valueLabel'>,
): TaskDefinition {
  return {
    code,
    title,
    screenId,
    sheetName,
    kind,
    flowKind,
    intro,
    explicitlySpecified,
    ...extra,
  };
}

export const taskDefinitions: TaskDefinition[] = [
  task(
    '1',
    'Фузариоз',
    'screen_ee28f40a',
    '1.Фузариоз',
    'infection',
    'infection_split',
    'Сначала снимите обзор делянки, затем добавьте карточки зараженных растений.',
    true,
    {
      overviewHint:
        'Перед осмотром растений сфотографируйте текущее состояние делянки, на которой вы будете делать осмотр.',
      cardsHint:
        'Тщательно осмотрите каждое растение на делянке, добавьте карточки заражений и укажите положение растения.',
      observationLabel: 'Описание заражения',
    },
  ),
  task('2', 'Септориоз', 'screen_632cd366', '2.Септориоз', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('3', 'Повреждение блошкой', 'screen_19db306a', '3.Повреждение блошкой', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('4', 'Начало цветения', 'screen_63353f12', '4.Начало цветения', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('5', 'Полное цветение', 'screen_67aec0ea', '5.Полное цветение', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('6', 'Бактериоз', 'screen_46b45849', '6.Бактериоз', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('7', 'Пероноспороз', 'screen_846d4d30', '7.Пероноспороз', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('8', 'Церкоспороз', 'screen_a3087365', '8.Церкоспороз', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('9', 'Повреждение тлей', 'screen_d55cfdda', '9.Повреждение тлей', 'infection', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('10', 'Цветок: окраска', 'screen_774494b0', '10.Цветок окраска', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('11', 'Конец цветения', 'screen_705e57e3', '11.Конец цветения', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('12', 'Лист: форма бокового листочка', 'screen_051e965f', '12.Лист форма бокового листочка', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('13', 'Полное созревание', 'screen_3ca89211', '13.Полное созревание', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('14', 'Растение: окраска опушения главного стебля', 'screen_ae5f827b', '14.Растение окраска опушения гл', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('15', 'Устойчивость к полеганию', 'screen_14689efc', '15.Устойчивость к полеганию', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('16', 'Устойчивость к осыпанию', 'screen_d118e3c9', '16.Устойчивость к осыпанию', 'observation', 'placeholder_pending_spec', 'Для этого признака пока нет явной структуры экрана в JSON.', false),
  task('17', 'Длина стебля', 'screen_dd7351b2', '17.Длина стебля', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений длины стебля по растениям.', false, { valueLabel: 'Длина стебля, см' }),
  task('18', 'Высота прикрепления нижнего боба', 'screen_d6898e2e', '18.Высота прикрепления нижнего ', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Высота, см' }),
  task('19', 'Количество продуктивных узлов на главном стебле', 'screen_20cf2da6', '19.Количество продуктивных узло', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество узлов' }),
  task('20', 'Количество ветвей', 'screen_7b7bc1ec', '20.Количество ветвей', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество ветвей' }),
  task('21', 'Количество продуктивных бобов', 'screen_88f856ba', '21.Количество продуктивных бобо', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество бобов' }),
  task('22', 'Количество бобов на продуктивный узел', 'screen_04fe9e12', '22.Количество бобов на продукти', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество бобов' }),
  task('23', 'Количество семян с растения', 'screen_d37e56e7', '23.Количество семян с растения', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество семян' }),
  task('24', 'Количество семян в бобе', 'screen_2addcc5e', '24Количество семян в бобе', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Количество семян' }),
  task('25', 'Масса семян с растения', 'screen_3d8873a9', '25.Масса семян с растения', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Масса, г' }),
  task('26', 'Урожайность с единицы площади', 'screen_d36d4541', '26.Урожайность с единицы площад', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Урожайность' }),
  task('27', 'Масса 1000 семян', 'screen_1a5ef412', '27.Масса 1000 семян', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Масса, г' }),
  task('28', 'Содержание белка', 'screen_f27a2c47', '28.Содержание белка', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Содержание, %' }),
  task('29', 'Содержание жира', 'screen_c147d338', '29.Содержание жира', 'measurement', 'measurement_cards', 'Добавляйте карточки измерений по растениям.', false, { valueLabel: 'Содержание, %' }),
];

export const taskDefinitionsByCode = Object.fromEntries(
  taskDefinitions.map((item) => [item.code, item]),
) as Record<string, TaskDefinition>;

export const screenRules: ScreenMappingRule[] = creationSteps.map((step) => ({
  screenId: step.screenId,
  title: step.title,
  type: step.type,
  sheet: step.sheet,
  field: step.field,
  plot: step.plot,
}));
