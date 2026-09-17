import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { confirmLogout } from '@/auth/logout';
import { Card, Row, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen title="Menu">
      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Row icon="🙏" label="Daily Morning Prayer" onPress={() => router.push('/prayer')} />
          <Row icon="🏫" label="School Information" onPress={() => router.push('/school')} />
          <Row icon="📘" label="Academics" onPress={() => router.push('/academics')} />
          <Row icon="🔒" label="Security" onPress={() => router.push('/security')} />
          <Row icon="📝" label="Admissions" onPress={() => router.push('/page/admissions')} />
          <Row icon="🔗" label="Important Links" onPress={() => router.push('/page/about')} />
          <Row icon="☎️" label="Contact Us" onPress={() => router.push('/page/contact')} />
          <Row icon="💬" label="Feedback / Enquiry" onPress={() => router.push('/feedback')} />
          <Row icon="ℹ️" label="App Information" onPress={() => router.push('/app-info')} />
        </Card>
        <Pressable onPress={() => confirmLogout(() => router.replace('/login'))}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logout: { textAlign: 'center', color: colors.danger, fontWeight: '800', padding: 12 },
});
