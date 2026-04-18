import { TraitCode } from '../types/app';

export interface TraitDefinition {
  code: TraitCode;
  order: number;
  title: string;
  shortTitle: string;
  sampleTitle: string;
  inspectionDescription: string;
  isEnabled: boolean;
  flowCopyKey?:
    | 'default'
    | 'flowering_start'
    | 'flowering_full'
    | 'flower_color'
    | 'flowering_end'
    | 'lateral_leaf_shape'
    | 'full_maturity'
    | 'stem_pubescence_color'
    | 'lodging_resistance'
    | 'shattering_resistance';
}

export const ENABLED_TRAIT_CODES: TraitCode[] = [
  'fusarium',
  'septoria',
  'flea_damage',
  'flowering_start',
  'flowering_full',
  'bacteriosis',
  'downy_mildew',
  'cercospora',
  'aphid_damage',
  'flower_color',
  'flowering_end',
  'lateral_leaf_shape',
  'full_maturity',
  'stem_pubescence_color',
  'lodging_resistance',
  'shattering_resistance',
];

export const TRAITS: TraitDefinition[] = [
  {
    code: 'fusarium',
    order: 1,
    title: '1. Фузариоз',
    shortTitle: 'Фузариоз',
    sampleTitle: 'Примеры заражения фузариозом',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на заражение фузариозом. Сделайте фотографию каждого найденного заболевшего растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'septoria',
    order: 2,
    title: '2. Септориоз',
    shortTitle: 'Септориоз',
    sampleTitle: 'Примеры заражения септориозом',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на заражение септориозом. Сделайте фотографию каждого найденного заболевшего растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'flea_damage',
    order: 3,
    title: '3. Повреждение блошкой',
    shortTitle: 'Повреждение блошкой',
    sampleTitle: 'Примеры повреждения растений блошкой',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на повреждение блошкой. Сделайте фотографию каждого найденного поврежденного растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'flowering_start',
    order: 4,
    title: '4. Начало цветения',
    shortTitle: 'Начало цветения',
    sampleTitle: 'Примеры начала цветения',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на начало цветения. Сделайте фотографию каждого найденного зацветшего растения и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'flowering_start',
  },
  {
    code: 'flowering_full',
    order: 5,
    title: '5. Полное цветение',
    shortTitle: 'Полное цветение',
    sampleTitle: 'Примеры полного цветения',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке в фазе полного цветения. Сделайте фотографию каждого найденного растения в полном цветении и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'flowering_full',
  },
  {
    code: 'bacteriosis',
    order: 6,
    title: '6. Бактериоз',
    shortTitle: 'Бактериоз',
    sampleTitle: 'Примеры заражения бактериозом',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на заражение бактериозом. Сделайте фотографию каждого найденного заболевшего растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'downy_mildew',
    order: 7,
    title: '7. Пероноспороз',
    shortTitle: 'Пероноспороз',
    sampleTitle: 'Примеры заражения пероноспорозом',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на заражение пероноспорозом. Сделайте фотографию каждого найденного заболевшего растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'cercospora',
    order: 8,
    title: '8. Церкоспороз',
    shortTitle: 'Церкоспороз',
    sampleTitle: 'Примеры заражения церкоспорозом',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на заражение церкоспорозом. Сделайте фотографию каждого найденного заболевшего растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'aphid_damage',
    order: 9,
    title: '9. Повреждение тлей',
    shortTitle: 'Повреждение тлей',
    sampleTitle: 'Примеры повреждения растений тлей',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на повреждение тлей. Сделайте фотографию каждого найденного поврежденного растения и укажите его положение.',
    isEnabled: true,
  },
  {
    code: 'flower_color',
    order: 10,
    title: '10. Цветок: окраска',
    shortTitle: 'Цветок: окраска',
    sampleTitle: 'Примеры окраски цветка',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке по признаку окраски цветка. Сделайте фотографию каждого найденного растения с окраской цветка и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'flower_color',
  },
  {
    code: 'flowering_end',
    order: 11,
    title: '11. Конец цветения',
    shortTitle: 'Конец цветения',
    sampleTitle: 'Примеры конца цветения',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на конец цветения. Сделайте фотографию каждого найденного растения с концом цветения и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'flowering_end',
  },
  {
    code: 'lateral_leaf_shape',
    order: 12,
    title: '12. Форма бокового листочка',
    shortTitle: 'Форма бокового листочка',
    sampleTitle: 'Примеры формы бокового листочка',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке по признаку формы бокового листочка. Сделайте фотографию каждого найденного растения с формой бокового листочка и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'lateral_leaf_shape',
  },
  {
    code: 'full_maturity',
    order: 13,
    title: '13. Полное созревание',
    shortTitle: 'Полное созревание',
    sampleTitle: 'Примеры полного созревания',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке на полное созревание. Сделайте фотографию каждого найденного растения с полным созреванием и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'full_maturity',
  },
  {
    code: 'stem_pubescence_color',
    order: 14,
    title: '14. Окраска опушения главного стебля',
    shortTitle: 'Окраска опушения главного стебля',
    sampleTitle: 'Примеры окраски опушения главного стебля',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке по признаку окраски опушения главного стебля. Сделайте фотографию каждого найденного растения с окраской опушения главного стебля и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'stem_pubescence_color',
  },
  {
    code: 'lodging_resistance',
    order: 15,
    title: '15. Устойчивость к полеганию',
    shortTitle: 'Устойчивость к полеганию',
    sampleTitle: 'Примеры полегания растений',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке по признаку полегания. Сделайте фотографию каждого найденного растения с полеганием и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'lodging_resistance',
  },
  {
    code: 'shattering_resistance',
    order: 16,
    title: '16. Устойчивость к осыпанию',
    shortTitle: 'Устойчивость к осыпанию',
    sampleTitle: 'Примеры осыпания растений',
    inspectionDescription:
      'Тщательно осмотрите каждое растение на делянке по признаку осыпания. Сделайте фотографию каждого найденного растения с осыпанием и укажите его положение.',
    isEnabled: true,
    flowCopyKey: 'shattering_resistance',
  },
];

export const DISABLED_TRAIT_LABELS = [
  '17. Длина стебля',
  '18. Высота прикрепления нижнего боба',
  '19. Количество продуктивных узлов на главном стебле',
  '20. Количество ветвей',
  '21. Количество продуктивных бобов',
  '22. Количество бобов на продуктивный узел',
  '23. Количество семян с растения',
  '24. Количество семян в бобе',
  '25. Масса семян с растения',
  '26. Урожайность с единицы площади',
  '27. Масса 1000 семян',
  '28. Содержание белка',
  '29. Содержание жира',
] as const;

export function getTraitDefinition(traitCode: TraitCode) {
  return TRAITS.find((trait) => trait.code === traitCode)!;
}

export function createEmptyTraitStatuses(): Record<TraitCode, 'not_started'> {
  return {
    fusarium: 'not_started',
    septoria: 'not_started',
    flea_damage: 'not_started',
    flowering_start: 'not_started',
    flowering_full: 'not_started',
    bacteriosis: 'not_started',
    downy_mildew: 'not_started',
    cercospora: 'not_started',
    aphid_damage: 'not_started',
    flower_color: 'not_started',
    flowering_end: 'not_started',
    lateral_leaf_shape: 'not_started',
    full_maturity: 'not_started',
    stem_pubescence_color: 'not_started',
    lodging_resistance: 'not_started',
    shattering_resistance: 'not_started',
  };
}
