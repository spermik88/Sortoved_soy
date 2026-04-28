import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, EmptyState, Screen, Title, uiStyles } from '../components/Ui';
import { queueStatusLabels, queueTypeLabels, v2Copy } from '../config/copy';
import { taskDefinitionsByCode } from '../config/flowRegistry';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';

function formatQueueDate(value?: string) {
  if (!value) {
    return '\u043d\u0435\u0442';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
}

function getQueueStepLabel(item: { screenId?: string; payload: Record<string, unknown> }) {
  const taskCode = String(item.payload.taskCode || item.screenId || '');
  const taskTitle = taskCode ? taskDefinitionsByCode[taskCode]?.title : '';
  return taskCode
    ? `${taskCode}. ${taskTitle || '\u0428\u0430\u0433'}`
    : '\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u0441\u043e\u0440\u0442\u0430';
}

export function QueueScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Queue'>) {
  const { state, online, processQueue, removeQueueOperation } = useV2App();
  const hasAuthWait = state.syncQueue.some((item) => item.status === 'waiting_for_auth');
  const activeQueue = state.syncQueue.filter((item) => !item.cloudAppliedAt);

  return (
    <Screen>
      <Title subtitle={online ? v2Copy.queueOnline : v2Copy.queueOffline}>
        {v2Copy.queueTitle}
      </Title>
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.queueIntro}</Text>
      </Card>
      <Card>
        {activeQueue.length ? (
          activeQueue.map((item) => {
            const variety = state.catalog.find((entry) => entry.id === item.varietyId);
            return (
              <Card key={item.id}>
                <Text style={uiStyles.paragraph}>
                  {variety?.title || '\u0421\u043e\u0440\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d'}
                </Text>
                <Text style={uiStyles.paragraph}>{getQueueStepLabel(item)}</Text>
                <Text style={uiStyles.paragraph}>{queueTypeLabels[item.type]}</Text>
                <Text style={uiStyles.paragraph}>
                  {v2Copy.queueItemStatus}: {queueStatusLabels[item.status]}
                </Text>
                <Text style={uiStyles.paragraph}>
                  {v2Copy.queueItemRetries}: {item.retryCount}
                </Text>
                <Text style={uiStyles.paragraph}>
                  {'\u0424\u043e\u0442\u043e'}: {item.media?.length || 0}
                </Text>
                {item.lastError ? (
                  <Text style={uiStyles.paragraph}>
                    {v2Copy.queueItemError}: {item.lastError}
                  </Text>
                ) : null}
                {item.cloudError ? (
                  <Text style={uiStyles.paragraph}>Google: {item.cloudError}</Text>
                ) : null}
                <Text style={uiStyles.paragraph}>
                  {'\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u043e'}: {formatQueueDate(item.localAppliedAt)}
                </Text>
                <Text style={uiStyles.paragraph}>
                  Google: {item.authRequired ? '\u043d\u0443\u0436\u043d\u0430 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f' : formatQueueDate(item.cloudAppliedAt)}
                </Text>
                <Text style={uiStyles.paragraph}>
                  {'\u0421\u043e\u0437\u0434\u0430\u043d\u043e'}: {formatQueueDate(item.createdAt)}
                </Text>
                <Text style={uiStyles.paragraph}>
                  {'\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e'}: {formatQueueDate(item.updatedAt)}
                </Text>
                <View style={{ gap: 8 }}>
                  <Button
                    label={'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0438\u0437 \u043e\u0447\u0435\u0440\u0435\u0434\u0438'}
                    variant="secondary"
                    onPress={() => removeQueueOperation(item.id)}
                  />
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState title={v2Copy.queueEmptyTitle} description={v2Copy.queueEmptyBody} />
        )}
        {hasAuthWait ? (
          <Button
            label={'\u0410\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u0438 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c Google sync'}
            variant="secondary"
            onPress={() => navigation.navigate('Auth', { mode: 'link' })}
          />
        ) : null}
        <View style={{ gap: 8 }}>
          <Button
            label={'\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c \u043e\u0448\u0438\u0431\u043a\u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438'}
            onPress={() => void processQueue()}
          />
        </View>
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
