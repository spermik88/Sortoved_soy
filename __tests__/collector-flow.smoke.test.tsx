import React from 'react';
import { render } from '@testing-library/react-native';

import { MainMenuScreen } from '../src/screens/OnboardingScreens';
import { RoleSelectionScreen } from '../src/screens/RoleSelectionScreen';
import { VarietyDetailScreen } from '../src/screens/VarietyScreens';

jest.mock('../src/context/AppContext', () => ({
  useApp: () => ({
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
            bacteriosis: 'completed',
            downy_mildew: 'completed',
            cercospora: 'completed',
            aphid_damage: 'in_progress',
          },
        },
      ],
    },
    getNextTraitPlot: () => 2,
    getCompletedPlotsCount: () => 1,
    getLatestVarietySyncStatus: () => 'queued',
    getAggregateTraitState: () => 'in_progress',
  }),
}));

describe('collector flow smoke', () => {
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

  it('renders aggregate variety detail status', () => {
    const screen = render(
      <VarietyDetailScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ params: { varietyId: 'v1' } } as never}
      />,
    );

    expect(screen.getByText('Соя 3')).toBeTruthy();
    expect(screen.getByText('Активные ходы в работе')).toBeTruthy();
    expect(screen.getByText('2. Септориоз')).toBeTruthy();
    expect(screen.getByText('9. Повреждение тлей')).toBeTruthy();
  });
});
