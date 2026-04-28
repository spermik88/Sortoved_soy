import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title, uiStyles } from '../components/Ui';
import { colors } from '../constants/theme';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { isGoogleSessionUsable } from '../services/authService';

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
  const { completeCreation, state } = useV2App();
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
        if (!isGoogleSessionUsable(state.session)) {
          navigation.replace('Auth', { mode: 'resumeCreation' });
          return;
        }
        await completeCreation();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Catalog' }],
        });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Cloud creation failed.';
        if (/401|UNAUTHENTICATED|Invalid Credentials|authError/i.test(message)) {
          navigation.replace('Auth', { mode: 'resumeCreation', force: true });
          return;
        }
        setError(message);
      } finally {
        clearInterval(interval);
      }
    }

    void run();

    return () => clearInterval(interval);
  }, [completeCreation, navigation, state.session]);

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
