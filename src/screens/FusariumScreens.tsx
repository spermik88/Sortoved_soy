import React, { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  Field,
  LinkText,
  LoadingBlock,
  PhotoFrame,
  Screen,
  StatPill,
  Title,
  uiStyles,
} from '../components/Ui';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { cameraService } from '../services/cameraService';

function useVariety(varietyId: string) {
  const { state } = useApp();
  return state.varieties.find((variety) => variety.id === varietyId) || null;
}

export function FusariumOverviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumOverview'>) {
  const variety = useVariety(route.params.varietyId);
  const { getFusariumPlotDraft, saveOverviewPhoto } = useApp();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);

  if (!variety) {
    return null;
  }

  const plotPhoto = variety.plotPhotos.find(
    (item) => item.plotIndex === route.params.plotIndex,
  );

  const onCapture = async () => {
    const result = await cameraService.capturePhoto();

    if (result.kind === 'permission_denied') {
      setPermissionDenied(true);
      return;
    }

    if (result.kind === 'success') {
      saveOverviewPhoto(route.params.varietyId, route.params.plotIndex, result.uri);
    }
  };

  return (
    <Screen>
      <Title subtitle={`1. Фузариоз\nДелянка ${route.params.plotIndex} из 3`}>
        {variety.title}
      </Title>

      <Card>
        <Text style={uiStyles.paragraph}>
          Перед осмотром растений сфотографируйте текущее состояние делянки, на
          которой вы будете делать осмотр.
        </Text>

        <Text style={styles.sectionTitle}>Делянка {route.params.plotIndex}</Text>
        <PhotoFrame
          uri={plotPhoto?.imageUri}
          fallback="Исходное фото делянки пока недоступно."
        />
        <LinkText
          label={
            plotPhoto?.mapsUrl ? 'Открыть геометку снимка в Google Maps' : 'Геометка недоступна'
          }
          url={plotPhoto?.mapsUrl}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Шаг 1. Сделайте фотографию делянки</Text>
        <PhotoFrame
          uri={plotDraft.overviewPhoto}
          fallback="После съемки здесь появится превью вашей фотографии."
        />

        {permissionDenied ? (
          <Card>
            <Text style={uiStyles.paragraph}>
              Доступ к камере отключен. Разрешите его в системных настройках,
              чтобы продолжить съемку.
            </Text>
            <Button
              label="Открыть настройки"
              onPress={() => {
                void Linking.openSettings();
              }}
            />
          </Card>
        ) : null}

        <Button
          label={plotDraft.overviewPhoto ? 'Сделать фото заново' : 'Сделать фото'}
          onPress={() => void onCapture()}
        />
        <Button
          label="Далее"
          disabled={!plotDraft.overviewPhoto}
          onPress={() =>
            navigation.navigate('FusariumInfections', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
      </Card>
    </Screen>
  );
}

export function FusariumInfectionsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumInfections'>) {
  const { getFusariumPlotDraft, addInfectionCard, updateInfectionCard } = useApp();
  const variety = useVariety(route.params.varietyId);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);
  const hasIncompleteCards = plotDraft.infections.some((card) => !card.isComplete);
  const sampleImages: string[] = [];

  if (!variety) {
    return null;
  }

  const takeCardPhoto = async (cardId: string) => {
    const result = await cameraService.capturePhoto();

    if (result.kind === 'permission_denied') {
      setPermissionDenied(true);
      return;
    }

    if (result.kind === 'success') {
      updateInfectionCard(route.params.varietyId, route.params.plotIndex, cardId, {
        photoUri: result.uri,
      });
    }
  };

  return (
    <Screen>
      <Title subtitle={`1. Фузариоз\nДелянка ${route.params.plotIndex} из 3`}>
        {variety.title}
      </Title>

      <Card>
        <Text style={uiStyles.paragraph}>
          Тщательно осмотрите каждое растение на делянке на заражение
          фузариозом. Сделайте фотографию каждого найденного заболевшего
          растения и укажите его положение.
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Примеры заражения фузариозом</Text>
        {sampleImages.length ? (
          <Text style={uiStyles.paragraph}>Ассеты подключаются отдельно.</Text>
        ) : (
          <Text style={styles.emptyState}>Без изображений</Text>
        )}
      </Card>

      {permissionDenied ? (
        <Card>
          <Text style={uiStyles.paragraph}>
            Без камеры нельзя добавить фото пораженного растения. Разрешите
            доступ в системных настройках.
          </Text>
          <Button label="Открыть настройки" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>Карточки заражения</Text>
        {plotDraft.infections.map((card, index) => (
          <View key={card.id} style={styles.infectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Заражение {index + 1}</Text>
              <StatPill
                label={card.isComplete ? 'Заполнено' : 'Черновик'}
                tone={card.isComplete ? 'success' : 'warning'}
              />
            </View>
            <PhotoFrame
              uri={card.photoUri}
              fallback="Сделайте фото заболевшего растения."
            />
            <Button
              label={card.photoUri ? 'Сделать фото заново' : 'Сделать фото'}
              variant="secondary"
              onPress={() => void takeCardPhoto(card.id)}
            />
            <Field
              label="№ растения в ряду"
              keyboardType="numeric"
              placeholder="Например, 7"
              value={card.plantNumber}
              onChangeText={(value) =>
                updateInfectionCard(route.params.varietyId, route.params.plotIndex, card.id, {
                  plantNumber: value,
                })
              }
            />
            <Field
              label="№ ряда"
              keyboardType="numeric"
              placeholder="Например, 2"
              value={card.rowNumber}
              onChangeText={(value) =>
                updateInfectionCard(route.params.varietyId, route.params.plotIndex, card.id, {
                  rowNumber: value,
                })
              }
            />
          </View>
        ))}

        <Button
          label="Добавить заражение"
          onPress={() => addInfectionCard(route.params.varietyId, route.params.plotIndex)}
        />
        <Button
          label="Далее"
          disabled={hasIncompleteCards}
          onPress={() =>
            navigation.navigate('FusariumReview', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
      </Card>
    </Screen>
  );
}

export function FusariumReviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumReview'>) {
  const { getFusariumPlotDraft, confirmFusariumPlot } = useApp();
  const variety = useVariety(route.params.varietyId);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);
  const [submitting, setSubmitting] = useState(false);

  const nextAction = useMemo(() => {
    return route.params.plotIndex < 3
      ? {
          label: `Перейти к делянке ${route.params.plotIndex + 1}`,
          onDone: () =>
            navigation.replace('FusariumOverview', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex + 1,
            }),
        }
      : {
          label: 'Вернуться к карточке сорта',
          onDone: () =>
            navigation.reset({
              index: 0,
              routes: [
                { name: 'MainMenu' },
                { name: 'Varieties' },
                { name: 'VarietyDetail', params: { varietyId: route.params.varietyId } },
              ],
            }),
        };
  }, [navigation, route.params.plotIndex, route.params.varietyId]);

  if (!variety) {
    return null;
  }

  const submit = async () => {
    setSubmitting(true);
    const result = await confirmFusariumPlot(route.params.varietyId, route.params.plotIndex);
    setSubmitting(false);

    Alert.alert(
      result === 'synced' ? 'Данные сохранены' : 'Данные поставлены в очередь',
      result === 'synced'
        ? `Делянка ${route.params.plotIndex} сохранена в локальный mock-sync пакет.`
        : 'Пакет сохранен локально и будет обработан после появления сети.',
      [{ text: nextAction.label, onPress: nextAction.onDone }],
    );
  };

  if (submitting) {
    return <LoadingBlock label="Подготавливаем пакет и обрабатываем mock sync..." />;
  }

  return (
    <Screen>
      <Title subtitle={`1. Фузариоз\nДелянка ${route.params.plotIndex} из 3`}>
        {variety.title}
      </Title>

      <Card>
        <Text style={styles.sectionTitle}>Фото делянки</Text>
        <PhotoFrame
          uri={plotDraft.overviewPhoto}
          fallback="Фотография делянки не добавлена."
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Карточки заражения</Text>
        {plotDraft.infections.length ? (
          plotDraft.infections.map((card, index) => (
            <View key={card.id} style={styles.infectionSummary}>
              <Text style={styles.cardTitle}>Заражение {index + 1}</Text>
              <PhotoFrame uri={card.photoUri} fallback="Фото не добавлено" />
              <Text style={uiStyles.paragraph}>
                Растение №{card.plantNumber || '—'}, ряд №{card.rowNumber || '—'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyState}>Зараженные растения не добавлены.</Text>
        )}
      </Card>

      <Card>
        <Button label="Подтвердить данные" onPress={() => void submit()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  rowBetween: {
    ...uiStyles.rowBetween,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  infectionCard: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFDF8',
    gap: 10,
  },
  infectionSummary: {
    gap: 8,
    paddingBottom: 8,
  },
  emptyState: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
