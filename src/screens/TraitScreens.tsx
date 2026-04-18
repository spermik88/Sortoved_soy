import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  EmptyState,
  Field,
  LinkText,
  PhotoFrame,
  Screen,
  StatPill,
  StepIndicator,
  Title,
  uiStyles,
} from '../components/Ui';
import { getTraitDefinition } from '../constants/traits';
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

function subtitle(traitCode: RootStackParamList['TraitOverview']['traitCode'], plotIndex: number) {
  const trait = getTraitDefinition(traitCode);
  return `${trait.title}\n${t('traitFlow.plotLabel')} ${plotIndex} ${t('traitFlow.ofThree')}`;
}

function getTraitFlowVariantKey(
  traitCode: RootStackParamList['TraitOverview']['traitCode'],
):
  | 'default'
  | 'flowering_start'
  | 'flowering_full'
  | 'flower_color'
  | 'flowering_end'
  | 'lateral_leaf_shape'
  | 'full_maturity'
  | 'stem_pubescence_color'
  | 'lodging_resistance'
  | 'shattering_resistance' {
  return getTraitDefinition(traitCode).flowCopyKey || 'default';
}

function getTraitFlowText(
  traitCode: RootStackParamList['TraitOverview']['traitCode'],
  key:
    | 'step2Title'
    | 'cardsTitle'
    | 'cardLabel'
    | 'addCard'
    | 'empty'
    | 'photoHint'
    | 'deleteCard'
    | 'reviewCards',
) {
  return t(`traitFlowVariants.${getTraitFlowVariantKey(traitCode)}.${key}`);
}

function cardLabel(
  traitCode: RootStackParamList['TraitOverview']['traitCode'],
  index: number,
) {
  return `${getTraitFlowText(traitCode, 'cardLabel')} ${index + 1}`;
}

export function TraitOverviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TraitOverview'>) {
  const trait = getTraitDefinition(route.params.traitCode);
  const variety = useVariety(route.params.varietyId);
  const { getCompletedPlotsCount, getTraitPlotDraft, saveOverviewPhoto } = useApp();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getTraitPlotDraft(
    route.params.traitCode,
    route.params.varietyId,
    route.params.plotIndex,
  );

  if (!variety) {
    return null;
  }

  const plotPhoto = variety.plotPhotos.find((item) => item.plotIndex === route.params.plotIndex);
  const completedPlots = getCompletedPlotsCount(route.params.traitCode, route.params.varietyId);

  const onCapture = async () => {
    const result = await cameraService.capturePhoto();

    if (result.kind === 'permission_denied') {
      setPermissionDenied(true);
      return;
    }

    if (result.kind === 'success') {
      saveOverviewPhoto(
        route.params.traitCode,
        route.params.varietyId,
        route.params.plotIndex,
        result.uri,
      );
    }
  };

  return (
    <Screen>
      <Title subtitle={subtitle(route.params.traitCode, route.params.plotIndex)}>
        {variety.title}
      </Title>

      <Card>
        <StepIndicator current={1} total={3} />
        <StatPill label={`${t('traitFlow.currentStep')}: ${t('traitFlow.step1Title')}`} />
        <Text style={styles.metaText}>
          {t('traitFlow.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={styles.metaText}>{getSyncStatusText(plotDraft.syncStatus)}</Text>
        <Text style={uiStyles.paragraph}>{t('traitFlow.step1Description')}</Text>
        <Text style={styles.sectionTitle}>
          {t('traitFlow.plotLabel')} {route.params.plotIndex}
        </Text>
        <PhotoFrame uri={plotPhoto?.imageUri} fallback={t('traitFlow.sourcePhotoMissing')} />
        <LinkText
          label={plotPhoto?.mapsUrl ? t('traitFlow.mapAvailable') : t('traitFlow.mapMissing')}
          url={plotPhoto?.mapsUrl}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{t('traitFlow.step1Title')}</Text>
        <PhotoFrame uri={plotDraft.overviewPhoto} fallback={t('traitFlow.overviewMissing')} />

        {permissionDenied ? (
          <Card>
            <Text style={uiStyles.paragraph}>{t('traitFlow.permissionDenied')}</Text>
            <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
          </Card>
        ) : null}

        <Button
          label={plotDraft.overviewPhoto ? t('traitFlow.retakePhoto') : t('traitFlow.takePhoto')}
          onPress={() => void onCapture()}
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button
          label={t('common.next')}
          disabled={!plotDraft.overviewPhoto}
          onPress={() =>
            navigation.navigate('TraitInfections', {
              traitCode: route.params.traitCode,
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
        {!plotDraft.overviewPhoto ? (
          <Text style={styles.helpText}>{t('traitFlow.noOverviewCantContinue')}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

export function TraitInfectionsScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TraitInfections'>) {
  const trait = getTraitDefinition(route.params.traitCode);
  const {
    addInfectionCard,
    getCompletedPlotsCount,
    getTraitPlotDraft,
    removeInfectionCard,
    updateInfectionCard,
  } = useApp();
  const variety = useVariety(route.params.varietyId);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const plotDraft = getTraitPlotDraft(
    route.params.traitCode,
    route.params.varietyId,
    route.params.plotIndex,
  );
  const hasIncompleteCards = plotDraft.infections.some((card) => !card.isComplete);
  const completedPlots = getCompletedPlotsCount(route.params.traitCode, route.params.varietyId);
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
      updateInfectionCard(
        route.params.traitCode,
        route.params.varietyId,
        route.params.plotIndex,
        cardId,
        {
          photoUri: result.uri,
        },
      );
    }
  };

  return (
    <Screen>
      <Title subtitle={subtitle(route.params.traitCode, route.params.plotIndex)}>
        {variety.title}
      </Title>

      <Card>
        <StepIndicator current={2} total={3} />
        <StatPill
          label={`${t('traitFlow.currentStep')}: ${getTraitFlowText(route.params.traitCode, 'step2Title')}`}
        />
        <Text style={styles.metaText}>
          {t('traitFlow.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={uiStyles.paragraph}>{trait.inspectionDescription}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>{trait.sampleTitle}</Text>
        {sampleImages.length ? (
          <Text style={uiStyles.paragraph}>{t('traitFlow.samplesHint')}</Text>
        ) : (
          <EmptyState title={t('traitFlow.noSamples')} description={t('traitFlow.samplesHint')} />
        )}
      </Card>

      {permissionDenied ? (
        <Card>
          <Text style={uiStyles.paragraph}>{t('traitFlow.permissionDenied')}</Text>
          <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionTitle}>
          {getTraitFlowText(route.params.traitCode, 'cardsTitle')}
        </Text>
        {plotDraft.infections.map((card, index) => (
          <View key={card.id} style={styles.infectionCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{cardLabel(route.params.traitCode, index)}</Text>
              <StatPill
                label={
                  card.isComplete ? t('traitFlow.infectionReady') : t('traitFlow.infectionDraft')
                }
                tone={card.isComplete ? 'success' : 'warning'}
              />
            </View>
            <PhotoFrame
              uri={card.photoUri}
              fallback={getTraitFlowText(route.params.traitCode, 'photoHint')}
            />
            <Button
              label={card.photoUri ? t('traitFlow.retakePhoto') : t('traitFlow.takePhoto')}
              variant="secondary"
              onPress={() => void takeCardPhoto(card.id)}
            />
            <Field
              label={t('traitFlow.plantNumber')}
              keyboardType="numeric"
              placeholder={t('traitFlow.plantPlaceholder')}
              value={card.plantNumber}
              onChangeText={(value) =>
                updateInfectionCard(
                  route.params.traitCode,
                  route.params.varietyId,
                  route.params.plotIndex,
                  card.id,
                  {
                    plantNumber: value,
                  },
                )
              }
            />
            <Field
              label={t('traitFlow.rowNumber')}
              keyboardType="numeric"
              placeholder={t('traitFlow.rowPlaceholder')}
              value={card.rowNumber}
              onChangeText={(value) =>
                updateInfectionCard(
                  route.params.traitCode,
                  route.params.varietyId,
                  route.params.plotIndex,
                  card.id,
                  {
                    rowNumber: value,
                  },
                )
              }
            />
            <Button
              label={getTraitFlowText(route.params.traitCode, 'deleteCard')}
              variant="ghost"
              onPress={() =>
                removeInfectionCard(
                  route.params.traitCode,
                  route.params.varietyId,
                  route.params.plotIndex,
                  card.id,
                )
              }
            />
          </View>
        ))}

        <Button
          label={getTraitFlowText(route.params.traitCode, 'addCard')}
          onPress={() =>
            addInfectionCard(
              route.params.traitCode,
              route.params.varietyId,
              route.params.plotIndex,
            )
          }
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button
          label={t('common.next')}
          disabled={hasIncompleteCards}
          onPress={() =>
            navigation.navigate('TraitReview', {
              traitCode: route.params.traitCode,
              varietyId: route.params.varietyId,
              plotIndex: route.params.plotIndex,
            })
          }
        />
        {hasIncompleteCards ? (
          <Text style={styles.helpText}>{t('traitFlow.incompleteHint')}</Text>
        ) : plotDraft.infections.length === 0 ? (
          <Text style={styles.helpText}>{getTraitFlowText(route.params.traitCode, 'empty')}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

export function TraitReviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TraitReview'>) {
  const { confirmTraitPlot, getCompletedPlotsCount, getTraitPlotDraft } = useApp();
  const variety = useVariety(route.params.varietyId);
  const plotDraft = getTraitPlotDraft(
    route.params.traitCode,
    route.params.varietyId,
    route.params.plotIndex,
  );
  const completedPlots = getCompletedPlotsCount(route.params.traitCode, route.params.varietyId);
  const [submitting, setSubmitting] = useState(false);

  if (!variety) {
    return null;
  }

  const submit = () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    confirmTraitPlot(route.params.traitCode, route.params.varietyId, route.params.plotIndex);

    if (route.params.plotIndex < 3) {
      navigation.replace('TraitOverview', {
        traitCode: route.params.traitCode,
        varietyId: route.params.varietyId,
        plotIndex: route.params.plotIndex + 1,
      });
      return;
    }

    navigation.replace('TraitCompletion', {
      traitCode: route.params.traitCode,
      varietyId: route.params.varietyId,
    });
  };

  return (
    <Screen>
      <Title subtitle={subtitle(route.params.traitCode, route.params.plotIndex)}>
        {variety.title}
      </Title>

      <Card>
        <StepIndicator current={3} total={3} />
        <StatPill label={`${t('traitFlow.currentStep')}: ${t('traitFlow.step3Title')}`} />
        <Text style={styles.metaText}>
          {t('traitFlow.donePlots')}: {completedPlots}/3
        </Text>
        <Text style={styles.metaText}>{getSyncStatusText(plotDraft.syncStatus)}</Text>
        <Text style={styles.sectionTitle}>{t('traitFlow.reviewPlotPhoto')}</Text>
        <PhotoFrame uri={plotDraft.overviewPhoto} fallback={t('traitFlow.overviewMissing')} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>
          {getTraitFlowText(route.params.traitCode, 'reviewCards')}
        </Text>
        {plotDraft.infections.length ? (
          plotDraft.infections.map((card, index) => (
            <View key={card.id} style={styles.infectionSummary}>
              <Text style={styles.cardTitle}>{cardLabel(route.params.traitCode, index)}</Text>
              <PhotoFrame
                uri={card.photoUri}
                fallback={getTraitFlowText(route.params.traitCode, 'photoHint')}
              />
              <Text style={uiStyles.paragraph}>
                {t('traitFlow.plantReviewPrefix')} {card.plantNumber || '-'},
                {' '}{t('traitFlow.rowReviewPrefix')} {card.rowNumber || '-'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyState}>{getTraitFlowText(route.params.traitCode, 'empty')}</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.metaText}>
          {plotDraft.syncStatus === 'synced'
            ? t('traitFlow.queueSynced')
            : plotDraft.syncStatus === 'queued'
              ? t('traitFlow.queueQueued')
              : plotDraft.syncStatus === 'syncing'
                ? t('traitFlow.statusProcessing')
                : t('traitFlow.statusIdle')}
        </Text>
        <Button label={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={t('common.next')} disabled={submitting} onPress={() => void submit()} />
      </Card>
    </Screen>
  );
}

export function TraitCompletionScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TraitCompletion'>) {
  const trait = getTraitDefinition(route.params.traitCode);
  const variety = useVariety(route.params.varietyId);

  if (!variety) {
    return null;
  }

  return (
    <Screen>
      <Title subtitle={trait.title}>{variety.title}</Title>

      <Card>
        <Text style={styles.sectionTitle}>{t('traitFlow.completionTitle')}</Text>
        <Text style={uiStyles.paragraph}>{t('traitFlow.completionDescription')}</Text>
      </Card>

      <Card>
        <Button
          label={t('traitFlow.goToVariety')}
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [
                { name: 'MainMenu' },
                { name: 'Varieties' },
                { name: 'VarietyDetail', params: { varietyId: route.params.varietyId } },
              ],
            })
          }
        />
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
