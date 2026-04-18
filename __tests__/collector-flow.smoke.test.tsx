import React from 'react';
import { render } from '@testing-library/react-native';

import {
  MeasurementTraitFlowScreen,
} from '../src/screens/MeasurementTraitScreens';
import { MainMenuScreen } from '../src/screens/OnboardingScreens';
import { RoleSelectionScreen } from '../src/screens/RoleSelectionScreen';
import {
  TraitInfectionsScreen,
  TraitReviewScreen,
} from '../src/screens/TraitScreens';
import { VarietyDetailScreen } from '../src/screens/VarietyScreens';

const mockApp = {
  selectRole: jest.fn(),
  state: {
    collectorMode: 'test',
    activeRole: 'collector',
    varieties: [
      {
        id: 'v1',
        title: 'Соя 3',
        sheetUrl: 'https://example.com',
        sourceMode: 'test',
        plotPhotos: [],
        traitStatuses: {
          fusarium: 'completed',
          septoria: 'completed',
          flea_damage: 'completed',
          flowering_start: 'completed',
          flowering_full: 'completed',
          bacteriosis: 'completed',
          downy_mildew: 'completed',
          cercospora: 'completed',
          aphid_damage: 'in_progress',
          flower_color: 'completed',
          flowering_end: 'completed',
          lateral_leaf_shape: 'completed',
          full_maturity: 'completed',
          stem_pubescence_color: 'completed',
          lodging_resistance: 'completed',
          shattering_resistance: 'completed',
          stem_length: 'not_started',
          lower_pod_attachment_height: 'not_started',
          productive_nodes_count: 'not_started',
          branch_count: 'not_started',
          productive_pods_count: 'not_started',
          pods_per_productive_node: 'not_started',
          seeds_per_plant: 'not_started',
          seeds_per_pod: 'not_started',
          seed_weight_per_plant: 'not_started',
        },
      },
    ],
  },
  getNextTraitPlot: () => 2,
  getCompletedPlotsCount: () => 1,
  getLatestVarietySyncStatus: () => 'queued',
  getAggregateTraitState: () => 'in_progress',
  getTraitCheckboxState: (traitCode: string) =>
    traitCode === 'aphid_damage' ? 'completed_pending_sync' : 'fully_synced',
  getTraitPlotDraft: (): any => ({
    plotIndex: 1,
    overviewPhoto: 'file:///plot.jpg',
    infections: [],
    syncStatus: 'idle' as const,
  }),
  getMeasurementTraitDraft: () => ({
    currentStep: 1 as const,
    subplotA: {
      key: 'A' as const,
      photoConfirmed: false,
      plantCount: '',
      measurements: [],
    },
    subplotB: {
      key: 'B' as const,
      photoConfirmed: false,
      plantCount: '',
      measurements: [],
    },
  }),
  addInfectionCard: jest.fn(),
  removeInfectionCard: jest.fn(),
  updateInfectionCard: jest.fn(),
  confirmTraitPlot: jest.fn(),
  saveOverviewPhoto: jest.fn(),
  saveMeasurementSubplotPhoto: jest.fn(),
  confirmMeasurementSubplotPhoto: jest.fn(),
  setMeasurementSubplotPlantCount: jest.fn(),
  addMeasurementCard: jest.fn(),
  updateMeasurementCard: jest.fn(),
  completeMeasurementCard: jest.fn(),
  toggleMeasurementCardCollapsed: jest.fn(),
  setMeasurementCurrentStep: jest.fn(),
  completeMeasurementTrait: jest.fn(),
};

jest.mock('../src/context/AppContext', () => ({
  useApp: () => mockApp,
}));

describe('collector flow smoke', () => {
  beforeEach(() => {
    mockApp.getTraitPlotDraft = (): any => ({
      plotIndex: 1,
      overviewPhoto: 'file:///plot.jpg',
      infections: [],
      syncStatus: 'idle' as const,
    });
  });

  it('renders role selection', () => {
    const screen = render(
      <RoleSelectionScreen navigation={{ replace: jest.fn() } as never} route={{} as never} />,
    );

    expect(screen.getByText('Выберите тип аккаунта')).toBeTruthy();
    expect(screen.getByText('Сборщик данных')).toBeTruthy();
  });

  it('renders main menu in test mode', () => {
    const screen = render(
      <MainMenuScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />,
    );

    expect(screen.getByText('Главное меню')).toBeTruthy();
    expect(screen.getByText('Тестовый режим')).toBeTruthy();
  });

  it('renders variety detail including measurement traits', () => {
    const screen = render(
      <VarietyDetailScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ params: { varietyId: 'v1' } } as never}
      />,
    );

    expect(screen.getByText('Соя 3')).toBeTruthy();
    expect(screen.getByText('17. Длина стебля')).toBeTruthy();
    expect(screen.getByText('25. Масса семян с растения')).toBeTruthy();
  });

  it('renders flowering start copy and keeps next enabled without cards', () => {
    const screen = render(
      <TraitInfectionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{
          params: { traitCode: 'flowering_start', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(screen.getByText(/Шаг 2\. Отметьте зацветшие растения/)).toBeTruthy();
    expect(screen.getByText('Карточки зацветших растений')).toBeTruthy();
    expect(screen.getByText('Далее').parent?.props.disabled).toBeFalsy();
  });

  it('renders full flowering copy in step 2 and step 3', () => {
    mockApp.getTraitPlotDraft = (): any => ({
      plotIndex: 1,
      overviewPhoto: 'file:///plot.jpg',
      infections: [
        {
          id: 'card-1',
          photoUri: undefined,
          plantNumber: '7',
          rowNumber: '2',
          isComplete: false,
        },
      ],
      syncStatus: 'queued' as const,
    });

    const step2 = render(
      <TraitInfectionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{
          params: { traitCode: 'flowering_full', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(step2.getByText(/Шаг 2\. Отметьте растения в полном цветении/)).toBeTruthy();

    const step3 = render(
      <TraitReviewScreen
        navigation={{ goBack: jest.fn(), replace: jest.fn() } as never}
        route={{
          params: { traitCode: 'flowering_full', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(step3.getByText('Карточки растений в полном цветении')).toBeTruthy();
  });

  it('renders measurement flow step 1', () => {
    const screen = render(
      <MeasurementTraitFlowScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() } as never}
        route={{
          params: { traitCode: 'stem_length', varietyId: 'v1', step: 1 },
        } as never}
      />,
    );

    expect(screen.getByText('Шаг 1. Участок А')).toBeTruthy();
    expect(screen.getByText('Количество растений, попавших в участок')).toBeTruthy();
    expect(screen.getByText('Сделать фото')).toBeTruthy();
  });
});
