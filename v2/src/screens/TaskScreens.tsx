import React from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  Button,
  Card,
  Field,
  LinkText,
  PhotoFrame,
  Screen,
  Title,
  uiStyles,
} from '../components/Ui';
import { v2Copy } from '../config/copy';
import { taskDefinitionsByCode } from '../config/flowRegistry';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { mediaCaptureService } from '../services/mediaCaptureService';

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

export function FusariumOverviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'FusariumOverview'>) {
  const { variety, task, saveOverviewPhoto, markOverviewComplete } = useTaskData(
    route.params.varietyId,
    route.params.taskCode,
  );

  if (!variety) {
    return null;
  }

  const captureOverview = async () => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success') {
      saveOverviewPhoto(variety.id, task.code, result.uri);
    }
  };

  const continueToCards = async () => {
    try {
      markOverviewComplete(variety.id, task.code);
      navigation.navigate('FusariumCards', {
        varietyId: variety.id,
        taskCode: task.code,
      });
    } catch (error) {
      Alert.alert(
        v2Copy.errorTitle,
        error instanceof Error ? error.message : v2Copy.continueFailed,
      );
    }
  };

  return (
    <Screen>
      <TaskHeader
        title={v2Copy.fusariumOverviewTitle}
        subtitle={variety.title}
        intro={task.overviewHint || v2Copy.fusariumOverviewHint}
      />
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.taskSourcePlotPhoto}</Text>
        <PhotoFrame
          uri={variety.setup?.plotPhotos?.['1']}
          fallback={v2Copy.taskSourcePlotPhotoMissing}
        />
      </Card>
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.taskSourceMap}</Text>
        <LinkText
          label={variety.setup?.mapsUrl ? v2Copy.taskOpenMap : v2Copy.taskSourceMapMissing}
          url={variety.setup?.mapsUrl}
        />
      </Card>
      <Card>
        <PhotoFrame uri={task.overviewPhotoUri} fallback={v2Copy.taskOverviewMissing} />
        <Button
          label={task.overviewPhotoUri ? v2Copy.taskRetakeOverview : v2Copy.taskTakeOverview}
          onPress={() => void captureOverview()}
        />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={v2Copy.goToCards} onPress={() => void continueToCards()} />
      </Card>
    </Screen>
  );
}

export function FusariumCardsScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'FusariumCards'>) {
  const {
    variety,
    task,
    addTaskCard,
    completeTaskCard,
    updateTaskCard,
    removeTaskCard,
    completeTaskLocally,
    queueTaskSubmission,
  } = useTaskData(route.params.varietyId, route.params.taskCode);

  if (!variety) {
    return null;
  }

  const captureCardPhoto = async (cardId: string) => {
    const result = await mediaCaptureService.capturePhoto();
    if (result.kind === 'success') {
      updateTaskCard(variety.id, task.code, cardId, {
        photoUri: result.uri,
        note: task.title,
      });
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
        title={v2Copy.fusariumCardsTitle}
        subtitle={variety.title}
        intro={task.cardsHint || v2Copy.fusariumCardsHint}
      />
      <Card>
        <Text style={uiStyles.paragraph}>{v2Copy.taskExamplesTitle}</Text>
        <Text style={uiStyles.paragraph}>{v2Copy.taskExamplesBody}</Text>
      </Card>
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
              disabled={card.isComplete}
              onPress={() => void captureCardPhoto(card.id)}
            />
            <Field
              label={v2Copy.taskPlantNumber}
              value={card.plantNumber || ''}
              editable={!card.isComplete}
              keyboardType="numeric"
              onChangeText={(value) =>
                updateTaskCard(variety.id, task.code, card.id, { plantNumber: value, note: task.title })
              }
            />
            <Field
              label={v2Copy.taskRowNumber}
              value={card.rowNumber || ''}
              editable={!card.isComplete}
              keyboardType="numeric"
              onChangeText={(value) =>
                updateTaskCard(variety.id, task.code, card.id, { rowNumber: value, note: task.title })
              }
            />
            <Button
              label={card.isComplete ? v2Copy.taskCardReady : v2Copy.taskCompleteCard}
              variant={card.isComplete ? 'secondary' : 'primary'}
              disabled={card.isComplete}
              onPress={() => completeTaskCard(variety.id, task.code, card.id)}
            />
            <Button
              label={v2Copy.taskDeleteCard}
              variant="ghost"
              onPress={() => removeTaskCard(variety.id, task.code, card.id)}
            />
          </View>
        ))}
        <Button
          label={v2Copy.taskAddInfection}
          onPress={() => addTaskCard(variety.id, task.code)}
        />
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
        <Button label={v2Copy.completeStep} onPress={() => void completeAndQueue()} />
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
