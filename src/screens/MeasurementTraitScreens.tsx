import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  Field,
  PhotoFrame,
  Screen,
  StepIndicator,
  Title,
  uiStyles,
} from '../components/Ui';
import { getMeasurementCarouselConfig } from '../constants/measurementCarousel';
import { getTraitDefinition } from '../constants/traits';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { cameraService } from '../services/cameraService';

function useVariety(varietyId: string) {
  const { state } = useApp();
  return state.varieties.find((variety) => variety.id === varietyId) || null;
}

function getSubplotKey(step: 1 | 2 | 3 | 4): 'A' | 'B' {
  return step === 1 || step === 2 ? 'A' : 'B';
}

function sanitizeNumeric(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function isPlantCountValid(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0;
}

function getMeasurementCardTitle(shortTitle: string, index: number) {
  return `${shortTitle} · ${t('measurementFlow.measurementTitle')} ${index + 1}`;
}

export function MeasurementTraitFlowScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'MeasurementTraitFlow'>) {
  const trait = getTraitDefinition(route.params.traitCode);
  const variety = useVariety(route.params.varietyId);
  const {
    addMeasurementCard,
    completeMeasurementCard,
    completeMeasurementTrait,
    confirmMeasurementSubplotPhoto,
    getMeasurementTraitDraft,
    saveMeasurementSubplotPhoto,
    setMeasurementCurrentStep,
    setMeasurementSubplotPlantCount,
    toggleMeasurementCardCollapsed,
    updateMeasurementCard,
  } = useApp();
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    setMeasurementCurrentStep(route.params.traitCode, route.params.varietyId, route.params.step);
  }, [route.params.step, route.params.traitCode, route.params.varietyId]);

  if (!variety) {
    return null;
  }

  const draft = getMeasurementTraitDraft(route.params.traitCode, route.params.varietyId);
  const subplotKey = getSubplotKey(route.params.step);
  const subplot = subplotKey === 'A' ? draft?.subplotA : draft?.subplotB;

  if (!subplot) {
    return null;
  }

  const plantCountValid = isPlantCountValid(subplot.plantCount);
  const hasIncompleteCard = subplot.measurements.some((card) => !card.isComplete);
  const canAddMeasurement =
    plantCountValid &&
    !hasIncompleteCard &&
    subplot.measurements.length < Number.parseInt(subplot.plantCount, 10);
  const carouselConfig =
    route.params.step === 2 || route.params.step === 4
      ? getMeasurementCarouselConfig(route.params.traitCode, route.params.step)
      : null;

  const nextDisabled = useMemo(() => {
    if (route.params.step === 1 || route.params.step === 3) {
      return !(subplot.photoConfirmed && plantCountValid);
    }

    return hasIncompleteCard;
  }, [hasIncompleteCard, plantCountValid, route.params.step, subplot.photoConfirmed]);

  const goNext = () => {
    if (route.params.step === 4) {
      completeMeasurementTrait(route.params.traitCode, route.params.varietyId);
      navigation.replace('MeasurementTraitCompletion', {
        traitCode: route.params.traitCode,
        varietyId: route.params.varietyId,
      });
      return;
    }

    navigation.navigate('MeasurementTraitFlow', {
      traitCode: route.params.traitCode,
      varietyId: route.params.varietyId,
      step: (route.params.step + 1) as 1 | 2 | 3 | 4,
    });
  };

  const goBack = () => {
    if (route.params.step === 1) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MeasurementTraitFlow', {
      traitCode: route.params.traitCode,
      varietyId: route.params.varietyId,
      step: (route.params.step - 1) as 1 | 2 | 3 | 4,
    });
  };

  const captureSubplotPhoto = async () => {
    const result = await cameraService.capturePhoto();

    if (result.kind === 'permission_denied') {
      setPermissionDenied(true);
      return;
    }

    if (result.kind === 'success') {
      saveMeasurementSubplotPhoto(
        route.params.traitCode,
        route.params.varietyId,
        subplotKey,
        result.uri,
      );
    }
  };

  const captureCardPhoto = async (cardId: string) => {
    const result = await cameraService.capturePhoto();

    if (result.kind === 'permission_denied') {
      setPermissionDenied(true);
      return;
    }

    if (result.kind === 'success') {
      updateMeasurementCard(
        route.params.traitCode,
        route.params.varietyId,
        subplotKey,
        cardId,
        { photoUri: result.uri },
      );
    }
  };

  const stepTitle =
    route.params.step === 1
      ? t('measurementFlow.step1Title')
      : route.params.step === 2
        ? t('measurementFlow.step2Title')
        : route.params.step === 3
          ? t('measurementFlow.step3Title')
          : t('measurementFlow.step4Title');

  return (
    <Screen>
      <Title subtitle={trait.shortTitle}>{variety.title}</Title>

      <Card>
        <StepIndicator current={route.params.step} total={4} />
        <Text style={styles.stepLabel}>{stepTitle}</Text>
        <Text style={styles.subplotLabel}>
          {t('measurementFlow.subplotLabel')} {subplotKey}
        </Text>
      </Card>

      {route.params.step === 1 || route.params.step === 3 ? (
        <Card>
          <Text style={uiStyles.paragraph}>
            {t(
              subplotKey === 'A'
                ? 'measurementFlow.subplotAInstruction'
                : 'measurementFlow.subplotBInstruction',
            )}
          </Text>
          <PhotoFrame uri={subplot.photoUri} fallback={t('measurementFlow.subplotPhotoMissing')} />
          {permissionDenied ? (
            <Card>
              <Text style={uiStyles.paragraph}>{t('traitFlow.permissionDenied')}</Text>
              <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
            </Card>
          ) : null}
          {!subplot.photoConfirmed ? (
            <>
              <Button
                label={subplot.photoUri ? t('measurementFlow.confirmPlotPhoto') : t('traitFlow.takePhoto')}
                onPress={() =>
                  subplot.photoUri
                    ? confirmMeasurementSubplotPhoto(
                        route.params.traitCode,
                        route.params.varietyId,
                        subplotKey,
                      )
                    : void captureSubplotPhoto()
                }
              />
              {subplot.photoUri ? (
                <Button
                  label={t('measurementFlow.retakePlotPhoto')}
                  variant="secondary"
                  onPress={() => void captureSubplotPhoto()}
                />
              ) : null}
            </>
          ) : (
            <Text style={styles.lockedHint}>{t('measurementFlow.photoLocked')}</Text>
          )}
          <Field
            label={t('measurementFlow.plantCountLabel')}
            keyboardType="numeric"
            placeholder={t('measurementFlow.plantCountPlaceholder')}
            value={subplot.plantCount}
            onChangeText={(value) =>
              setMeasurementSubplotPlantCount(
                route.params.traitCode,
                route.params.varietyId,
                subplotKey,
                sanitizeNumeric(value),
              )
            }
          />
          {!plantCountValid && subplot.plantCount ? (
            <Text style={styles.helpText}>{t('measurementFlow.plantCountInvalid')}</Text>
          ) : null}
          <Button label={t('common.back')} variant="ghost" onPress={goBack} />
          <Button label={t('common.next')} disabled={nextDisabled} onPress={goNext} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.measurementTitle}>{trait.shortTitle}</Text>
            <Text style={uiStyles.paragraph}>{trait.inspectionDescription}</Text>
          </Card>

          <Card>
            <Text style={styles.measurementTitle}>{t('measurementFlow.examplesTitle')}</Text>
            <Text style={styles.carouselCaption}>
              {t('measurementFlow.carouselFolderPrefix')} {carouselConfig?.folder}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
              {Array.from({ length: carouselConfig?.placeholderCount || 0 }).map((_, index) => (
                <View key={index} style={styles.carouselPlaceholder}>
                  <Text style={styles.carouselPlaceholderText}>
                    {t('measurementFlow.examplePlaceholder')} {index + 1}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Card>

          {permissionDenied ? (
            <Card>
              <Text style={uiStyles.paragraph}>{t('traitFlow.permissionDenied')}</Text>
              <Button label={t('common.openSettings')} onPress={() => void Linking.openSettings()} />
            </Card>
          ) : null}

          <Card>
            <Text style={styles.measurementTitle}>
              {t('measurementFlow.expectedMeasurementsPrefix')} {subplot.plantCount || '0'}
            </Text>
            {subplot.measurements.map((card, index) => (
              <View key={card.id} style={styles.measurementCard}>
                <Pressable
                  onPress={() =>
                    card.isComplete
                      ? toggleMeasurementCardCollapsed(
                          route.params.traitCode,
                          route.params.varietyId,
                          subplotKey,
                          card.id,
                        )
                      : undefined
                  }
                  style={styles.measurementHeader}
                >
                  <Text style={styles.cardTitle}>
                    {getMeasurementCardTitle(trait.shortTitle, index)}
                  </Text>
                  <Text style={styles.cardState}>
                    {card.isComplete
                      ? card.isCollapsed
                        ? t('measurementFlow.expandCard')
                        : t('measurementFlow.collapseCard')
                      : t('measurementFlow.draftState')}
                  </Text>
                </Pressable>

                {!card.isCollapsed ? (
                  <>
                    <PhotoFrame
                      uri={card.photoUri}
                      fallback={t('measurementFlow.measurementPhotoMissing')}
                    />
                    {card.isComplete ? null : (
                      <Button
                        label={card.photoUri ? t('measurementFlow.retakeMeasurementPhoto') : t('traitFlow.takePhoto')}
                        variant="secondary"
                        onPress={() => void captureCardPhoto(card.id)}
                      />
                    )}
                    <Field
                      label={t('measurementFlow.valueLabel')}
                      keyboardType="numeric"
                      placeholder={t('measurementFlow.valuePlaceholder')}
                      value={card.value}
                      editable={!card.isComplete}
                      onChangeText={(value) =>
                        card.isComplete
                          ? undefined
                          : updateMeasurementCard(
                              route.params.traitCode,
                              route.params.varietyId,
                              subplotKey,
                              card.id,
                              { value: sanitizeNumeric(value) },
                            )
                      }
                    />
                    {card.isComplete ? (
                      <Text style={styles.lockedHint}>{t('measurementFlow.cardLocked')}</Text>
                    ) : (
                      <Button
                        label={t('measurementFlow.saveMeasurement')}
                        disabled={!card.photoUri || !card.value.trim()}
                        onPress={() =>
                          completeMeasurementCard(
                            route.params.traitCode,
                            route.params.varietyId,
                            subplotKey,
                            card.id,
                          )
                        }
                      />
                    )}
                  </>
                ) : null}
              </View>
            ))}

            <Button
              label={t('measurementFlow.addMeasurement')}
              onPress={() =>
                addMeasurementCard(route.params.traitCode, route.params.varietyId, subplotKey)
              }
              disabled={!canAddMeasurement}
            />
            {!canAddMeasurement ? (
              <Text style={styles.helpText}>
                {hasIncompleteCard
                  ? t('measurementFlow.finishCurrentCardHint')
                  : t('measurementFlow.measurementLimitHint')}
              </Text>
            ) : null}
            <Button label={t('common.back')} variant="ghost" onPress={goBack} />
            <Button
              label={route.params.step === 4 ? t('measurementFlow.finishTrait') : t('common.next')}
              disabled={nextDisabled}
              onPress={goNext}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

export function MeasurementTraitCompletionScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'MeasurementTraitCompletion'>) {
  const trait = getTraitDefinition(route.params.traitCode);
  const variety = useVariety(route.params.varietyId);

  if (!variety) {
    return null;
  }

  return (
    <Screen>
      <Title subtitle={trait.shortTitle}>{variety.title}</Title>
      <Card>
        <Text style={styles.measurementTitle}>{t('measurementFlow.completionTitle')}</Text>
        <Text style={uiStyles.paragraph}>{t('measurementFlow.completionDescription')}</Text>
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
  stepLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subplotLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  measurementTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  helpText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  lockedHint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  carouselCaption: {
    fontSize: 13,
    color: colors.textMuted,
  },
  carouselRow: {
    gap: 12,
    paddingRight: 4,
  },
  carouselPlaceholder: {
    width: 180,
    height: 140,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F1E8D5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  carouselPlaceholderText: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  measurementCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    gap: 10,
    backgroundColor: '#FFFDF8',
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardState: {
    fontSize: 13,
    color: colors.accentStrong,
  },
});
