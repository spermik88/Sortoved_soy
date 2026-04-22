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
            </Card>
          ))
        ) : (
          <EmptyState title={v2Copy.queueEmptyTitle} description={v2Copy.queueEmptyBody} />
        )}
        <Button label={v2Copy.queueRetry} onPress={() => void processQueue()} />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
