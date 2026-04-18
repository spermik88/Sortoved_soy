import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AppProvider, useApp } from '../src/context/AppContext';

function Probe() {
  const app = useApp();
  const draft = app.getFusariumPlotDraft('test-variety', 1);

  if (!app.hydrated) {
    return <Text>loading</Text>;
  }

  return (
    <>
      <Text testID="role">{app.state.activeRole ?? 'none'}</Text>
      <Text testID="mode">{app.state.collectorMode ?? 'none'}</Text>
      <Text testID="varieties">{String(app.state.varieties.length)}</Text>
      <Text testID="infections">{String(draft.infections.length)}</Text>
      <Button title="collector" onPress={() => app.selectRole('collector')} />
      <Button title="test-mode" onPress={() => app.enableTestMode()} />
      <Button title="add-card" onPress={() => app.addInfectionCard('test-variety', 1)} />
      <Button
        title="fill-card"
        onPress={() => {
          const current = app.getFusariumPlotDraft('test-variety', 1).infections[0];
          if (current) {
            app.updateInfectionCard('test-variety', 1, current.id, {
              photoUri: 'file:///mock.jpg',
              plantNumber: '5',
              rowNumber: '1',
            });
          }
        }}
      />
    </>
  );
}

describe('AppProvider', () => {
  it('supports collector test mode flow and draft updates', async () => {
    const screen = render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('role')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText('collector'));
      fireEvent.press(screen.getByText('test-mode'));
      fireEvent.press(screen.getByText('add-card'));
      fireEvent.press(screen.getByText('fill-card'));
    });

    expect(screen.getByTestId('role').props.children).toBe('collector');
    expect(screen.getByTestId('mode').props.children).toBe('test');
    expect(screen.getByTestId('varieties').props.children).toBe('1');
    expect(screen.getByTestId('infections').props.children).toBe('1');
  });
});
