import { useEffect } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/ui/kit';

export default function MediaViewScreen() {
  const { url, title } = useLocalSearchParams<{ url?: string; title?: string }>();
  const href = typeof url === 'string' ? url : '';
  const pdf = /\.pdf($|\?)/i.test(href);

  useEffect(() => {
    if (pdf && href) void Linking.openURL(href);
  }, [pdf, href]);

  return (
    <Screen title={title || (pdf ? 'Document' : 'Attachment')} onBack navy>
      <View style={styles.page}>
        {href && !pdf ? (
          <Image source={{ uri: href }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.hint}>{pdf ? 'Opening the PDF…' : 'No attachment to display.'}</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b1048', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  hint: { color: '#fff', fontWeight: '700' },
});
