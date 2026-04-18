import React from 'react';
import { render } from '@testing-library/react-native';

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
  getTraitPlotDraft: () => ({
    plotIndex: 1,
    overviewPhoto: 'file:///plot.jpg',
    infections: [],
    syncStatus: 'idle' as const,
  }),
  addInfectionCard: jest.fn(),
  removeInfectionCard: jest.fn(),
  updateInfectionCard: jest.fn(),
  confirmTraitPlot: jest.fn(),
  saveOverviewPhoto: jest.fn(),
};

jest.mock('../src/context/AppContext', () => ({
  useApp: () => mockApp,
}));

describe('collector flow smoke', () => {
  beforeEach(() => {
    mockApp.getTraitPlotDraft = () => ({
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

  it('renders aggregate variety detail status with traits 10-16 enabled', () => {
    const screen = render(
      <VarietyDetailScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ params: { varietyId: 'v1' } } as never}
      />,
    );

    expect(screen.getByText('Соя 3')).toBeTruthy();
    expect(screen.getByText('Активные ходы в работе')).toBeTruthy();
    expect(screen.getByText('4. Начало цветения')).toBeTruthy();
    expect(screen.getByText('5. Полное цветение')).toBeTruthy();
    expect(screen.getByText('9. Повреждение тлей')).toBeTruthy();
    expect(screen.getByText('10. Цветок: окраска')).toBeTruthy();
    expect(screen.getByText('11. Конец цветения')).toBeTruthy();
    expect(screen.getByText('12. Форма бокового листочка')).toBeTruthy();
    expect(screen.getByText('13. Полное созревание')).toBeTruthy();
    expect(screen.getByText('14. Окраска опушения главного стебля')).toBeTruthy();
    expect(screen.getByText('15. Устойчивость к полеганию')).toBeTruthy();
    expect(screen.getByText('16. Устойчивость к осыпанию')).toBeTruthy();
    expect(screen.getAllByText('[x][x]').length).toBeGreaterThan(0);
    expect(screen.getByText('[x]')).toBeTruthy();
    expect(screen.queryByText('10. Цветок: окраска', { exact: true })).toBeTruthy();
    expect(screen.getAllByText('Будет реализовано позже')).toHaveLength(13);
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
    expect(screen.getByText('Добавить зацветшее растение')).toBeTruthy();
    expect(screen.getByText('Зацветшие растения не добавлены.')).toBeTruthy();
    expect(screen.getByText('Далее').parent?.props.disabled).toBeFalsy();
  });

  it('renders full flowering copy in step 2 and step 3', () => {
    mockApp.getTraitPlotDraft = () => ({
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
    expect(step2.getByText('Карточки растений в полном цветении')).toBeTruthy();
    expect(step2.getByText('Растение в полном цветении 1')).toBeTruthy();
    expect(step2.getByText('Сделайте фото растения в полном цветении.')).toBeTruthy();

    const step3 = render(
      <TraitReviewScreen
        navigation={{ goBack: jest.fn(), replace: jest.fn() } as never}
        route={{
          params: { traitCode: 'flowering_full', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(step3.getByText('Карточки растений в полном цветении')).toBeTruthy();
    expect(step3.getByText('Растение в полном цветении 1')).toBeTruthy();
    expect(step3.getByText('Сделайте фото растения в полном цветении.')).toBeTruthy();
  });

  it('keeps disease copy unchanged for disease traits', () => {
    const screen = render(
      <TraitInfectionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{ params: { traitCode: 'fusarium', varietyId: 'v1', plotIndex: 1 } } as never}
      />,
    );

    expect(screen.getByText(/Шаг 2\. Отметьте зараженные растения/)).toBeTruthy();
    expect(screen.getByText('Карточки заражения')).toBeTruthy();
    expect(screen.getByText('Добавить заражение')).toBeTruthy();
  });

  it('renders trait 10 copy and keeps next enabled without cards', () => {
    const screen = render(
      <TraitInfectionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{ params: { traitCode: 'flower_color', varietyId: 'v1', plotIndex: 1 } } as never}
      />,
    );

    expect(screen.getByText(/Шаг 2\. Отметьте растения с окраской цветка/)).toBeTruthy();
    expect(screen.getByText('Карточки растений с окраской цветка')).toBeTruthy();
    expect(screen.getByText('Добавить растение с окраской цветка')).toBeTruthy();
    expect(screen.getByText('Растения с окраской цветка не добавлены.')).toBeTruthy();
    expect(screen.getByText('Далее').parent?.props.disabled).toBeFalsy();
  });

  it('renders trait 16 copy in step 2 and step 3', () => {
    mockApp.getTraitPlotDraft = () => ({
      plotIndex: 1,
      overviewPhoto: 'file:///plot.jpg',
      infections: [
        {
          id: 'card-1',
          photoUri: undefined,
          plantNumber: '3',
          rowNumber: '1',
          isComplete: false,
        },
      ],
      syncStatus: 'queued' as const,
    });

    const step2 = render(
      <TraitInfectionsScreen
        navigation={{ goBack: jest.fn(), navigate: jest.fn() } as never}
        route={{
          params: { traitCode: 'shattering_resistance', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(step2.getByText(/Шаг 2\. Отметьте растения с осыпанием/)).toBeTruthy();
    expect(step2.getByText('Карточки растений с осыпанием')).toBeTruthy();
    expect(step2.getByText('Растение с осыпанием 1')).toBeTruthy();
    expect(step2.getByText('Сделайте фото растения с осыпанием.')).toBeTruthy();

    const step3 = render(
      <TraitReviewScreen
        navigation={{ goBack: jest.fn(), replace: jest.fn() } as never}
        route={{
          params: { traitCode: 'shattering_resistance', varietyId: 'v1', plotIndex: 1 },
        } as never}
      />,
    );

    expect(step3.getByText('Карточки растений с осыпанием')).toBeTruthy();
    expect(step3.getByText('Растение с осыпанием 1')).toBeTruthy();
    expect(step3.getByText('Сделайте фото растения с осыпанием.')).toBeTruthy();
  });
});
