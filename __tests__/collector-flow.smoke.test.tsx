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
          traitStatuses: { fusarium: 'in_progress' },
        },
      ],
    },
    getNextFusariumPlot: () => 2,
    getCompletedPlotsCount: () => 1,
    getLatestVarietySyncStatus: () => 'queued',
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

  it('renders variety detail status', () => {
    const screen = render(
      <VarietyDetailScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ params: { varietyId: 'v1' } } as never}
      />,
    );

    expect(screen.getByText('Соя 3')).toBeTruthy();
    expect(screen.getByText('Фузариоз в работе')).toBeTruthy();
  });
});
