import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { confirmLogout } from '@/auth/logout';
import { getUser } from '@/auth/session';
import { isPrincipalUser } from '@/persona';
import { Card, Row, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

export default function MoreScreen() {
  const router = useRouter();
  const [office, setOffice] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getUser().then((user) => setOffice(isPrincipalUser(user)));
    }, []),
  );

  return (
    <Screen title="Menu">
      <View style={{ padding: 16, gap: 12 }}>
        {office ? (
          <Card>
            <Row
              icon="📢"
              label="Announcements"
              onPress={() => router.push('/office/announcements')}
            />
            <Row icon="👥" label="Students" onPress={() => router.push('/office/students')} />
            <Row icon="🧑‍🏫" label="Teachers" onPress={() => router.push('/office/teachers')} />
            <Row icon="📅" label="Academics" onPress={() => router.push('/office/academics')} />
            <Row
              icon="📊"
              label="Examinations"
              onPress={() => router.push('/office/examinations')}
            />
            <Row icon="✅" label="Attendance" onPress={() => router.push('/office/attendance')} />
            <Row icon="₹" label="Fees" onPress={() => router.push('/office/fees')} />
            <Row
              icon="📄"
              label="Notices & Circulars"
              onPress={() => router.push('/office/notices')}
            />
          </Card>
        ) : null}
        <Card>
          <Row icon="🙏" label="Daily Morning Prayer" onPress={() => router.push('/prayer')} />
          <Row icon="🏫" label="School Information" onPress={() => router.push('/school')} />
          <Row icon="🔑" label="Change Password" onPress={() => router.push('/password')} />
          <Row icon="🔒" label="Security" onPress={() => router.push('/security')} />
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
