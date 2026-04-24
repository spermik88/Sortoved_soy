export interface CarouselRegistryEntry {
  taskCode: string;
  assetGroupKey: string;
  available: boolean;
  imageSources: string[];
}

export const carouselRegistry: Record<string, CarouselRegistryEntry> = {
  '10': {
    taskCode: '10',
    assetGroupKey: 'flower_color',
    available: false,
    imageSources: [],
  },
  '12': {
    taskCode: '12',
    assetGroupKey: 'lateral_leaf_shape',
    available: false,
    imageSources: [],
  },
  '14': {
    taskCode: '14',
    assetGroupKey: 'stem_pubescence_color',
    available: false,
    imageSources: [],
  },
  '15': {
    taskCode: '15',
    assetGroupKey: 'lodging_resistance',
    available: false,
    imageSources: [],
  },
  '16': {
    taskCode: '16',
    assetGroupKey: 'shattering_resistance',
    available: false,
    imageSources: [],
  },
  '17': {
    taskCode: '17',
    assetGroupKey: 'stem_length',
    available: false,
    imageSources: [],
  },
  '18': {
    taskCode: '18',
    assetGroupKey: 'lower_pod_attachment_height',
    available: false,
    imageSources: [],
  },
  '19': {
    taskCode: '19',
    assetGroupKey: 'productive_nodes_count',
    available: false,
    imageSources: [],
  },
  '20': {
    taskCode: '20',
    assetGroupKey: 'branch_count',
    available: false,
    imageSources: [],
  },
  '21': {
    taskCode: '21',
    assetGroupKey: 'productive_pods_count',
    available: false,
    imageSources: [],
  },
  '22': {
    taskCode: '22',
    assetGroupKey: 'pods_per_productive_node',
    available: false,
    imageSources: [],
  },
  '23': {
    taskCode: '23',
    assetGroupKey: 'seeds_per_plant',
    available: false,
    imageSources: [],
  },
  '24': {
    taskCode: '24',
    assetGroupKey: 'seeds_per_pod',
    available: false,
    imageSources: [],
  },
  '25': {
    taskCode: '25',
    assetGroupKey: 'seed_weight_per_plant',
    available: false,
    imageSources: [],
  },
  '26': {
    taskCode: '26',
    assetGroupKey: 'yield_per_area',
    available: false,
    imageSources: [],
  },
  '27': {
    taskCode: '27',
    assetGroupKey: 'thousand_seed_weight',
    available: false,
    imageSources: [],
  },
  '28': {
    taskCode: '28',
    assetGroupKey: 'protein_content',
    available: false,
    imageSources: [],
  },
  '29': {
    taskCode: '29',
    assetGroupKey: 'oil_content',
    available: false,
    imageSources: [],
  },
};
