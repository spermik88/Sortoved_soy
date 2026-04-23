import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoadingBlock } from '../components/Ui';
import { v2Copy } from '../config/copy';
import { useV2App } from '../context/V2AppContext';
import { CatalogScreen, VarietyScreen } from '../screens/CatalogScreens';
import { CreationScreen } from '../screens/CreationScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { AuthScreen, StartScreen } from '../screens/StartScreens';
import {
  ChoiceTaskScreen,
  FusariumCardsScreen,
  MeasurementTaskScreen,
  ObservationTaskScreen,
  PendingTaskScreen,
  PhenologyTaskScreen,
  ScoreTaskScreen,
  StructureSamplingTaskScreen,
} from '../screens/TaskScreens';
import { V2RootStackParamList } from './types';

const Stack = createNativeStackNavigator<V2RootStackParamList>();

export function V2AppNavigator() {
  const { hydrated } = useV2App();

  if (!hydrated) {
    return <LoadingBlock label={v2Copy.loading} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Start" component={StartScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Catalog" component={CatalogScreen} />
        <Stack.Screen name="Creation" component={CreationScreen} />
        <Stack.Screen name="Variety" component={VarietyScreen} />
        <Stack.Screen name="FusariumCards" component={FusariumCardsScreen} />
        <Stack.Screen name="ChoiceTask" component={ChoiceTaskScreen} />
        <Stack.Screen name="ScoreTask" component={ScoreTaskScreen} />
        <Stack.Screen name="PhenologyTask" component={PhenologyTaskScreen} />
        <Stack.Screen name="StructureSamplingTask" component={StructureSamplingTaskScreen} />
        <Stack.Screen name="ObservationTask" component={ObservationTaskScreen} />
        <Stack.Screen name="MeasurementTask" component={MeasurementTaskScreen} />
        <Stack.Screen name="PendingTask" component={PendingTaskScreen} />
        <Stack.Screen name="Queue" component={QueueScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
