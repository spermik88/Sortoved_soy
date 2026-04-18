import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, StatPill, Title } from '../components/Ui';
import { TRAITS } from '../constants/traits';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { getSyncStatusText } from '../utils/syncStatus';

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
    getCompletedPlotsCount,
    getLatestVarietySyncStatus,
    getNextFusariumPlot,
  } = useApp();
  const variety = state.varieties.find((item) => item.id === route.params.varietyId);

  if (!variety) {
    return null;
  }

  const completedPlots = getCompletedPlotsCount(variety.id);
  const latestStatus = getLatestVarietySyncStatus(variety.id);

  return (
    <Screen>
      <Title>{variety.title}</Title>
      <Card>
        <StatPill
          label={
            variety.traitStatuses.fusarium === 'completed'
              ? t('varieties.fusariumDone')
              : variety.traitStatuses.fusarium === 'in_progress'
                ? t('varieties.fusariumProgress')
                : t('varieties.fusariumNotStarted')
          }
          tone={
            variety.traitStatuses.fusarium === 'completed'
              ? 'success'
              : variety.traitStatuses.fusarium === 'in_progress'
                ? 'warning'
                : 'neutral'
          }
        />
        <Text style={styles.metaText}>
          {t('varieties.syncedPlots')}: {completedPlots}/3
        </Text>
        <Text style={styles.metaText}>{getSyncStatusText(latestStatus)}</Text>

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
              <Text style={styles.checkbox}>{completed ? '[x]' : '[ ]'}</Text>
              <View style={styles.traitTextWrap}>
                <Text style={styles.traitText}>{trait}</Text>
                {!isFusarium ? (
                  <Text style={styles.traitCaption}>{t('varieties.readyLater')}</Text>
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
