import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { showToast } from '../utils/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'QrScanner'>;

export function QrScannerScreen({ navigation, route }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { scanQr } = useApp();

  const subtitle = useMemo(() => {
    switch (route.params.origin) {
      case 'settings':
        return t('qr.subtitleSettings');
      case 'varieties':
        return t('qr.subtitleVarieties');
      default:
        return t('qr.subtitleOnboarding');
    }
  }, [route.params.origin]);

  if (!permission) {
    return (
      <Screen scroll={false}>
        <Title>{t('qr.title')}</Title>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Title subtitle={subtitle}>{t('qr.title')}</Title>
        <Card>
          <Text style={styles.text}>{t('qr.noPermission')}</Text>
          <Button label={t('qr.requestPermission')} onPress={() => void requestPermission()} />
          <Button
            label={t('qr.skip')}
            variant="ghost"
            onPress={() => navigation.navigate('TestModeWarning')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title subtitle={subtitle}>{t('qr.title')}</Title>

      <Card>
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={
              scanned
                ? undefined
                : ({ data }) => {
                    setScanned(true);
                    const result = scanQr(data);

                    if (result.invalid) {
                      setError(result.invalid);
                      setScanned(false);
                      return;
                    }

                    if (result.duplicate) {
                      showToast(t('qr.duplicate'));
                      setScanned(false);
                      return;
                    }

                    navigation.replace('QrValidation');
                  }
            }
          />
        </View>

        <Text style={styles.text}>{t('qr.scanHint')}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={t('qr.rescan')}
          variant="secondary"
          onPress={() => {
            setError(null);
            setScanned(false);
          }}
        />
        <Button
          label={t('qr.skip')}
          variant="ghost"
          onPress={() => navigation.navigate('TestModeWarning')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.text,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
  },
});
