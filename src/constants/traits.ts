import { TraitCode } from '../types/app';

export interface TraitDefinition {
  code: TraitCode;
  order: number;
  title: string;
  shortTitle: string;
  sampleTitle: string;
  inspectionDescription: string;
  isEnabled: boolean;
  flowCopyKey?: 'default' | 'flowering_start' | 'flowering_full';
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
];

export const DISABLED_TRAIT_LABELS = [
  '10. Цветок: окраска',
  '11. Конец цветения',
  '12. Форма бокового листочка',
  '13. Полное созревание',
  '14. Окраска опушения главного стебля',
  '15. Устойчивость к полеганию',
  '16. Устойчивость к осыпанию',
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
  };
}
