import { TraitCode } from '../types/app';

export interface MeasurementCarouselConfig {
  folder: string;
  placeholderCount: number;
}

type StepKey = 'step-2' | 'step-4';

const measurementTraits: TraitCode[] = [
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

const configs = measurementTraits.reduce<Record<TraitCode, Record<StepKey, MeasurementCarouselConfig>>>(
  (acc, traitCode) => ({
    ...acc,
    [traitCode]: {
      'step-2': {
        folder: `assets/carousels/${traitCode}/step-2`,
        placeholderCount: 3,
      },
      'step-4': {
        folder: `assets/carousels/${traitCode}/step-4`,
        placeholderCount: 3,
      },
    },
  }),
  {} as Record<TraitCode, Record<StepKey, MeasurementCarouselConfig>>,
);

export function getMeasurementCarouselConfig(
  traitCode: TraitCode,
  step: 2 | 4,
): MeasurementCarouselConfig {
  return configs[traitCode][step === 2 ? 'step-2' : 'step-4'];
}
