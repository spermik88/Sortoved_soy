import React from 'react';
import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, EmptyState, Screen, Title, uiStyles } from '../components/Ui';
import { queueStatusLabels, queueTypeLabels, v2Copy } from '../config/copy';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';

export function QueueScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Queue'>) {
  const { state, online, processQueue } = useV2App();
  const hasAuthWait = state.syncQueue.some((item) => item.status === 'waiting_for_auth');

  return (
    <Screen>
      <Title subtitle={online ? v2Copy.queueOnline : v2Copy.queueOffline}>
        {v2Copy.queueTitle}
      </Title>
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.queueIntro}</Text>
      </Card>
      <Card>
        {state.syncQueue.length ? (
          state.syncQueue.map((item) => (
            <Card key={item.id}>
              <Text style={uiStyles.paragraph}>{queueTypeLabels[item.type]}</Text>
              <Text style={uiStyles.paragraph}>
                {v2Copy.queueItemStatus}: {queueStatusLabels[item.status]}
              </Text>
              <Text style={uiStyles.paragraph}>
                {v2Copy.queueItemRetries}: {item.retryCount}
              </Text>
              {item.lastError ? (
                <Text style={uiStyles.paragraph}>
                  {v2Copy.queueItemError}: {item.lastError}
                </Text>
              ) : null}
              {item.cloudError ? (
                <Text style={uiStyles.paragraph}>
                  Google: {item.cloudError}
                </Text>
              ) : null}
              <Text style={uiStyles.paragraph}>
                Local: {item.localAppliedAt || 'pending'}
              </Text>
              <Text style={uiStyles.paragraph}>
                Cloud: {item.cloudAppliedAt || (item.authRequired ? 'waiting auth' : 'pending')}
              </Text>
            </Card>
          ))
        ) : (
          <EmptyState title={v2Copy.queueEmptyTitle} description={v2Copy.queueEmptyBody} />
        )}
        {hasAuthWait ? (
          <Button
            label="Авторизоваться и продолжить Google sync"
            variant="secondary"
            onPress={() => navigation.navigate('Auth', { mode: 'link' })}
          />
        ) : null}
        <Button label={v2Copy.queueRetry} onPress={() => void processQueue()} />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
