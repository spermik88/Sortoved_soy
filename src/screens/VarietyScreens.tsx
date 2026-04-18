import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, StatPill, Title } from '../components/Ui';
import { TRAITS } from '../constants/traits';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';

export function VarietiesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Varieties'>) {
  const { state } = useApp();
  const varieties = state.varieties.filter(
    (variety) => variety.sourceMode === state.collectorMode,
  );

  return (
    <Screen>
      <Title subtitle={state.collectorMode === 'test' ? 'Тестовый режим' : undefined}>
        Сорта
      </Title>
      <Card>
        {varieties.length ? (
          varieties.map((variety) => (
            <Button
              key={variety.id}
              label={variety.title}
              onPress={() => navigation.navigate('VarietyDetail', { varietyId: variety.id })}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>Список сортов пока пуст.</Text>
        )}

        <Button
          label="Добавить сорт"
          variant="secondary"
          onPress={() => navigation.navigate('QrScanner', { origin: 'varieties' })}
        />
      </Card>
    </Screen>
  );
}

export function VarietyDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'VarietyDetail'>) {
  const { state, getNextFusariumPlot } = useApp();
  const variety = state.varieties.find((item) => item.id === route.params.varietyId);

  if (!variety) {
    return null;
  }

  return (
    <Screen>
      <Title>{variety.title}</Title>
      <Card>
        <StatPill
          label={
            variety.traitStatuses.fusarium === 'completed'
              ? 'Фузариоз завершен'
              : variety.traitStatuses.fusarium === 'in_progress'
                ? 'Фузариоз в работе'
                : 'Фузариоз не начат'
          }
          tone={
            variety.traitStatuses.fusarium === 'completed'
              ? 'success'
              : variety.traitStatuses.fusarium === 'in_progress'
                ? 'warning'
                : 'neutral'
          }
        />

        {TRAITS.map((trait, index) => {
          const isFusarium = index === 0;
          const completed = isFusarium && variety.traitStatuses.fusarium === 'completed';

          return (
            <Pressable
              key={trait}
              disabled={!isFusarium}
              onPress={() =>
                navigation.navigate('FusariumOverview', {
                  varietyId: variety.id,
                  plotIndex: getNextFusariumPlot(variety.id),
                })
              }
              style={[styles.traitRow, !isFusarium && styles.traitRowDisabled]}
            >
              <Text style={styles.checkbox}>{completed ? '✓' : '○'}</Text>
              <View style={styles.traitTextWrap}>
                <Text style={styles.traitText}>{trait}</Text>
                {!isFusarium ? (
                  <Text style={styles.traitCaption}>Будет реализовано позже</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textMuted,
  },
  traitRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  traitRowDisabled: {
    opacity: 0.55,
  },
  checkbox: {
    fontSize: 20,
    color: colors.accentStrong,
    marginTop: 1,
  },
  traitTextWrap: {
    flex: 1,
    gap: 4,
  },
  traitText: {
    fontSize: 16,
    color: colors.text,
  },
  traitCaption: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
