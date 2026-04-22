import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { V2AppProvider, useV2App } from '../v2/src/context/V2AppContext';
import { PersistedV2State } from '../v2/src/types/app';

function Probe() {
  const app = useV2App();
  const varietyId = app.state.catalog[0]?.id;
  const task = varietyId ? app.getTask(varietyId, '17') : null;
  const taskQueue = app.state.syncQueue.filter(
    (item) => item.type === 'submit_task' && item.varietyId === varietyId && item.screenId === '17',
  );

  if (!app.hydrated) {
    return <Text>loading</Text>;
  }

  return (
    <>
      <Text testID="variety-id">{varietyId || 'none'}</Text>
      <Text testID="task-status">{task?.uiStatus || 'none'}</Text>
      <Text testID="queue-length">{String(taskQueue.length)}</Text>
      <Text testID="stored-task-status">
        {varietyId ? app.state.inspections[varietyId]?.['17']?.uiStatus || 'none' : 'none'}
      </Text>
      <Button title="begin-creation" onPress={() => app.beginCreation()} />
      <Button
        title="set-variety-name"
        onPress={() => app.updateCreationDraft({ varietyName: 'Сорт 1 тест' })}
      />
      <Button
        title="complete-creation"
        onPress={async () => {
          await app.completeCreation();
        }}
      />
      <Button
        title="add-task-card"
        onPress={() => {
          if (!varietyId) {
            return;
          }
          app.addTaskCard(varietyId, '17');
        }}
      />
      <Button
        title="fill-task-card"
        onPress={() => {
          if (!varietyId) {
            return;
          }

          const nextTask = app.getTask(varietyId, '17');
          const cardId = nextTask.cards[0]?.id;
          if (!cardId) {
            return;
          }

          app.updateTaskCard(varietyId, '17', cardId, {
            photoUri: 'file:///measurement.jpg',
            value: '180',
            note: '180',
            plot: '1',
          });
        }}
      />
      <Button
        title="complete-task"
        onPress={() => {
          if (!varietyId) {
            return;
          }
          app.completeTaskLocally(varietyId, '17');
        }}
      />
      <Button
        title="queue-task"
        onPress={async () => {
          if (!varietyId) {
            return;
          }
          await app.queueTaskSubmission(varietyId, '17');
        }}
      />
      <Button
        title="edit-task"
        onPress={() => {
          if (!varietyId) {
            return;
          }

          const nextTask = app.getTask(varietyId, '17');
          const cardId = nextTask.cards[0]?.id;
          if (!cardId) {
            return;
          }

          app.updateTaskCard(varietyId, '17', cardId, {
            value: '181',
            note: '181',
          });
        }}
      />
    </>
  );
}

describe('V2AppProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  function buildPersistedState(): PersistedV2State {
    return {
      session: null,
      pendingAuthMode: null,
      creationDraft: null,
      catalog: [
        {
          id: 'variety-1',
          title: 'Сорт 1 тест',
          source: 'created',
          binding: {
            spreadsheetId: 'created-variety-1',
            spreadsheetUrl: 'local://sortoved-v2/%D0%A1%D0%BE%D1%80%D1%82%201',
          },
          createdAt: '2026-04-22T10:00:00.000Z',
          updatedAt: '2026-04-22T10:00:00.000Z',
          status: 'ready',
        },
      ],
      inspections: {
        'variety-1': {
          '17': {
            code: '17',
            title: 'Длина стебля',
            kind: 'measurement',
            flowKind: 'measurement_cards',
            intro: 'Измерение',
            overviewCompleted: false,
            cardsCompleted: true,
            completedAt: '2026-04-22T10:10:00.000Z',
            uiStatus: 'draft',
            cards: [
              {
                id: 'card-1',
                photoUri: 'file:///measurement.jpg',
                note: '180',
                plot: '1',
                value: '180',
                isComplete: true,
              },
            ],
            updatedAt: '2026-04-22T10:10:00.000Z',
          },
        },
      },
      syncQueue: [
        {
          id: 'queue-1',
          type: 'submit_task',
          varietyId: 'variety-1',
          screenId: '17',
          status: 'synced',
          idempotencyKey: 'created-variety-1:17:2026-04-22T10:10:00.000Z',
          createdAt: '2026-04-22T10:10:00.000Z',
          updatedAt: '2026-04-22T10:11:00.000Z',
          retryCount: 0,
          payload: { taskCode: '17', title: 'Длина стебля' },
        },
      ],
    };
  }

  it('reverts processed task back to draft and removes stale task queue entries after editing', async () => {
    await AsyncStorage.setItem(
      'sortoved-soy/app-state-v2',
      JSON.stringify(buildPersistedState()),
    );

    const screen = render(
      <V2AppProvider>
        <Probe />
      </V2AppProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('task-status').props.children).toBe('processed');
      expect(screen.getByTestId('queue-length').props.children).toBe('1');
    });

    await act(async () => {
      fireEvent.press(screen.getByText('edit-task'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-status').props.children).toBe('draft');
      expect(screen.getByTestId('queue-length').props.children).toBe('0');
    });
  });

  it('normalizes stored task ui status from queue state on hydration', async () => {
    const persisted = buildPersistedState();

    await AsyncStorage.setItem('sortoved-soy/app-state-v2', JSON.stringify(persisted));

    const screen = render(
      <V2AppProvider>
        <Probe />
      </V2AppProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stored-task-status').props.children).toBe('processed');
    });
  });
});
