import React from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, EmptyState, Screen, StatPill, Title, uiStyles } from '../components/Ui';
import { taskStatusLabels, v2Copy } from '../config/copy';
import { taskDefinitions } from '../config/flowRegistry';
import { useV2App } from '../context/V2AppContext';
import { V2RootStackParamList } from '../navigation/types';
import { InspectionTask } from '../types/app';

function getTaskStatusLabel(task: InspectionTask | undefined) {
  return taskStatusLabels[task?.uiStatus || 'not_started'];
}

export function CatalogScreen({
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Catalog'>) {
  const { state } = useV2App();

  return (
    <Screen>
      <Title>{v2Copy.catalogTitle}</Title>
      <Card>
        {state.catalog.length ? (
          state.catalog.map((variety) => (
            <Button
              key={variety.id}
              label={variety.title}
              onPress={() => navigation.navigate('Variety', { varietyId: variety.id })}
            />
          ))
        ) : (
          <EmptyState title={v2Copy.catalogEmptyTitle} description={v2Copy.catalogEmptyBody} />
        )}
        <Button
          label={v2Copy.catalogAdd}
          variant="secondary"
          onPress={() => navigation.navigate('Start')}
        />
      </Card>
    </Screen>
  );
}

export function VarietyScreen({
  route,
  navigation,
}: NativeStackScreenProps<V2RootStackParamList, 'Variety'>) {
  const { getVariety, state } = useV2App();
  const variety = getVariety(route.params.varietyId);

  if (!variety) {
    return null;
  }

  const openTask = (taskCode: string) => {
    const taskDef = taskDefinitions.find((item) => item.code === taskCode);
    if (!taskDef) {
      Alert.alert(v2Copy.errorTitle, v2Copy.stepNotFound);
      return;
    }

    if (taskDef.flowKind === 'disease_cards') {
      navigation.navigate('FusariumCards', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'choice_by_plot') {
      navigation.navigate('ChoiceTask', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'score_by_plot') {
      navigation.navigate('ScoreTask', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'phenology_by_plot') {
      navigation.navigate('PhenologyTask', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'structure_by_sampling') {
      navigation.navigate('StructureSamplingTask', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'measurement_cards') {
      navigation.navigate('MeasurementTask', { varietyId: variety.id, taskCode });
      return;
    }

    if (taskDef.flowKind === 'observation_single') {
      navigation.navigate('ObservationTask', { varietyId: variety.id, taskCode });
      return;
    }

    navigation.navigate('PendingTask', { varietyId: variety.id, taskCode });
  };

  return (
    <Screen>
      <Title subtitle={variety.binding.spreadsheetUrl}>{variety.title}</Title>
      <Card>
        <StatPill
          label={
            variety.status === 'ready'
              ? v2Copy.varietyStatusReady
              : variety.status === 'syncing'
                ? v2Copy.varietyStatusSyncing
                : variety.status === 'error'
                  ? `${v2Copy.varietyStatusErrorPrefix}: ${variety.lastError || v2Copy.unknownError}`
                  : v2Copy.varietyStatusDraft
          }
          tone={
            variety.status === 'ready'
              ? 'success'
              : variety.status === 'error'
                ? 'warning'
                : 'neutral'
          }
        />
        <Text style={uiStyles.paragraph}>{v2Copy.varietyIntro}</Text>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={`${v2Copy.varietyCalendar} • ${v2Copy.disabledSoon}`}
              disabled
              onPress={() => {}}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={`${v2Copy.varietyStats} • ${v2Copy.disabledSoon}`}
              disabled
              onPress={() => {}}
            />
          </View>
        </View>
        {taskDefinitions.map((task) => {
          const draft = state.inspections[variety.id]?.[task.code];
          return (
            <Button
              key={task.code}
              label={`${task.code}. ${task.title} - ${getTaskStatusLabel(draft)}`}
              variant="secondary"
              onPress={() => openTask(task.code)}
            />
          );
        })}
        <Button label={v2Copy.back} variant="ghost" onPress={() => navigation.goBack()} />
      </Card>
    </Screen>
  );
}
