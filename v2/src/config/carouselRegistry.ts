import { ImageSourcePropType } from 'react-native';

export interface CarouselRegistryEntry {
  taskCode: string;
  assetGroupKey: string;
  available: boolean;
  imageSources: ImageSourcePropType[];
}

export const carouselRegistry: Record<string, CarouselRegistryEntry> = {
  '1': { taskCode: '1', assetGroupKey: 'fusarium', available: true, imageSources: [require('../../../assets/carousels/fusarium/18.Фузариоз семядолей.png')] },
  '2': { taskCode: '2', assetGroupKey: 'septoria', available: true, imageSources: [require('../../../assets/carousels/septoria/20.Септориоз.png')] },
  '3': { taskCode: '3', assetGroupKey: 'bacteriosis', available: true, imageSources: [require('../../../assets/carousels/bacteriosis/19.Бактериоз.png')] },
  '4': { taskCode: '4', assetGroupKey: 'flowering_start', available: true, imageSources: [require('../../../assets/carousels/flowering_start/1.начало цветения.jpg')] },
  '5': { taskCode: '5', assetGroupKey: 'flowering_full', available: true, imageSources: [require('../../../assets/carousels/flowering_full/2.полное цветение.jpg')] },
  '6': { taskCode: '6', assetGroupKey: 'downy_mildew', available: true, imageSources: [require('../../../assets/carousels/downy_mildew/21.Пероноспороз.png')] },
  '7': { taskCode: '7', assetGroupKey: 'cercospora', available: true, imageSources: [require('../../../assets/carousels/cercospora/22-cercospora.jfif')] },
  '8': { taskCode: '8', assetGroupKey: 'flea_damage', available: true, imageSources: [require('../../../assets/carousels/flea_damage/23.Повреждение соевой полосатой блошкой.png')] },
  '9': { taskCode: '9', assetGroupKey: 'aphid_damage', available: true, imageSources: [require('../../../assets/carousels/aphid_damage/24.Повреждение тлей.png')] },
  '10': { taskCode: '10', assetGroupKey: 'flower_color', available: true, imageSources: [require('../../../assets/carousels/flower_color/27.Окраска цветка.png')] },
  '11': { taskCode: '11', assetGroupKey: 'flowering_end', available: true, imageSources: [require('../../../assets/carousels/flowering_end/3.конец цветения.jpg')] },
  '12': { taskCode: '12', assetGroupKey: 'lateral_leaf_shape', available: true, imageSources: [require('../../../assets/carousels/lateral_leaf_shape/26.Форма бокового листочка.png')] },
  '13': { taskCode: '13', assetGroupKey: 'full_maturity', available: true, imageSources: [require('../../../assets/carousels/full_maturity/4.полное созревание.jpg')] },
  '14': { taskCode: '14', assetGroupKey: 'stem_pubescence_color', available: true, imageSources: [require('../../../assets/carousels/stem_pubescence_color/25.Окраска опушения главного стебля.png')] },
  '15': { taskCode: '15', assetGroupKey: 'lodging_resistance', available: true, imageSources: [require('../../../assets/carousels/lodging_resistance/28-lodging-resistance.jfif')] },
  '16': { taskCode: '16', assetGroupKey: 'shattering_resistance', available: true, imageSources: [require('../../../assets/carousels/shattering_resistance/29-shattering-resistance.jfif')] },
  '17': {
    taskCode: '17',
    assetGroupKey: 'stem_length',
    available: true,
    imageSources: [
      require('../../../assets/carousels/stem_length/step-2/6.длина стебля.png'),
      require('../../../assets/carousels/stem_length/step-4/6.длина стебля.png'),
    ],
  },
  '18': {
    taskCode: '18',
    assetGroupKey: 'lower_pod_attachment_height',
    available: true,
    imageSources: [
      require('../../../assets/carousels/lower_pod_attachment_height/step-2/7.расстояние до нижнего боба.png'),
      require('../../../assets/carousels/lower_pod_attachment_height/step-4/7.расстояние до нижнего боба.png'),
    ],
  },
  '19': {
    taskCode: '19',
    assetGroupKey: 'productive_nodes_count',
    available: true,
    imageSources: [
      require('../../../assets/carousels/productive_nodes_count/step-2/8.количество продуктивных узлов.png'),
      require('../../../assets/carousels/productive_nodes_count/step-4/8.количество продуктивных узлов.png'),
    ],
  },
  '20': {
    taskCode: '20',
    assetGroupKey: 'branch_count',
    available: true,
    imageSources: [
      require('../../../assets/carousels/branch_count/step-2/9.количество ветвей.png'),
      require('../../../assets/carousels/branch_count/step-4/9.количество ветвей.png'),
    ],
  },
  '21': {
    taskCode: '21',
    assetGroupKey: 'productive_pods_count',
    available: true,
    imageSources: [
      require('../../../assets/carousels/productive_pods_count/step-2/10.Количество продуктивных бобов.png'),
      require('../../../assets/carousels/productive_pods_count/step-4/10.Количество продуктивных бобов.png'),
    ],
  },
  '22': {
    taskCode: '22',
    assetGroupKey: 'pods_per_productive_node',
    available: true,
    imageSources: [
      require('../../../assets/carousels/pods_per_productive_node/step-2/11.Количество бобов на продуктивный узел.png'),
      require('../../../assets/carousels/pods_per_productive_node/step-4/11.Количество бобов на продуктивный узел.png'),
    ],
  },
  '23': {
    taskCode: '23',
    assetGroupKey: 'seeds_per_plant',
    available: true,
    imageSources: [
      require('../../../assets/carousels/seeds_per_plant/step-2/12.Количество семян с растения.png'),
      require('../../../assets/carousels/seeds_per_plant/step-4/12.Количество семян с растения.png'),
    ],
  },
  '24': {
    taskCode: '24',
    assetGroupKey: 'seeds_per_pod',
    available: true,
    imageSources: [
      require('../../../assets/carousels/seeds_per_pod/step-2/13.количество семян в бобе.png'),
      require('../../../assets/carousels/seeds_per_pod/step-4/13.количество семян в бобе.png'),
    ],
  },
  '25': {
    taskCode: '25',
    assetGroupKey: 'seed_weight_per_plant',
    available: true,
    imageSources: [
      require('../../../assets/carousels/seed_weight_per_plant/step-2/14.масса семян с растения.png'),
      require('../../../assets/carousels/seed_weight_per_plant/step-4/14.масса семян с растения.png'),
    ],
  },
  '26': { taskCode: '26', assetGroupKey: 'yield_per_area', available: false, imageSources: [] },
  '27': { taskCode: '27', assetGroupKey: 'thousand_seed_weight', available: true, imageSources: [require('../../../assets/carousels/thousand_seed_weight/15.Масса 1000 семян.png')] },
  '28': { taskCode: '28', assetGroupKey: 'protein_content', available: true, imageSources: [require('../../../assets/carousels/protein_content/16-protein-content.jfif')] },
  '29': { taskCode: '29', assetGroupKey: 'oil_content', available: true, imageSources: [require('../../../assets/carousels/oil_content/17-oil-content.jfif')] },
};
