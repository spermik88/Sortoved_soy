import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
import { v2Copy } from '../config/copy';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { mediaCaptureService } from '../services/mediaCaptureService';

export function CreationScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Creation'>) {
  const {
    state,
    creationStepIndex,
    currentCreationStep,
    updateCreationDraft,
    updatePlotDraft,
    nextCreationStep,
    prevCreationStep,
    captureLocation,
  } = useV2App();
  const draft = state.creationDraft;
  const [driveConsentAccepted, setDriveConsentAccepted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!draft) {
      navigation.replace('Start');
    }
  }, [draft, navigation]);

  if (!draft) {
    return null;
  }

  const isLast = creationStepIndex === 17;
  const currentPlot = currentCreationStep.plot;
  const plotDraft = currentPlot ? draft.plots[currentPlot] : undefined;

  const canContinue =
    isLast && !driveConsentAccepted
      ? false
      : currentCreationStep.type === 'text'
      ? Boolean(draft.varietyName.trim())
      : currentCreationStep.type === 'location'
        ? Boolean(draft.mapsUrl)
        : currentCreationStep.type === 'choice'
          ? Boolean(plotDraft?.[currentCreationStep.field as 'rowSpacing' | 'rowCount'])
          : currentCreationStep.type === 'photo'
            ? Boolean(plotDraft?.photoUri)
            : true;

  const onNext = async () => {
    setSubmitError(null);
    try {
      if (isLast) {
        navigation.navigate('CreationCloudSync');
        return;
      }

      await nextCreationStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : v2Copy.saveStepFailed;
      setSubmitError(message);
      Alert.alert(
        v2Copy.errorTitle,
        message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const takePhoto = async () => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success' && currentPlot) {
      updatePlotDraft(currentPlot, { photoUri: result.uri });
    }
  };

  return (
    <Screen>
      <Title subtitle={currentCreationStep.description}>{currentCreationStep.title}</Title>
      <Card>
        <StepIndicator current={creationStepIndex + 1} total={18} />
        <Text style={uiStyles.paragraph}>{currentCreationStep.description}</Text>
      </Card>

      <Card>
        {currentCreationStep.type === 'text' ? (
          <Field
            label={v2Copy.creationNameLabel}
            value={draft.varietyName}
            onChangeText={(value) => updateCreationDraft({ varietyName: value })}
            placeholder={v2Copy.creationNamePlaceholder}
          />
        ) : null}

        {currentCreationStep.type === 'date' ? (
          <>
            <Field
              label={v2Copy.creationDateLabel}
              value={draft.creationDate || ''}
              onChangeText={(value) => updateCreationDraft({ creationDate: value })}
              placeholder={v2Copy.creationDatePlaceholder}
            />
            <Field
              label={v2Copy.creationSowingLabel}
              value={draft.sowingDate || ''}
              onChangeText={(value) => updateCreationDraft({ sowingDate: value })}
              placeholder={v2Copy.creationDatePlaceholder}
            />
          </>
        ) : null}

        {currentCreationStep.type === 'location' ? (
          <>
            <Text style={uiStyles.paragraph}>
              {draft.mapsUrl
                ? `${v2Copy.creationCurrentLocation}: ${draft.latitude}, ${draft.longitude}`
                : v2Copy.creationLocationMissing}
            </Text>
            <Button label={v2Copy.creationLocationButton} onPress={() => void captureLocation()} />
          </>
        ) : null}

        {currentCreationStep.type === 'confirm' && currentPlot ? (
          <Button
            label={
              plotDraft?.[
                currentCreationStep.field as 'areaConfirmed' | 'plantSpacingConfirmed'
              ]
                ? v2Copy.creationConfirmed
                : v2Copy.creationConfirm
            }
            onPress={() =>
              updatePlotDraft(currentPlot, {
                [currentCreationStep.field]: true,
              })
            }
          />
        ) : null}

        {currentCreationStep.type === 'choice' && currentPlot ? (
          <View style={{ gap: 8 }}>
            {currentCreationStep.options?.map((option) => (
              <Button
                key={option}
                label={option}
                variant={
                  plotDraft?.[
                    currentCreationStep.field as 'rowSpacing' | 'rowCount'
                  ] === option
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() =>
                  updatePlotDraft(currentPlot, {
                    [currentCreationStep.field]: option,
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {currentCreationStep.type === 'photo' && currentPlot ? (
          <>
            <PhotoFrame
              uri={plotDraft?.photoUri}
              fallback={v2Copy.creationPhotoMissing}
            />
            <Button
              label={plotDraft?.photoUri ? v2Copy.creationRetakePhoto : v2Copy.creationTakePhoto}
              onPress={() => void takePhoto()}
            />
          </>
        ) : null}

        {isLast ? (
          <View style={{ gap: 8 }}>
            <Text style={uiStyles.paragraph}>
              Я подтверждаю, что в моем Google Drive есть свободное место для хранения фотографий сорта. Я разрешаю приложению создать папку Sortoved, папку сорта и папки шагов, а также открыть папку сорта по ссылке для участников работы.
            </Text>
            <Button
              label={driveConsentAccepted ? 'Согласие подтверждено' : 'Подтвердить согласие Drive'}
              variant={driveConsentAccepted ? 'primary' : 'secondary'}
              onPress={() => setDriveConsentAccepted((current) => !current)}
            />
          </View>
        ) : null}

        <Button
          label={v2Copy.back}
          variant="ghost"
          onPress={() => (creationStepIndex === 0 ? navigation.goBack() : prevCreationStep())}
        />
        <Button
          label={isLast ? v2Copy.createVariety : v2Copy.next}
          disabled={!canContinue || submitting}
          onPress={() => void onNext()}
        />
        {submitError ? <Text style={[uiStyles.paragraph, { color: '#9E2B25' }]}>{submitError}</Text> : null}
      </Card>
    </Screen>
  );
}
