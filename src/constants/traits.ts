import { TraitCode } from '../types/app';

export type TraitFlowKind = 'legacy_plot_flow' | 'measurement_ab_flow';
export type MeasurementSubplotKey = 'A' | 'B';

export interface TraitDefinition {
  code: TraitCode;
  order: number;
  title: string;
  shortTitle: string;
  sampleTitle: string;
  inspectionDescription: string;
  isEnabled: boolean;
  flowKind: TraitFlowKind;
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
  measurementCopyKey?:
    | 'stem_length'
    | 'lower_pod_attachment_height'
    | 'productive_nodes_count'
    | 'branch_count'
    | 'productive_pods_count'
    | 'pods_per_productive_node'
    | 'seeds_per_plant'
    | 'seeds_per_pod'
    | 'seed_weight_per_plant';
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
  'stem_length',
  'lower_pod_attachment_height',
  'productive_nodes_count',
  'branch_count',
  'productive_pods_count',
  'pods_per_productive_node',
  'seeds_per_plant',
  'seeds_per_pod',
  'seed_weight_per_plant',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
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
    flowKind: 'legacy_plot_flow',
    flowCopyKey: 'shattering_resistance',
  },
  {
    code: 'stem_length',
    order: 17,
    title: '17. Длина стебля',
    shortTitle: 'Длина стебля',
    sampleTitle: 'Примеры измерения длины стебля',
    inspectionDescription:
      'Измерьте длину стебля каждого растения от корневой шейки до верхушки главного побега.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'stem_length',
  },
  {
    code: 'lower_pod_attachment_height',
    order: 18,
    title: '18. Высота прикрепления нижнего боба',
    shortTitle: 'Высота прикрепления нижнего боба',
    sampleTitle: 'Примеры измерения высоты прикрепления нижнего боба',
    inspectionDescription:
      'Измерьте высоту от корневой шейки до нижнего боба.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'lower_pod_attachment_height',
  },
  {
    code: 'productive_nodes_count',
    order: 19,
    title: '19. Количество продуктивных узлов на главном стебле',
    shortTitle: 'Количество продуктивных узлов',
    sampleTitle: 'Примеры подсчета продуктивных узлов',
    inspectionDescription:
      'Подсчитайте продуктивные узлы на главном стебле каждого растения, начиная с первого узла с тройчатосложным листом, отдельно могут считаться узлы на боковых ветвях.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'productive_nodes_count',
  },
  {
    code: 'branch_count',
    order: 20,
    title: '20. Количество ветвей',
    shortTitle: 'Количество ветвей',
    sampleTitle: 'Примеры подсчета ветвей',
    inspectionDescription:
      'Прямой подсчёт ветвей, отходящих от оси главного стебля.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'branch_count',
  },
  {
    code: 'productive_pods_count',
    order: 21,
    title: '21. Количество продуктивных бобов',
    shortTitle: 'Количество продуктивных бобов',
    sampleTitle: 'Примеры подсчета продуктивных бобов',
    inspectionDescription:
      'Считать все бобы на растении, содержащие хотя бы одно семя.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'productive_pods_count',
  },
  {
    code: 'pods_per_productive_node',
    order: 22,
    title: '22. Количество бобов на продуктивный узел',
    shortTitle: 'Бобов на продуктивный узел',
    sampleTitle: 'Примеры расчета бобов на продуктивный узел',
    inspectionDescription:
      'Считается делением общего количества бобов на количество узлов.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'pods_per_productive_node',
  },
  {
    code: 'seeds_per_plant',
    order: 23,
    title: '23. Количество семян с растения',
    shortTitle: 'Количество семян с растения',
    sampleTitle: 'Примеры подсчета семян с растения',
    inspectionDescription:
      'Прямой подсчёт общего количества семян на растении.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'seeds_per_plant',
  },
  {
    code: 'seeds_per_pod',
    order: 24,
    title: '24. Количество семян в бобе',
    shortTitle: 'Количество семян в бобе',
    sampleTitle: 'Примеры расчета количества семян в бобе',
    inspectionDescription:
      'Считается делением общего количества семян с растения на количество бобов.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'seeds_per_pod',
  },
  {
    code: 'seed_weight_per_plant',
    order: 25,
    title: '25. Масса семян с растения',
    shortTitle: 'Масса семян с растения',
    sampleTitle: 'Примеры измерения массы семян с растения',
    inspectionDescription:
      'Ручной обмолот, прямое взвешивание, граммы с точностью до 0,01 г.',
    isEnabled: true,
    flowKind: 'measurement_ab_flow',
    measurementCopyKey: 'seed_weight_per_plant',
  },
];

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
    stem_length: 'not_started',
    lower_pod_attachment_height: 'not_started',
    productive_nodes_count: 'not_started',
    branch_count: 'not_started',
    productive_pods_count: 'not_started',
    pods_per_productive_node: 'not_started',
    seeds_per_plant: 'not_started',
    seeds_per_pod: 'not_started',
    seed_weight_per_plant: 'not_started',
  };
}
