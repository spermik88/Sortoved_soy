import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { DISABLED_TRAIT_LABELS, ENABLED_TRAIT_CODES, TRAITS } from '../constants/traits';
import { Button, Card, Screen, StatPill, Title } from '../components/Ui';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { TraitState } from '../types/app';
import { getSyncStatusText } from '../utils/syncStatus';

function getAggregateStatusCopy(status: TraitState) {
  switch (status) {
    case 'completed':
      return { label: t('varieties.aggregateDone'), tone: 'success' as const };
    case 'in_progress':
      return { label: t('varieties.aggregateProgress'), tone: 'warning' as const };
    default:
      return { label: t('varieties.aggregateNotStarted'), tone: 'neutral' as const };
  }
}

export function VarietiesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Varieties'>) {
  const { state } = useApp();
  const varieties = state.varieties.filter(
    (variety) => variety.sourceMode === state.collectorMode,
  );

  return (
    <Screen>
      <Title subtitle={state.collectorMode === 'test' ? t('menu.testMode') : undefined}>
        {t('varieties.title')}
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
          <Text style={styles.emptyText}>{t('varieties.empty')}</Text>
        )}

        <Button
          label={t('varieties.add')}
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
  const {
    state,
    getAggregateTraitState,
    getLatestVarietySyncStatus,
    getNextTraitPlot,
    getTraitCheckboxState,
  } = useApp();
  const variety = state.varieties.find((item) => item.id === route.params.varietyId);

  if (!variety) {
    return null;
  }

  const aggregateState = getAggregateTraitState(variety.id);
  const aggregateCopy = getAggregateStatusCopy(aggregateState);
  const latestStatus = ENABLED_TRAIT_CODES.map((traitCode) =>
    getLatestVarietySyncStatus(traitCode, variety.id),
  ).find((status) => status !== 'idle') || 'idle';

  return (
    <Screen>
      <Title>{variety.title}</Title>
      <Card>
        <StatPill label={aggregateCopy.label} tone={aggregateCopy.tone} />
        <Text style={styles.metaText}>{getSyncStatusText(latestStatus)}</Text>

        {TRAITS.map((trait) => {
          const checkboxState = getTraitCheckboxState(trait.code, variety.id);
          const checkbox =
            checkboxState === 'fully_synced'
              ? '[x][x]'
              : checkboxState === 'completed_pending_sync'
                ? '[x]'
                : '[ ]';

          return (
            <Pressable
              key={trait.code}
              onPress={() =>
                navigation.navigate('TraitOverview', {
                  traitCode: trait.code,
                  varietyId: variety.id,
                  plotIndex: getNextTraitPlot(trait.code, variety.id),
                })
              }
              style={styles.traitRow}
            >
              <Text style={styles.checkbox}>{checkbox}</Text>
              <View style={styles.traitTextWrap}>
                <Text style={styles.traitText}>{trait.title}</Text>
              </View>
            </Pressable>
          );
        })}

        {DISABLED_TRAIT_LABELS.map((label) => (
          <Pressable key={label} disabled style={[styles.traitRow, styles.traitRowDisabled]}>
            <Text style={styles.checkbox}>[ ]</Text>
            <View style={styles.traitTextWrap}>
              <Text style={styles.traitText}>{label}</Text>
              <Text style={styles.traitCaption}>{t('varieties.readyLater')}</Text>
            </View>
          </Pressable>
        ))}
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
  metaText: {
    fontSize: 14,
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
    fontSize: 18,
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
