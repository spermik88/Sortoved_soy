import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  Field,
  PhotoFrame,
  Screen,
  Title,
  uiStyles,
} from '../components/Ui';
import { carouselRegistry } from '../config/carouselRegistry';
import { v2Copy } from '../config/copy';
import { taskDefinitionsByCode } from '../config/flowRegistry';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { locationService } from '../services/locationService';
import { mediaCaptureService } from '../services/mediaCaptureService';
import {
  ChoicePlotDraft,
  FatContentDraft,
  InspectionCardDraft,
  PhenologyPlotDraft,
  ScorePlotDraft,
  SeedWeightPair,
  StructurePlantCardDraft,
  StructureSamplingDraft,
  ThousandSeedWeightDraft,
  ProteinContentDraft,
  YieldPlotDraft,
} from '../types/app';

function useTaskData(varietyId: string, taskCode: string) {
  const ctx = useV2App();
  const variety = ctx.getVariety(varietyId);
  const task = ctx.getTask(varietyId, taskCode);
  const taskDef = taskDefinitionsByCode[taskCode];
  return { ...ctx, variety, task, taskDef };
}

function TaskHeader({
  title,
  subtitle,
  intro,
}: {
  title: string;
  subtitle?: string;
  intro: string;
}) {
  return (
    <>
      <Title subtitle={subtitle}>{title}</Title>
      <Card>
        <Text style={uiStyles.paragraph}>{intro}</Text>
      </Card>
    </>
  );
}

function returnToVariety(
  navigation:
    | NativeStackScreenProps<V2RootStackParamList, 'FusariumCards'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'ChoiceTask'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'ScoreTask'>['navigation']
  | NativeStackScreenProps<V2RootStackParamList, 'YieldTask'>['navigation']
  | NativeStackScreenProps<V2RootStackParamList, 'ThousandSeedWeightTask'>['navigation']
  | NativeStackScreenProps<V2RootStackParamList, 'ProteinContentTask'>['navigation']
  | NativeStackScreenProps<V2RootStackParamList, 'FatContentTask'>['navigation']
  | NativeStackScreenProps<V2RootStackParamList, 'PhenologyTask'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'StructureSamplingTask'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'MeasurementTask'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'ObservationTask'>['navigation']
    | NativeStackScreenProps<V2RootStackParamList, 'PendingTask'>['navigation'],
  varietyId: string,
) {
  navigation.reset({
    index: 1,
    routes: [{ name: 'Catalog' }, { name: 'Variety', params: { varietyId } }],
  });
}

function getDiseaseCardStatusLabel(card: InspectionCardDraft) {
  if (card.syncStatus === 'synced') {
    return v2Copy.taskSyncedCard;
  }
  if (card.syncStatus === 'failed') {
    return v2Copy.taskFailedCard;
  }
  if (card.syncStatus === 'queued') {
    return v2Copy.taskQueuedCard;
  }
  if (card.isComplete) {
    return v2Copy.taskSavedCard;
  }
  return v2Copy.taskDraftCard;
}

function isLockedDiseaseCard(card: InspectionCardDraft) {
  return ['queued', 'synced', 'failed'].includes(card.syncStatus || '');
}

function captureTimestamp() {
  return new Date().toISOString();
}

function getPhenologyStatusLabel(plot: PhenologyPlotDraft) {
  if (plot.isComplete) {
    return 'Готово';
  }
  if (plot.photoUri || plot.confirmed) {
    return 'Черновик';
  }
  return 'Не начато';
}

function getScoreStatusLabel(plot: ScorePlotDraft) {
  if (plot.isComplete) {
    return 'Готово';
  }
  if (plot.photoUri || plot.selectedScore) {
    return 'Черновик';
  }
  return 'Не начато';
}

function getYieldStatusLabel(plot: YieldPlotDraft) {
  if (plot.isComplete) {
    return 'Готово';
  }
  if (plot.rawGrainMassKg || plot.moisturePercent) {
    return 'Черновик';
  }
  return 'Не начато';
}

function getThousandSeedWeightStatusLabel(draft: ThousandSeedWeightDraft) {
  if (draft.analysisStatus === 'invalid' && draft.isComplete) {
    return 'Ошибка анализа';
  }
  if (draft.isComplete) {
    return 'Готово';
  }
  if (draft.sample1Weight || draft.sample2Weight || draft.sample3Weight) {
    return 'Черновик';
  }
  return 'Не начато';
}

function getProteinContentStatusLabel(draft: ProteinContentDraft) {
  if (draft.isComplete) {
    return 'Р“РѕС‚РѕРІРѕ';
  }
  if (draft.sampleMassGrams || draft.proteinPercent) {
    return 'Р§РµСЂРЅРѕРІРёРє';
  }
  return 'РќРµ РЅР°С‡Р°С‚Рѕ';
}

function getFatContentStatusLabel(draft: FatContentDraft) {
  if (draft.isComplete) {
    return 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•';
  }
  if (draft.sampleMassGrams || draft.fatPercent) {
    return 'Р В§Р ВµРЎР‚Р Р…Р С•Р Р†Р С‘Р С”';
  }
  return 'Р СњР Вµ Р Р…Р В°РЎвЂЎР В°РЎвЂљР С•';
}

function getSamplingStatusLabel(sampling: StructureSamplingDraft) {
  if (sampling.isComplete) {
    return 'Готово';
  }
  if (sampling.plot || sampling.cards.length) {
    return 'Черновик';
  }
  return 'Не начато';
}

function getStructureCardStatusLabel(card: StructurePlantCardDraft) {
  return card.isComplete ? 'Готово' : 'Черновик';
}

function TaskSamples({ taskCode }: { taskCode: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const entry = carouselRegistry[taskCode];

  return (
    <Card>
      <Button
        label={expanded ? 'Скрыть образцы' : 'Показать образцы'}
        variant="secondary"
        onPress={() => setExpanded((current) => !current)}
      />
      {expanded ? (
        entry?.available && entry.imageSources.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {entry.imageSources.map((source, index) => (
              <View key={`${entry.assetGroupKey}-${index}`} style={{ width: 220, gap: 8 }}>
                <PhotoFrame source={source} fallback="Изображение недоступно" />
                <Text style={uiStyles.paragraph}>{`${index + 1}/${entry.imageSources.length}`}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={uiStyles.paragraph}>Образцы скоро</Text>
        )
      ) : null}
    </Card>
  );
}

function getChoiceStatusLabel(plot: ChoicePlotDraft) {
  if (plot.isComplete) {
    return 'Готово';
  }
  if (plot.photoUri || plot.selectedValue) {
    return 'Черновик';
  }
  return 'Не начато';
}

export function FusariumCardsScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'FusariumCards'>) {
  const {
    variety,
    task,
    taskDef,
    addTaskCard,
    completeTaskCard,
    updateTaskCard,
    removeTaskCard,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef) {
    return null;
  }

  const captureCardPhoto = async (cardId: string) => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind !== 'success') {
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      updateTaskCard(variety.id, task.code, cardId, {
        photoUri: result.uri,
        note: task.title,
        capturedAt: captureTimestamp(),
        capturedLocation: location,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.taskDiseaseLocationRequired,
      );
    }
  };

  const saveCard = async (cardId: string) => {
    try {
      await completeTaskCard(variety.id, task.code, cardId);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={task.title}
        subtitle={variety.title}
        intro={task.cardsHint || task.intro || v2Copy.fusariumCardsHint}
      />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{`${v2Copy.taskExamplesTitle}: ${task.title}`}</Text>
        <Text style={uiStyles.paragraph}>{v2Copy.taskExamplesBody}</Text>
      </Card>
      <Card>
        {task.cards.map((card, index) => {
          const locked = isLockedDiseaseCard(card);
          return (
            <View key={card.id} style={{ gap: 8, paddingBottom: 16 }}>
              <Text style={uiStyles.paragraph}>
                {v2Copy.taskCard} {index + 1} - {getDiseaseCardStatusLabel(card)}
              </Text>
              <PhotoFrame uri={card.photoUri} fallback={v2Copy.taskCardPhotoMissing} />
              <Button
                label={card.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
                variant="secondary"
                disabled={locked}
                onPress={() => void captureCardPhoto(card.id)}
              />
              <Field
                label={v2Copy.taskPlot}
                value={card.plot || ''}
                editable={!locked}
                onChangeText={(value) =>
                  updateTaskCard(variety.id, task.code, card.id, {
                    plot: value.trim() as '1' | '2' | '3',
                    note: task.title,
                  })
                }
                placeholder={v2Copy.taskPlotPlaceholder}
              />
              <Field
                label={v2Copy.taskRowNumber}
                value={card.rowNumber || ''}
                editable={!locked}
                keyboardType="numeric"
                onChangeText={(value) =>
                  updateTaskCard(variety.id, task.code, card.id, {
                    rowNumber: value,
                    note: task.title,
                  })
                }
              />
              <Field
                label={v2Copy.taskPlantNumber}
                value={card.plantNumber || ''}
                editable={!locked}
                keyboardType="numeric"
                onChangeText={(value) =>
                  updateTaskCard(variety.id, task.code, card.id, {
                    plantNumber: value,
                    note: task.title,
                  })
                }
              />
              <Button
                label={locked ? v2Copy.taskCardReady : v2Copy.taskSaveCard}
                variant={locked ? 'secondary' : 'primary'}
                disabled={locked}
                onPress={() => void saveCard(card.id)}
              />
              {!locked ? (
                <Button
                  label={v2Copy.taskDeleteCard}
                  variant="ghost"
                  onPress={() => removeTaskCard(variety.id, task.code, card.id)}
                />
              ) : null}
            </View>
          );
        })}
        <Button
          label={v2Copy.taskAddInfection}
          onPress={() => addTaskCard(variety.id, task.code)}
        />
        <Button
          label={v2Copy.returnToVariety}
          variant="secondary"
          onPress={() => returnToVariety(navigation, variety.id)}
        />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function PhenologyTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'PhenologyTask'>) {
  const {
    variety,
    task,
    taskDef,
    updatePhenologyPlot,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.phenologyPlots) {
    return null;
  }

  const locked = Boolean(task.completedAt);

  const capturePlotPhoto = async (plot: '1' | '2' | '3') => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind !== 'success') {
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      updatePhenologyPlot(variety.id, task.code, plot, {
        photoUri: result.uri,
        capturedAt: captureTimestamp(),
        capturedLocation: location,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.taskDiseaseLocationRequired,
      );
    }
  };

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={task.title}
        subtitle={variety.title}
        intro={task.intro || ''}
      />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.criterionText || ''}</Text>
        {locked ? (
          <Text style={uiStyles.paragraph}>Шаг сохранен и доступен только для просмотра.</Text>
        ) : null}
      </Card>
      <Card>
        {(['1', '2', '3'] as const).map((plot) => {
          const plotState = task.phenologyPlots?.[plot];
          if (!plotState) {
            return null;
          }

          return (
            <View key={plot} style={{ gap: 8, paddingBottom: 16 }}>
              <Text style={uiStyles.paragraph}>
                {v2Copy.taskPlot} {plot} - {getPhenologyStatusLabel(plotState)}
              </Text>
              <PhotoFrame uri={plotState.photoUri} fallback={v2Copy.taskOverviewMissing} />
              <Button
                label={plotState.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
                variant="secondary"
                disabled={locked}
                onPress={() => void capturePlotPhoto(plot)}
              />
              <Button
                label={
                  plotState.confirmed ? 'Критерий подтвержден' : `Подтвердить: ${taskDef.criterionText}`
                }
                variant={plotState.confirmed ? 'secondary' : 'primary'}
                disabled={locked}
                onPress={() =>
                  updatePhenologyPlot(variety.id, task.code, plot, {
                    confirmed: !plotState.confirmed,
                  })
                }
              />
            </View>
          );
        })}
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function ChoiceTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'ChoiceTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateChoicePlot,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.choicePlots) {
    return null;
  }

  const locked = Boolean(task.completedAt);

  const capturePlotPhoto = async (plot: '1' | '2' | '3') => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind !== 'success') {
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      updateChoicePlot(variety.id, task.code, plot, {
        photoUri: result.uri,
        capturedAt: captureTimestamp(),
        capturedLocation: location,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.taskDiseaseLocationRequired,
      );
    }
  };

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>
          {taskDef.photoHint || 'Сделайте фото признака крупным планом.'}
        </Text>
        {locked ? (
          <Text style={uiStyles.paragraph}>
            Шаг сохранен и доступен только для просмотра.
          </Text>
        ) : null}
      </Card>
      <Card>
        {(['1', '2', '3'] as const).map((plot) => {
          const plotState = task.choicePlots?.[plot];
          if (!plotState) {
            return null;
          }

          return (
            <View key={plot} style={{ gap: 8, paddingBottom: 16 }}>
              <Text style={uiStyles.paragraph}>
                {v2Copy.taskPlot} {plot} - {getChoiceStatusLabel(plotState)}
              </Text>
              <PhotoFrame uri={plotState.photoUri} fallback={v2Copy.taskOverviewMissing} />
              <Button
                label={plotState.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
                variant="secondary"
                disabled={locked}
                onPress={() => void capturePlotPhoto(plot)}
              />
              <View style={{ gap: 8 }}>
                {(taskDef.options || []).map((option) => (
                  <Button
                    key={option}
                    label={option}
                    variant={plotState.selectedValue === option ? 'primary' : 'secondary'}
                    disabled={locked}
                    onPress={() =>
                      updateChoicePlot(variety.id, task.code, plot, {
                        selectedValue: option,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function ScoreTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'ScoreTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateScorePlot,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.scorePlots) {
    return null;
  }

  const locked = Boolean(task.completedAt);

  const capturePlotPhoto = async (plot: '1' | '2' | '3') => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind !== 'success') {
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      updateScorePlot(variety.id, task.code, plot, {
        photoUri: result.uri,
        capturedAt: captureTimestamp(),
        capturedLocation: location,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.taskDiseaseLocationRequired,
      );
    }
  };

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>
          {taskDef.photoHint || 'Сделайте фото делянки целиком перед выставлением оценки.'}
        </Text>
        {locked ? (
          <Text style={uiStyles.paragraph}>
            Шаг сохранен и доступен только для просмотра.
          </Text>
        ) : null}
      </Card>
      <Card>
        {(['1', '2', '3'] as const).map((plot) => {
          const plotState = task.scorePlots?.[plot];
          if (!plotState) {
            return null;
          }

          return (
            <View key={plot} style={{ gap: 8, paddingBottom: 16 }}>
              <Text style={uiStyles.paragraph}>
                {v2Copy.taskPlot} {plot} - {getScoreStatusLabel(plotState)}
              </Text>
              <PhotoFrame uri={plotState.photoUri} fallback={v2Copy.taskOverviewMissing} />
              <Button
                label={plotState.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
                variant="secondary"
                disabled={locked}
                onPress={() => void capturePlotPhoto(plot)}
              />
              <View style={{ gap: 8 }}>
                {(taskDef.scoreOptions || []).map((score) => (
                  <Button
                    key={score}
                    label={score}
                    variant={plotState.selectedScore === score ? 'primary' : 'secondary'}
                    disabled={locked}
                    onPress={() =>
                      updateScorePlot(variety.id, task.code, plot, {
                        selectedScore: score,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          );
        })}
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function YieldTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'YieldTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateYieldPlot,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.yieldPlots) {
    return null;
  }

  const locked = Boolean(task.completedAt);

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.criterionText || ''}</Text>
        {locked ? (
          <Text style={uiStyles.paragraph}>Шаг сохранен и доступен только для просмотра.</Text>
        ) : null}
      </Card>
      <Card>
        {(['1', '2', '3'] as const).map((plot) => {
          const plotState = task.yieldPlots?.[plot];
          if (!plotState) {
            return null;
          }

          return (
            <View key={plot} style={{ gap: 8, paddingBottom: 16 }}>
              <Text style={uiStyles.paragraph}>
                {v2Copy.taskPlot} {plot} - {getYieldStatusLabel(plotState)}
              </Text>
              <Field
                label="Масса сырого зерна, кг"
                value={plotState.rawGrainMassKg || ''}
                editable={!locked}
                keyboardType="numeric"
                onChangeText={(value) =>
                  updateYieldPlot(variety.id, task.code, plot, {
                    rawGrainMassKg: value,
                  })
                }
              />
              <Field
                label="Влажность зерна, %"
                value={plotState.moisturePercent || ''}
                editable={!locked}
                keyboardType="numeric"
                onChangeText={(value) =>
                  updateYieldPlot(variety.id, task.code, plot, {
                    moisturePercent: value,
                  })
                }
              />
              <Field
                label="Площадь делянки, м²"
                value={String(plotState.areaSquareMeters)}
                editable={false}
                onChangeText={() => {}}
              />
              <Field
                label="Урожайность, т/га"
                value={plotState.yieldTonsPerHectare || ''}
                editable={false}
                onChangeText={() => {}}
              />
            </View>
          );
        })}
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function ThousandSeedWeightTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'ThousandSeedWeightTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateThousandSeedWeight,
    selectThousandSeedWeightPair,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.thousandSeedWeight) {
    return null;
  }

  const locked = Boolean(task.completedAt);
  const draft = task.thousandSeedWeight;
  const validPairs = draft.candidatePairs.filter((pair) => pair.isAllowed);

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(
        v2Copy.doneTitle,
        draft.analysisStatus === 'invalid'
          ? 'Шаг сохранен как ошибка анализа и поставлен в локальную очередь.'
          : v2Copy.taskQueuedDone,
      );
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  const setWeight =
    (field: 'sample1Weight' | 'sample2Weight' | 'sample3Weight') =>
    (value: string) =>
      updateThousandSeedWeight(variety.id, task.code, { [field]: value } as Partial<ThousandSeedWeightDraft>);

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.criterionText || ''}</Text>
        <Text style={uiStyles.paragraph}>
          {`Статус шага: ${getThousandSeedWeightStatusLabel(draft)}`}
        </Text>
      </Card>
      <Card>
        <Field
          label="Масса пробы 1, г"
          value={draft.sample1Weight || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={setWeight('sample1Weight')}
        />
        <Field
          label="Масса пробы 2, г"
          value={draft.sample2Weight || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={setWeight('sample2Weight')}
        />
        {draft.requiresThirdSample ? (
          <Field
            label="Масса пробы 3, г"
            value={draft.sample3Weight || ''}
            editable={!locked}
            keyboardType="numeric"
            onChangeText={setWeight('sample3Weight')}
          />
        ) : null}
        <Field
          label="Суммарная масса выбранной пары, г"
          value={draft.sumWeight || ''}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="Фактическое расхождение, г"
          value={draft.actualDifference || ''}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="Допустимое расхождение, г"
          value={draft.allowedDifference || ''}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="Масса 1000 семян, г"
          value={draft.finalWeight || ''}
          editable={false}
          onChangeText={() => {}}
        />
        {draft.requiresThirdSample && validPairs.length > 1 ? (
          <View style={{ gap: 8 }}>
            <Text style={uiStyles.paragraph}>Выберите итоговую пару проб</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {validPairs.map((pair) => (
                <View key={pair.pair} style={{ flex: 1 }}>
                  <Button
                    label={pair.pair}
                    variant={draft.selectedPair === pair.pair ? 'primary' : 'secondary'}
                    disabled={locked}
                    onPress={() =>
                      selectThousandSeedWeightPair(variety.id, task.code, pair.pair as SeedWeightPair)
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {draft.requiresThirdSample && !validPairs.length ? (
          <Text style={uiStyles.paragraph}>
            Допустимая пара проб не найдена. Шаг можно сохранить как ошибку анализа.
          </Text>
        ) : null}
        {!locked ? (
          <Button
            label={
              draft.analysisStatus === 'invalid'
                ? 'Завершить шаг с ошибкой'
                : v2Copy.completeStep
            }
            onPress={() => void saveStep()}
          />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function ProteinContentTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'ProteinContentTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateProteinContent,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.proteinContent) {
    return null;
  }

  const locked = Boolean(task.completedAt);
  const draft = task.proteinContent;

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.criterionText || ''}</Text>
        <Text style={uiStyles.paragraph}>{`РЎС‚Р°С‚СѓСЃ С€Р°РіР°: ${getProteinContentStatusLabel(draft)}`}</Text>
        <Text style={uiStyles.paragraph}>
          {`РЎС‚Р°С‚СѓСЃ РЅР°РІРµСЃРєРё: ${
            draft.sampleToleranceStatus === 'valid' ? 'РІ РґРѕРїСѓСЃРєРµ' : 'РІРЅРµ РґРѕРїСѓСЃРєР°'
          }`}
        </Text>
      </Card>
      <Card>
        <Field
          label="РСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹"
          value={draft.sampleSource}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="РњР°СЃСЃР° РЅР°РІРµСЃРєРё, Рі"
          value={draft.sampleMassGrams || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={(value) =>
            updateProteinContent(variety.id, task.code, { sampleMassGrams: value })
          }
        />
        <Field
          label="РњРµС‚РѕРґ Р°РЅР°Р»РёР·Р°"
          value={draft.analysisMethod}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="РЎРѕРґРµСЂР¶Р°РЅРёРµ Р±РµР»РєР°, %"
          value={draft.proteinPercent || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={(value) =>
            updateProteinContent(variety.id, task.code, { proteinPercent: value })
          }
        />
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function FatContentTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'FatContentTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateFatContent,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.fatContent) {
    return null;
  }

  const locked = Boolean(task.completedAt);
  const draft = task.fatContent;

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.criterionText || ''}</Text>
        <Text style={uiStyles.paragraph}>{`РРЋРЎвЂљРВ°РЎвЂљРЎС“РЎРѓ РЎв‚¬РВ°РС–РВ°: ${getFatContentStatusLabel(draft)}`}</Text>
        <Text style={uiStyles.paragraph}>
          {`Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р Р…Р В°Р Р†Р ВµРЎРѓР С”Р С‘: ${
            draft.sampleToleranceStatus === 'valid' ? 'РР† РТ‘РС•РС—РЎС“РЎРѓРС”РВµ' : 'РР†РР…РВµ РТ‘РС•РС—РЎС“РЎРѓРС”РВ°'
          }`}
        </Text>
      </Card>
      <Card>
        <Field
          label="Р ВРЎРѓРЎвЂљР С•РЎвЂЎР Р…Р С‘Р С” Р С—РЎР‚Р С•Р В±РЎвЂ№"
          value={draft.sampleSource}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="Р СљР В°РЎРѓРЎРѓР В° Р Р…Р В°Р Р†Р ВµРЎРѓР С”Р С‘, Рі"
          value={draft.sampleMassGrams || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={(value) =>
            updateFatContent(variety.id, task.code, { sampleMassGrams: value })
          }
        />
        <Field
          label="Р СљР ВµРЎвЂљР С•Р Т‘ Р В°Р Р…Р В°Р В»Р С‘Р В·Р В°"
          value={draft.analysisMethod}
          editable={false}
          onChangeText={() => {}}
        />
        <Field
          label="Р РЋР С•Р Т‘Р ВµРЎР‚Р В¶Р В°Р Р…Р С‘Р Вµ Р В¶Р С‘РЎР‚Р В°, %"
          value={draft.fatPercent || ''}
          editable={!locked}
          keyboardType="numeric"
          onChangeText={(value) =>
            updateFatContent(variety.id, task.code, { fatPercent: value })
          }
        />
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function StructureSamplingTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'StructureSamplingTask'>) {
  const {
    variety,
    task,
    taskDef,
    updateSamplingPlot,
    addSamplingCard,
    updateSamplingCard,
    removeSamplingCard,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef || !task.samplings) {
    return null;
  }

  const locked = Boolean(task.completedAt);

  const captureCardPhoto = async (samplingId: '1' | '2', cardId: string) => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind !== 'success') {
      return;
    }

    try {
      const location = await locationService.getCurrentLocation();
      updateSamplingCard(variety.id, task.code, samplingId, cardId, {
        photoUri: result.uri,
        capturedAt: captureTimestamp(),
        capturedLocation: location,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.taskDiseaseLocationRequired,
      );
    }
  };

  const saveStep = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader title={task.title} subtitle={variety.title} intro={task.intro || ''} />
      <TaskSamples taskCode={task.code} />
      <Card>
        <Text style={uiStyles.paragraph}>{taskDef.photoHint || 'Сделайте фото растения и внесите значение.'}</Text>
        {locked ? (
          <Text style={uiStyles.paragraph}>Шаг сохранен и доступен только для просмотра.</Text>
        ) : null}
      </Card>
      <Card>
        {(['1', '2'] as const).map((samplingId) => {
          const sampling = task.samplings?.[samplingId];
          if (!sampling) {
            return null;
          }

          return (
            <View key={samplingId} style={{ gap: 12, paddingBottom: 20 }}>
              <Text style={uiStyles.paragraph}>
                {`Выборка ${samplingId} - ${getSamplingStatusLabel(sampling)}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['1', '2', '3'] as const).map((plot) => (
                  <View key={`${samplingId}-${plot}`} style={{ flex: 1 }}>
                    <Button
                      label={`Делянка ${plot}`}
                      variant={sampling.plot === plot ? 'primary' : 'secondary'}
                      disabled={locked}
                      onPress={() => updateSamplingPlot(variety.id, task.code, samplingId, plot)}
                    />
                  </View>
                ))}
              </View>
              {sampling.cards.map((card, index) => (
                <View key={card.id} style={{ gap: 8, paddingBottom: 16 }}>
                  <Text style={uiStyles.paragraph}>
                    {`Растение ${index + 1} - ${getStructureCardStatusLabel(card)}`}
                  </Text>
                  <PhotoFrame uri={card.photoUri} fallback={v2Copy.taskCardPhotoMissing} />
                  <Button
                    label={card.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
                    variant="secondary"
                    disabled={locked}
                    onPress={() => void captureCardPhoto(samplingId, card.id)}
                  />
                  <Field
                    label={v2Copy.taskPlantNumber}
                    value={card.plantNumber || ''}
                    editable={!locked}
                    keyboardType="numeric"
                    onChangeText={(value) =>
                      updateSamplingCard(variety.id, task.code, samplingId, card.id, {
                        plantNumber: value,
                      })
                    }
                  />
                  <Field
                    label={taskDef.valueLabel || 'Значение'}
                    value={card.value || ''}
                    editable={!locked}
                    keyboardType="numeric"
                    onChangeText={(value) =>
                      updateSamplingCard(variety.id, task.code, samplingId, card.id, {
                        value,
                      })
                    }
                  />
                  {!locked ? (
                    <Button
                      label={v2Copy.taskDeleteCard}
                      variant="ghost"
                      onPress={() => removeSamplingCard(variety.id, task.code, samplingId, card.id)}
                    />
                  ) : null}
                </View>
              ))}
              {!locked ? (
                <Button
                  label={`Добавить растение в выборку ${samplingId}`}
                  variant="secondary"
                  onPress={() => addSamplingCard(variety.id, task.code, samplingId)}
                />
              ) : null}
            </View>
          );
        })}
        {!locked ? (
          <Button label={v2Copy.completeStep} onPress={() => void saveStep()} />
        ) : (
          <Button
            label={v2Copy.returnToVariety}
            variant="secondary"
            onPress={() => returnToVariety(navigation, variety.id)}
          />
        )}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}

export function MeasurementTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'MeasurementTask'>) {
  const {
    variety,
    task,
    taskDef,
    addTaskCard,
    updateTaskCard,
    removeTaskCard,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety || !taskDef) {
    return null;
  }

  const captureCardPhoto = async (cardId: string) => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success') {
      updateTaskCard(variety.id, task.code, cardId, { photoUri: result.uri });
    }
  };

  const completeAndQueue = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={task.title}
        subtitle={variety.title}
        intro={task.intro || v2Copy.taskMeasurementHint}
      />
      <Card>
        {task.cards.map((card, index) => (
          <View key={card.id} style={{ gap: 8, paddingBottom: 16 }}>
            <Text style={uiStyles.paragraph}>
              {v2Copy.taskCard} {index + 1}
            </Text>
            <PhotoFrame uri={card.photoUri} fallback={v2Copy.taskCardPhotoMissing} />
            <Button
              label={card.photoUri ? v2Copy.taskRetakeCardPhoto : v2Copy.taskTakeCardPhoto}
              variant="secondary"
              onPress={() => void captureCardPhoto(card.id)}
            />
            <Field
              label={taskDef.valueLabel || v2Copy.measurementValue}
              value={card.value || ''}
              onChangeText={(value) =>
                updateTaskCard(variety.id, task.code, card.id, { value, note: value })
              }
            />
            <Field
              label={v2Copy.taskPlot}
              value={card.plot || ''}
              onChangeText={(value) =>
                updateTaskCard(variety.id, task.code, card.id, {
                  plot: value as '1' | '2' | '3',
                })
              }
              placeholder={v2Copy.taskPlotPlaceholder}
            />
            <Button
              label={v2Copy.taskDeleteCard}
              variant="ghost"
              onPress={() => removeTaskCard(variety.id, task.code, card.id)}
            />
          </View>
        ))}
        <Button label={v2Copy.taskAddCard} onPress={() => addTaskCard(variety.id, task.code)} />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={v2Copy.completeStep} onPress={() => void completeAndQueue()} />
      </Card>
    </Screen>
  );
}

export function ObservationTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'ObservationTask'>) {
  const { variety, task, saveOverviewPhoto, completeTaskLocally, queueTaskSubmission } =
    useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety) {
    return null;
  }

  const capture = async () => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success') {
      saveOverviewPhoto(variety.id, task.code, result.uri);
    }
  };

  const completeAndQueue = async () => {
    try {
      completeTaskLocally(variety.id, task.code);
      await queueTaskSubmission(variety.id, task.code);
      Alert.alert(v2Copy.doneTitle, v2Copy.taskQueuedDone);
      returnToVariety(navigation, variety.id);
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.completeStepFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={task.title}
        subtitle={variety.title}
        intro={task.intro || v2Copy.taskObservationHint}
      />
      <Card>
        <PhotoFrame uri={task.overviewPhotoUri} fallback={v2Copy.taskOverviewMissing} />
        <Button
          label={task.overviewPhotoUri ? v2Copy.taskRetakeOverview : v2Copy.taskTakeOverview}
          onPress={() => void capture()}
        />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={v2Copy.completeStep} onPress={() => void completeAndQueue()} />
      </Card>
    </Screen>
  );
}

export function PendingTaskScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'PendingTask'>) {
  const { variety, task, saveOverviewPhoto, completeTaskLocally } = useTaskData(
    route.params.varietyId,
    route.params.taskCode,
  );

  if (!variety) {
    return null;
  }

  const capture = async () => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success') {
      saveOverviewPhoto(variety.id, task.code, result.uri);
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={task.title}
        subtitle={variety.title}
        intro={v2Copy.placeholderTaskBody}
      />
      <Card>
        <PhotoFrame uri={task.overviewPhotoUri} fallback={v2Copy.taskOverviewMissing} />
        <Button
          label={task.overviewPhotoUri ? v2Copy.taskRetakeOverview : v2Copy.taskTakeOverview}
          onPress={() => void capture()}
        />
        <Button
          label={v2Copy.placeholderContinue}
          onPress={() => {
            try {
              completeTaskLocally(variety.id, task.code);
              returnToVariety(navigation, variety.id);
            } catch (error) {
              Alert.alert(
                v2Copy.errorTitle,
                error instanceof Error ? error.message : v2Copy.saveStepFailed,
              );
            }
          }}
        />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
