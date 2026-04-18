import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LoadingBlock } from '../components/Ui';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import {
  FusariumInfectionsScreen,
  FusariumOverviewScreen,
  FusariumReviewScreen,
} from '../screens/FusariumScreens';
import {
  MainMenuScreen,
  QrValidationScreen,
  SettingsScreen,
  TestModeWarningScreen,
} from '../screens/OnboardingScreens';
import { PlaceholderRoleScreen } from '../screens/PlaceholderRoleScreen';
import { QrScannerScreen } from '../screens/QrScannerScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { VarietiesScreen, VarietyDetailScreen } from '../screens/VarietyScreens';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { hydrated, state } = useApp();

  if (!hydrated) {
    return <LoadingBlock label={t('app.loadingState')} />;
  }

  const initialRouteName =
    !state.firstLaunchCompleted || !state.activeRole
      ? 'RoleSelection'
      : state.activeRole === 'collector'
        ? state.collectorMode
          ? 'MainMenu'
          : 'QrScanner'
        : 'PlaceholderRole';

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen
          name="PlaceholderRole"
          component={PlaceholderRoleScreen}
          initialParams={{
            role: state.activeRole === 'manager' ? 'manager' : 'analyst',
          }}
        />
        <Stack.Screen
          name="QrScanner"
          component={QrScannerScreen}
          initialParams={{ origin: 'onboarding' }}
        />
        <Stack.Screen name="QrValidation" component={QrValidationScreen} />
        <Stack.Screen name="TestModeWarning" component={TestModeWarningScreen} />
        <Stack.Screen name="MainMenu" component={MainMenuScreen} />
        <Stack.Screen name="Varieties" component={VarietiesScreen} />
        <Stack.Screen name="VarietyDetail" component={VarietyDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="FusariumOverview" component={FusariumOverviewScreen} />
        <Stack.Screen name="FusariumInfections" component={FusariumInfectionsScreen} />
        <Stack.Screen name="FusariumReview" component={FusariumReviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
