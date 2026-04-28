import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title, uiStyles } from '../components/Ui';
import { colors } from '../constants/theme';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';

const steps = [
  'Создаем папки в Google Drive',
  'Создаем таблицу Google Sheets',
  'Заполняем листы шаблона',
  'Загружаем фотографии',
  'Проверяем облачную запись',
];

export function CreationCloudSyncScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'CreationCloudSync'>) {
  const { completeCreation } = useV2App();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const interval = setInterval(() => {
      setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    }, 2500);

    async function run() {
      try {
        await completeCreation();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Catalog' }],
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Не удалось создать сорт в облаке.');
      } finally {
        clearInterval(interval);
      }
    }

    void run();

    return () => clearInterval(interval);
  }, [completeCreation, navigation]);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Title subtitle="Не закрывайте приложение до завершения записи.">
          Создание сорта
        </Title>
        <Card>
          {error ? null : <ActivityIndicator size="large" color={colors.accentStrong} />}
          <Text style={[uiStyles.paragraph, { textAlign: 'center' }]}>
            {error || steps[stepIndex]}
          </Text>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${error ? 100 : ((stepIndex + 1) / steps.length) * 100}%`,
                backgroundColor: error ? '#9E2B25' : colors.accentStrong,
              }}
            />
          </View>
          {error ? (
            <>
              <Button label="Назад к шагам" variant="secondary" onPress={() => navigation.goBack()} />
            </>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}
