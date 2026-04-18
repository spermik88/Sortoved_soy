import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button, Card, Screen, Title } from '../components/Ui';
import { colors } from '../constants/theme';
import { useApp } from '../context/AppContext';
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
        return 'Отсканируйте ссылку на Google Таблицу аналитика';
      case 'varieties':
        return 'Добавьте еще один сорт через QR-код';
      default:
        return 'Привяжите аккаунт сборщика к таблице аналитика';
    }
  }, [route.params.origin]);

  if (!permission) {
    return (
      <Screen scroll={false}>
        <Title>Сканирование QR-кода</Title>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Title subtitle={subtitle}>Сканирование QR-кода</Title>
        <Card>
          <Text style={styles.text}>
            Без доступа к камере приложение не сможет считать QR-код аналитика.
          </Text>
          <Button label="Разрешить доступ к камере" onPress={() => void requestPermission()} />
          <Button
            label="Пропустить шаг"
            variant="ghost"
            onPress={() => navigation.navigate('TestModeWarning')}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title subtitle={subtitle}>Сканирование QR-кода</Title>

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
                      showToast('Сорт уже добавлен');
                      setScanned(false);
                      return;
                    }

                    navigation.replace('QrValidation');
                  }
            }
          />
        </View>

        <Text style={styles.text}>
          Наведите камеру на QR-код со ссылкой на Google Таблицу.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Сканировать снова"
          variant="secondary"
          onPress={() => {
            setError(null);
            setScanned(false);
          }}
        />
        <Button
          label="Пропустить шаг"
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
