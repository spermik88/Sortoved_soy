import React, { useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  EmptyState,
  Field,
  LinkText,
  LoadingBlock,
  PhotoFrame,
  Screen,
  StatPill,
  StepIndicator,
  Title,
  uiStyles,
} from '../components/Ui';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { cameraService } from '../services/cameraService';
import { getSyncStatusText } from '../utils/syncStatus';

function useVariety(varietyId: string) {
  const { state } = useApp();
  return state.varieties.find((variety) => variety.id === varietyId) || null;
}

function subtitle(plotIndex: number) {
  return `${t('fusarium.title')}\n${t('fusarium.plotLabel')} ${plotIndex} ${t('fusarium.ofThree')}`;
}

export function FusariumOverviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumOverview'>) {
  const variety = useVariety(route.params.varietyId);
  const { getCompletedPlotsCount, getFusariumPlotDraft, saveOverviewPhoto } = useApp();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);

  if (!variety) {
    return null;
  }

  const plotPhoto = variety.plotPhotos.find(
    (item) => item.plotIndex === route.params.plotIndex,
  );
  const completedPlots = getCompletedPlotsCount(route.params.varietyId);

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
      <Title subtitle={subtitle(route.params.plotIndex)}>{variety.title}</Title>

      <Card>
        <StepIndicator current={1} total={3} />
        <StatPill label={`${t('fusarium.currentStep')}: ${t('fusarium.step1Title')}`} />
        <Text style={styles.metaText}>
          {t('fusarium.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={styles.metaText}>{getSyncStatusText(plotDraft.syncStatus)}</Text>
        <Text style={uiStyles.paragraph}>{t('fusarium.step1Description')}</Text>
        <Text style={styles.sectionTitle}>
          {t('fusarium.plotLabel')} {route.params.plotIndex}
        </Text>
        <PhotoFrame uri={plotPhoto?.imageUri} fallback={t('fusarium.sourcePhotoMissing')} />
        <LinkText
          label={plotPhoto?.mapsUrl ? t('fusarium.mapAvailable') : t('fusarium.mapMissing')}
          url={plotPhoto?.mapsUrl}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('fusarium.step1Title')}</Text>
        <PhotoFrame uri={plotDraft.overviewPhoto} fallback={t('fusarium.overviewMissing')} />

        {permissionDenied ? (
          <Card>
            <Text style={uiStyles.paragraph}>{t('fusarium.permissionDenied')}</Text>
            <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
          </Card>
        ) : null}

        <Button
          label={plotDraft.overviewPhoto ? t('fusarium.retakePhoto') : t('fusarium.takePhoto')}
          onPress={() => void onCapture()}
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button
          label={t('common.next')}
          disabled={!plotDraft.overviewPhoto}
          onPress={() =>
            navigation.navigate('FusariumInfections', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
        {!plotDraft.overviewPhoto ? (
          <Text style={styles.helpText}>{t('fusarium.noOverviewCantContinue')}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

export function FusariumInfectionsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumInfections'>) {
  const {
    addInfectionCard,
    getCompletedPlotsCount,
    getFusariumPlotDraft,
    removeInfectionCard,
    updateInfectionCard,
  } = useApp();
  const variety = useVariety(route.params.varietyId);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);
  const hasIncompleteCards = plotDraft.infections.some((card) => !card.isComplete);
  const completedPlots = getCompletedPlotsCount(route.params.varietyId);
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
      <Title subtitle={subtitle(route.params.plotIndex)}>{variety.title}</Title>

      <Card>
        <StepIndicator current={2} total={3} />
        <StatPill label={`${t('fusarium.currentStep')}: ${t('fusarium.step2Title')}`} />
        <Text style={styles.metaText}>
          {t('fusarium.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={uiStyles.paragraph}>{t('fusarium.infectionsIntro')}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('fusarium.samplesTitle')}</Text>
        {sampleImages.length ? (
          <Text style={uiStyles.paragraph}>{t('fusarium.samplesHint')}</Text>
        ) : (
          <EmptyState title={t('fusarium.noSamples')} description={t('fusarium.samplesHint')} />
        )}
      </Card>

      {permissionDenied ? (
        <Card>
          <Text style={uiStyles.paragraph}>{t('fusarium.permissionDenied')}</Text>
          <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>{t('fusarium.infectionCards')}</Text>
        {plotDraft.infections.map((card, index) => (
          <View key={card.id} style={styles.infectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Заражение {index + 1}</Text>
              <StatPill
                label={card.isComplete ? t('fusarium.infectionReady') : t('fusarium.infectionDraft')}
                tone={card.isComplete ? 'success' : 'warning'}
              />
            </View>
            <PhotoFrame uri={card.photoUri} fallback={t('fusarium.infectionPhotoHint')} />
            <Button
              label={card.photoUri ? t('fusarium.retakePhoto') : t('fusarium.takePhoto')}
              variant="secondary"
              onPress={() => void takeCardPhoto(card.id)}
            />
            <Field
              label={t('fusarium.plantNumber')}
              keyboardType="numeric"
              placeholder={t('fusarium.plantPlaceholder')}
              value={card.plantNumber}
              onChangeText={(value) =>
                updateInfectionCard(route.params.varietyId, route.params.plotIndex, card.id, {
                  plantNumber: value,
                })
              }
            />
            <Field
              label={t('fusarium.rowNumber')}
              keyboardType="numeric"
              placeholder={t('fusarium.rowPlaceholder')}
              value={card.rowNumber}
              onChangeText={(value) =>
                updateInfectionCard(route.params.varietyId, route.params.plotIndex, card.id, {
                  rowNumber: value,
                })
              }
            />
            <Button
              label={t('fusarium.deleteInfection')}
              variant="ghost"
              onPress={() =>
                removeInfectionCard(route.params.varietyId, route.params.plotIndex, card.id)
              }
            />
          </View>
        ))}

        <Button
          label={t('fusarium.addInfection')}
          onPress={() => addInfectionCard(route.params.varietyId, route.params.plotIndex)}
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button
          label={t('common.next')}
          disabled={hasIncompleteCards}
          onPress={() =>
            navigation.navigate('FusariumReview', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
        {hasIncompleteCards ? (
          <Text style={styles.helpText}>{t('fusarium.incompleteHint')}</Text>
        ) : plotDraft.infections.length === 0 ? (
          <Text style={styles.helpText}>{t('fusarium.infectionEmpty')}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

export function FusariumReviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'FusariumReview'>) {
  const { confirmFusariumPlot, getCompletedPlotsCount, getFusariumPlotDraft } = useApp();
  const variety = useVariety(route.params.varietyId);
  const plotDraft = getFusariumPlotDraft(route.params.varietyId, route.params.plotIndex);
  const completedPlots = getCompletedPlotsCount(route.params.varietyId);
  const [submitting, setSubmitting] = useState(false);

  const nextAction = useMemo(() => {
    return route.params.plotIndex < 3
      ? {
          label: t('fusarium.goToNextPlot'),
          onDone: () =>
            navigation.replace('FusariumOverview', {
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex + 1,
            }),
        }
      : {
          label: t('fusarium.goToVariety'),
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
      result === 'synced' ? t('fusarium.saveSuccessTitle') : t('fusarium.saveQueuedTitle'),
      result === 'synced' ? t('fusarium.saveSuccessMessage') : t('fusarium.saveQueuedMessage'),
      [{ text: nextAction.label, onPress: nextAction.onDone }],
    );
  };

  if (submitting) {
    return <LoadingBlock label={t('fusarium.queueProcessing')} />;
  }

  return (
    <Screen>
      <Title subtitle={subtitle(route.params.plotIndex)}>{variety.title}</Title>

      <Card>
        <StepIndicator current={3} total={3} />
        <StatPill label={`${t('fusarium.currentStep')}: ${t('fusarium.step3Title')}`} />
        <Text style={styles.metaText}>
          {t('fusarium.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={styles.metaText}>{getSyncStatusText(plotDraft.syncStatus)}</Text>
        <Text style={styles.sectionTitle}>{t('fusarium.reviewPlotPhoto')}</Text>
        <PhotoFrame uri={plotDraft.overviewPhoto} fallback={t('fusarium.overviewMissing')} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('fusarium.reviewCards')}</Text>
        {plotDraft.infections.length ? (
          plotDraft.infections.map((card, index) => (
            <View key={card.id} style={styles.infectionSummary}>
              <Text style={styles.cardTitle}>Заражение {index + 1}</Text>
              <PhotoFrame uri={card.photoUri} fallback={t('fusarium.infectionPhotoHint')} />
              <Text style={uiStyles.paragraph}>
                Растение №{card.plantNumber || '-'}, ряд №{card.rowNumber || '-'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyState}>{t('fusarium.infectionEmpty')}</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.metaText}>
          {plotDraft.syncStatus === 'synced'
            ? t('fusarium.queueSynced')
            : plotDraft.syncStatus === 'queued'
              ? t('fusarium.queueQueued')
              : t('fusarium.statusIdle')}
        </Text>
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={t('fusarium.confirmData')} onPress={() => void submit()} />
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
  helpText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  metaText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
