import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { updateFacultyProfile, uploadFacultyPhoto } from '@/services/faculty-profile';
import type { UpdateFacultyProfilePayload } from '@/services/faculty-profile';
import { apiFetch } from '@/api/client';

const FALLBACK_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

type MasterLookup = {
  id: string;
  code?: string;
  label?: string;
};

type FormState = Required<UpdateFacultyProfilePayload>;

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = 'default',
  editable = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'url';
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputReadonly]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ''}
        placeholderTextColor={facultyTheme.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHead}>{title}</Text>;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { home, refreshHome } = useFacultyPortal();
  const profile = home?.profile;

  const [form, setForm] = useState<FormState>({
    mobile: '',
    email: '',
    qualification: '',
    specialization: '',
    experienceYears: 0,
    publicEmail: '',
    publicPhone: '',
    officeLocation: '',
    googleScholarUrl: '',
    orcidUrl: '',
    researchAreas: '',
  });

  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [bloodGroupOptions, setBloodGroupOptions] = useState<string[]>([...FALLBACK_BLOOD_GROUPS]);

  type AddressForm = {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  type EmergencyForm = { name: string; relationship: string; phone: string };

  const [address, setAddress] = useState<AddressForm>({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });
  const [emergency, setEmergency] = useState<EmergencyForm>({
    name: '',
    relationship: '',
    phone: '',
  });

  useEffect(() => {
    if (!profile) return;
    const p = profile as Record<string, unknown>;
    setForm({
      mobile: (p.mobile as string) ?? '',
      email: (p.email as string) ?? '',
      qualification: (p.qualification as string) ?? '',
      specialization: (p.specialization as string) ?? '',
      experienceYears: (p.experienceYears as number) ?? 0,
      publicEmail: (p.publicEmail as string) ?? '',
      publicPhone: (p.publicPhone as string) ?? '',
      officeLocation: (p.officeLocation as string) ?? '',
      googleScholarUrl: (p.googleScholarUrl as string) ?? '',
      orcidUrl: (p.orcidUrl as string) ?? '',
      researchAreas: (p.researchAreas as string) ?? '',
    });
    const addr = (p.addressJson as Record<string, string> | null) ?? {};
    setAddress({
      line1: addr.line1 ?? '',
      line2: addr.line2 ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      pincode: addr.pincode ?? '',
      country: addr.country ?? 'India',
    });
    const emg = (p.emergencyContactJson as Record<string, string> | null) ?? {};
    setEmergency({
      name: emg.name ?? '',
      relationship: emg.relationship ?? '',
      phone: emg.phone ?? '',
    });
    if (typeof p.bloodGroup === 'string' && p.bloodGroup.trim()) {
      setBloodGroup(p.bloodGroup.trim());
    }
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await apiFetch<{ bloodGroup?: string | null }>('/v1/staff/me');
        if (!cancelled && me.bloodGroup?.trim()) {
          setBloodGroup(me.bloodGroup.trim());
        }
      } catch {
        // keep home snapshot value if any
      }
      try {
        const lookups = await apiFetch<MasterLookup[]>(
          '/v1/master-lookups?type=BLOOD_GROUP&activeOnly=true',
        );
        if (cancelled) return;
        const labels = lookups.map((row) => (row.label ?? row.code ?? '').trim()).filter(Boolean);
        if (labels.length) {
          setBloodGroupOptions(Array.from(new Set(labels)));
        }
      } catch {
        if (!cancelled) setBloodGroupOptions([...FALLBACK_BLOOD_GROUPS]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBloodGroup = useMemo(() => {
    const current = bloodGroup.trim();
    if (!current) return '';
    return bloodGroupOptions.find((o) => o.toUpperCase() === current.toUpperCase()) ?? current;
  }, [bloodGroup, bloodGroupOptions]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoUploading(true);
    try {
      const mime = asset.mimeType ?? 'image/jpeg';
      const res = await uploadFacultyPhoto(asset.uri, mime);
      if (res?.photoUrl) setPhotoUri(res.photoUrl);
      await refreshHome();
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
      setPhotoUri(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload: UpdateFacultyProfilePayload = {
        mobile: form.mobile || undefined,
        email: form.email || undefined,
        qualification: form.qualification || undefined,
        specialization: form.specialization || undefined,
        experienceYears: form.experienceYears > 0 ? form.experienceYears : undefined,
        publicEmail: form.publicEmail || undefined,
        publicPhone: form.publicPhone || undefined,
        officeLocation: form.officeLocation || undefined,
        googleScholarUrl: form.googleScholarUrl || undefined,
        orcidUrl: form.orcidUrl || undefined,
        researchAreas: form.researchAreas || undefined,
      };
      await updateFacultyProfile(payload);
      await apiFetch('/v1/staff/me/address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressJson: address,
          emergencyContactJson: emergency,
        }),
      });
      await refreshHome();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save profile. Please try again.';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  }

  const displayPhotoUrl = photoUri ?? profile?.photoUrl ?? null;

  return (
    <FacultyScreenShell title="Edit Profile" subtitle="Update your details" showMenu={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Photo */}
          <View style={styles.photoSection}>
            <View style={styles.avatarWrap}>
              <StudentAvatar
                name={profile?.fullName ?? 'Faculty'}
                photoUrl={displayPhotoUrl}
                size={80}
              />
              {photoUploading && (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <Pressable style={styles.photoBtn} onPress={() => void pickPhoto()}>
              <Text style={styles.photoBtnText}>
                {photoUploading ? 'Uploading…' : 'Change Photo'}
              </Text>
            </Pressable>
            <Text style={styles.name}>{profile?.fullName ?? '—'}</Text>
            <Text style={styles.meta}>{profile?.designation ?? ''}</Text>
          </View>

          {/* Read-only identity */}
          <SectionHeader title="Identity (managed by HR)" />
          <View style={styles.readonlyRow}>
            <Text style={styles.label}>Employee Code</Text>
            <Text style={styles.readonlyValue}>{profile?.employeeCode ?? '—'}</Text>
          </View>
          <View style={styles.readonlyRow}>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.readonlyValue}>{profile?.department ?? '—'}</Text>
          </View>
          <View style={styles.readonlyRow}>
            <Text style={styles.label}>Designation</Text>
            <Text style={styles.readonlyValue}>{profile?.designation ?? '—'}</Text>
          </View>
          <View style={styles.bloodBlock}>
            <Text style={styles.label}>Blood Group</Text>
            <Text style={styles.bloodValue}>{selectedBloodGroup || '—'}</Text>
            <Text style={styles.bloodHint}>Non-editable · Contact HR if this needs correction</Text>
            <View style={styles.bloodChips}>
              {bloodGroupOptions.map((opt) => {
                const active = selectedBloodGroup.toUpperCase() === opt.toUpperCase();
                return (
                  <View key={opt} style={[styles.bloodChip, active && styles.bloodChipActive]}>
                    <Text style={[styles.bloodChipText, active && styles.bloodChipTextActive]}>
                      {opt}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Contact */}
          <SectionHeader title="Contact Details" />
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => set('email', v)}
            placeholder="your@email.com"
            keyboardType="email-address"
          />
          <Field
            label="Mobile"
            value={form.mobile}
            onChange={(v) => set('mobile', v)}
            placeholder="+91 XXXXX XXXXX"
            keyboardType="phone-pad"
          />
          <Field
            label="Office Location"
            value={form.officeLocation}
            onChange={(v) => set('officeLocation', v)}
            placeholder="e.g. Room 204, Block A"
          />

          {/* Academic */}
          <SectionHeader title="Academic Profile" />
          <Field
            label="Qualification"
            value={form.qualification}
            onChange={(v) => set('qualification', v)}
            placeholder="e.g. Ph.D., M.Tech"
          />
          <Field
            label="Specialization"
            value={form.specialization}
            onChange={(v) => set('specialization', v)}
            placeholder="e.g. Machine Learning"
          />
          <Field
            label="Experience (years)"
            value={form.experienceYears > 0 ? String(form.experienceYears) : ''}
            onChange={(v) => set('experienceYears', Number(v) || 0)}
            placeholder="0"
            keyboardType="numeric"
          />
          <Field
            label="Research Areas"
            value={form.researchAreas}
            onChange={(v) => set('researchAreas', v)}
            placeholder="e.g. NLP, Computer Vision"
          />

          {/* Public */}
          <SectionHeader title="Public / Website Profile" />
          <Field
            label="Public Email"
            value={form.publicEmail}
            onChange={(v) => set('publicEmail', v)}
            placeholder="Shown on college website"
            keyboardType="email-address"
          />
          <Field
            label="Public Phone"
            value={form.publicPhone}
            onChange={(v) => set('publicPhone', v)}
            placeholder="Shown on college website"
            keyboardType="phone-pad"
          />
          <Field
            label="Google Scholar URL"
            value={form.googleScholarUrl}
            onChange={(v) => set('googleScholarUrl', v)}
            placeholder="https://scholar.google.com/..."
            keyboardType="url"
          />
          <Field
            label="ORCID URL"
            value={form.orcidUrl}
            onChange={(v) => set('orcidUrl', v)}
            placeholder="https://orcid.org/..."
            keyboardType="url"
          />

          {/* Address */}
          <SectionHeader title="Residential Address" />
          <Field
            label="Address Line 1"
            value={address.line1}
            onChange={(v) => setAddress((a) => ({ ...a, line1: v }))}
            placeholder="House / Flat / Street"
          />
          <Field
            label="Address Line 2"
            value={address.line2}
            onChange={(v) => setAddress((a) => ({ ...a, line2: v }))}
            placeholder="Village / Area / Landmark"
          />
          <Field
            label="City"
            value={address.city}
            onChange={(v) => setAddress((a) => ({ ...a, city: v }))}
          />
          <Field
            label="State"
            value={address.state}
            onChange={(v) => setAddress((a) => ({ ...a, state: v }))}
          />
          <Field
            label="PIN Code"
            value={address.pincode}
            onChange={(v) => setAddress((a) => ({ ...a, pincode: v }))}
            placeholder="793001"
            keyboardType="numeric"
          />
          <Field
            label="Country"
            value={address.country}
            onChange={(v) => setAddress((a) => ({ ...a, country: v }))}
          />

          {/* Emergency Contact */}
          <SectionHeader title="Emergency Contact" />
          <Field
            label="Name"
            value={emergency.name}
            onChange={(v) => setEmergency((a) => ({ ...a, name: v }))}
            placeholder="Contact person's name"
          />
          <Field
            label="Relationship"
            value={emergency.relationship}
            onChange={(v) => setEmergency((a) => ({ ...a, relationship: v }))}
            placeholder="e.g. Spouse, Parent"
          />
          <Field
            label="Phone"
            value={emergency.phone}
            onChange={(v) => setEmergency((a) => ({ ...a, phone: v }))}
            keyboardType="phone-pad"
          />

          {/* Save */}
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 40 },
  photoSection: { alignItems: 'center', marginBottom: 16, gap: 6 },
  avatarWrap: { position: 'relative' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtn: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  photoBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 13, color: facultyTheme.textMuted },
  sectionHead: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: facultyTheme.textMuted,
    marginTop: 16,
    marginBottom: 4,
  },
  readonlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: facultyTheme.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    marginBottom: 6,
  },
  readonlyValue: { fontSize: 13, color: facultyTheme.textMuted, fontWeight: '500' },
  bloodBlock: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    padding: 12,
    gap: 6,
    marginBottom: 6,
  },
  bloodValue: {
    fontSize: 15,
    fontWeight: '700',
    color: facultyTheme.text,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  bloodHint: { fontSize: 11, color: facultyTheme.textSubtle },
  bloodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bloodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
  },
  bloodChipActive: {
    borderColor: facultyTheme.primary,
    backgroundColor: '#eff6ff',
  },
  bloodChipText: { fontSize: 12, fontWeight: '600', color: facultyTheme.textMuted },
  bloodChipTextActive: { color: facultyTheme.primary, fontWeight: '800' },
  field: { gap: 4, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '600', color: facultyTheme.textMuted },
  input: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: facultyTheme.text,
  },
  inputReadonly: { opacity: 0.5 },
  saveBtn: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
