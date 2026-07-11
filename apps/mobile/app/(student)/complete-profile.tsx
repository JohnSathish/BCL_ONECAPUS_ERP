import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchClass12Subjects,
  fetchMyProfileBootstrap,
  normalizeClass12Stream,
  submitMyProfileChanges,
  uploadMyDocument,
  upsertMyClassXii,
  type Class12SubjectOption,
  type ProfileBootstrap,
} from '@/services/student-profile';
import { useSyncGuard } from '@/state/sync-guard';

const AADHAAR_RE = /^\d{12}$/;
const MOBILE_RE = /^(\+?\d{1,3}[- ]?)?\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const CLASS12_STREAMS = ['ARTS', 'SCIENCE', 'COMMERCE'] as const;
const MIN_CLASS12_SUBJECTS = 5;

type SubjectRow = {
  subjectName: string;
  marksObtained: string;
  maxMarks: string;
  grade: string;
};

function emptySubjectRows(count = MIN_CLASS12_SUBJECTS): SubjectRow[] {
  return Array.from({ length: count }, () => ({
    subjectName: '',
    marksObtained: '',
    maxMarks: '100',
    grade: '',
  }));
}

export default function CompleteProfileScreen() {
  const { beginEditing, endEditing } = useSyncGuard();
  const [bootstrap, setBootstrap] = useState<ProfileBootstrap | null>(null);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [bank, setBank] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifsc: '',
    branchName: '',
  });
  const blankGuardian = { fullName: '', occupation: '', contactNumber: '', email: '' };
  const blankAddress = { line1: '', line2: '', city: '', state: '', district: '', pinCode: '' };
  const [father, setFather] = useState({ ...blankGuardian });
  const [mother, setMother] = useState({ ...blankGuardian });
  const [guardian, setGuardian] = useState({ ...blankGuardian });
  const [currentAddress, setCurrentAddress] = useState({ ...blankAddress });
  const [permanentAddress, setPermanentAddress] = useState({ ...blankAddress });
  const [emergency, setEmergency] = useState({
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactMobile: '',
  });
  const [savingGuardians, setSavingGuardians] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingEmergency, setSavingEmergency] = useState(false);
  const [classXii, setClassXii] = useState({
    boardName: '',
    schoolName: '',
    boardRollNumber: '',
    registrationNumber: '',
    examYear: '',
    stream: '',
    totalMarks: '',
    maximumMarks: '',
    grade: '',
    division: '',
  });
  const [subjects, setSubjects] = useState<SubjectRow[]>(emptySubjectRows());
  const [subjectOptions, setSubjectOptions] = useState<Class12SubjectOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectPickerIdx, setSubjectPickerIdx] = useState<number | null>(null);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [message, setMessage] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingClassXii, setSavingClassXii] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  async function refresh() {
    const data = await fetchMyProfileBootstrap();
    setBootstrap(data);
    const personal = data.sections?.personal ?? {};
    setMobile(String(personal.mobileNumber ?? ''));
    setEmail(String(personal.email ?? ''));
    setAadhaar(String(personal.nationalId ?? ''));

    const bankData = data.sections?.bank ?? {};
    setBank({
      bankName: String(bankData.bankName ?? ''),
      accountHolderName: String(bankData.accountHolderName ?? ''),
      accountNumber: String(bankData.accountNumber ?? ''),
      ifsc: String(bankData.ifsc ?? ''),
      branchName: String(bankData.branchName ?? ''),
    });

    const g = data.sections?.guardians ?? {};
    setFather({ ...blankGuardian, ...(g.FATHER ?? {}) });
    setMother({ ...blankGuardian, ...(g.MOTHER ?? {}) });
    setGuardian({ ...blankGuardian, ...(g.GUARDIAN ?? {}) });
    const addr = data.sections?.address ?? {};
    setCurrentAddress({ ...blankAddress, ...(addr.current ?? {}) });
    setPermanentAddress({ ...blankAddress, ...(addr.permanent ?? {}) });
    const em = data.sections?.emergency ?? {};
    setEmergency({
      emergencyContactName: String(em.emergencyContactName ?? ''),
      emergencyContactRelation: String(em.emergencyContactRelation ?? ''),
      emergencyContactMobile: String(em.emergencyContactMobile ?? ''),
    });

    const exam = data.sections?.class_xii ?? null;
    setClassXii({
      boardName: String(exam?.boardName ?? ''),
      schoolName: String(exam?.schoolName ?? ''),
      boardRollNumber: String(exam?.boardRollNumber ?? ''),
      registrationNumber: String(exam?.registrationNumber ?? ''),
      examYear: exam?.examYear != null ? String(exam.examYear) : '',
      stream: normalizeClass12Stream(String(exam?.stream ?? '')),
      totalMarks: exam?.totalMarks != null ? String(exam.totalMarks) : '',
      maximumMarks: exam?.maximumMarks != null ? String(exam.maximumMarks) : '',
      grade: String(exam?.grade ?? ''),
      division: String(exam?.division ?? ''),
    });
    const rows = (exam?.subjectMarks ?? []).map((s: any) => ({
      subjectName: String(s.subjectName ?? ''),
      marksObtained: s.marksObtained != null ? String(s.marksObtained) : '',
      maxMarks: s.maxMarks != null ? String(s.maxMarks) : '100',
      grade: String(s.grade ?? ''),
    }));
    setSubjects(
      rows.length >= MIN_CLASS12_SUBJECTS
        ? rows
        : [...rows, ...emptySubjectRows(MIN_CLASS12_SUBJECTS - rows.length)],
    );
  }

  useEffect(() => {
    void refresh().catch(() => setMessage('Could not load profile'));
  }, []);

  useEffect(() => {
    beginEditing('complete-profile');
    return () => endEditing();
  }, [beginEditing, endEditing]);

  useEffect(() => {
    const board = classXii.boardName.trim();
    const stream = normalizeClass12Stream(classXii.stream);
    if (!board || !stream) {
      setSubjectOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingSubjects(true);
    void fetchClass12Subjects(board, stream)
      .then((rows) => {
        if (cancelled) return;
        setSubjectOptions(rows);
        const allowed = new Set(rows.map((r) => r.subjectName));
        setSubjects((prev) =>
          prev.map((row) =>
            row.subjectName && !allowed.has(row.subjectName) ? { ...row, subjectName: '' } : row,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSubjectOptions([]);
          setMessage('Could not load Class XII subjects for this Board and Stream');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classXii.boardName, classXii.stream]);

  const boards = bootstrap?.staticOptions?.board ?? ['MBOSE', 'CBSE', 'ISC', 'NIOS', 'State Board'];
  const years = bootstrap?.staticOptions?.yearOfPassing ?? [];

  const selectedSubjectNames = useMemo(() => {
    return new Set(subjects.map((s) => s.subjectName.trim()).filter(Boolean));
  }, [subjects]);

  const pickerOptions = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjectOptions.filter((opt) => {
      if (q && !opt.subjectName.toLowerCase().includes(q)) return false;
      if (
        selectedSubjectNames.has(opt.subjectName) &&
        subjects[subjectPickerIdx ?? -1]?.subjectName !== opt.subjectName
      ) {
        return false;
      }
      return true;
    });
  }, [subjectOptions, subjectSearch, selectedSubjectNames, subjects, subjectPickerIdx]);

  const percent = useMemo(() => {
    const total = Number(classXii.totalMarks);
    const max = Number(classXii.maximumMarks);
    if (!total || !max) return null;
    return Math.round((total / max) * 1000) / 10;
  }, [classXii.totalMarks, classXii.maximumMarks]);

  async function onSavePersonal() {
    setSavingPersonal(true);
    setMessage('');
    try {
      if (mobile && !MOBILE_RE.test(mobile.replace(/\s/g, ''))) {
        throw new Error('Enter a valid 10-digit mobile number');
      }
      if (email && !EMAIL_RE.test(email)) {
        throw new Error('Enter a valid email address');
      }
      if (aadhaar && !AADHAAR_RE.test(aadhaar.replace(/\s/g, ''))) {
        throw new Error('Aadhaar must be exactly 12 digits');
      }
      await submitMyProfileChanges([
        { sectionKey: 'personal', fieldKey: 'mobileNumber', newValue: mobile || null },
        { sectionKey: 'personal', fieldKey: 'email', newValue: email || null },
        {
          sectionKey: 'personal',
          fieldKey: 'nationalId',
          newValue: aadhaar.replace(/\s/g, '') || null,
        },
      ]);
      setMessage(
        'Personal details submitted. Auto-approve fields apply immediately; Aadhaar awaits office verification.',
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingPersonal(false);
    }
  }

  async function onSaveBank() {
    setSavingBank(true);
    setMessage('');
    try {
      if (!bank.bankName.trim() || !bank.accountHolderName.trim() || !bank.accountNumber.trim()) {
        throw new Error('Bank name, account holder, and account number are required');
      }
      if (bank.ifsc && !IFSC_RE.test(bank.ifsc.trim().toUpperCase())) {
        throw new Error('Enter a valid IFSC code');
      }
      await submitMyProfileChanges([
        {
          sectionKey: 'bank',
          fieldKey: 'bankDetails',
          newValue: {
            ...bank,
            ifsc: bank.ifsc.trim().toUpperCase(),
          },
        },
      ]);
      setMessage('Bank details submitted for office verification.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Bank save failed');
    } finally {
      setSavingBank(false);
    }
  }

  async function onSaveGuardians() {
    setSavingGuardians(true);
    setMessage('');
    try {
      if (!father.fullName.trim() || !mother.fullName.trim()) {
        throw new Error('Father and mother names are required');
      }
      await submitMyProfileChanges([
        { sectionKey: 'guardians', fieldKey: 'FATHER', newValue: father },
        { sectionKey: 'guardians', fieldKey: 'MOTHER', newValue: mother },
        { sectionKey: 'guardians', fieldKey: 'GUARDIAN', newValue: guardian },
      ]);
      setMessage('Parent / guardian details submitted.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Guardian save failed');
    } finally {
      setSavingGuardians(false);
    }
  }

  async function onSaveAddress() {
    setSavingAddress(true);
    setMessage('');
    try {
      if (!currentAddress.line1.trim() || !currentAddress.city.trim()) {
        throw new Error('Current address line 1 and city are required');
      }
      await submitMyProfileChanges([
        { sectionKey: 'address', fieldKey: 'current', newValue: currentAddress },
        { sectionKey: 'address', fieldKey: 'permanent', newValue: permanentAddress },
      ]);
      setMessage('Address details submitted.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Address save failed');
    } finally {
      setSavingAddress(false);
    }
  }

  async function onSaveEmergency() {
    setSavingEmergency(true);
    setMessage('');
    try {
      if (!emergency.emergencyContactName.trim() || !emergency.emergencyContactMobile.trim()) {
        throw new Error('Emergency contact name and mobile are required');
      }
      await submitMyProfileChanges([
        { sectionKey: 'emergency', fieldKey: 'emergencyContact', newValue: emergency },
      ]);
      setMessage('Emergency contact submitted.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Emergency save failed');
    } finally {
      setSavingEmergency(false);
    }
  }

  async function onSaveClassXii() {
    setSavingClassXii(true);
    setMessage('');
    try {
      if (!classXii.boardName.trim() || !classXii.stream.trim() || !classXii.examYear.trim()) {
        throw new Error('Board, stream, and year of passing are required');
      }
      const subjectPayload = subjects
        .filter((s) => s.subjectName.trim())
        .map((s) => ({
          subjectName: s.subjectName.trim(),
          marksObtained: s.marksObtained ? Number(s.marksObtained) : null,
          maxMarks: s.maxMarks ? Number(s.maxMarks) : null,
          grade: s.grade || null,
        }));
      if (subjectPayload.length < MIN_CLASS12_SUBJECTS) {
        throw new Error(`Add at least ${MIN_CLASS12_SUBJECTS} Class XII subjects`);
      }
      const names = subjectPayload.map((s) => s.subjectName.toLowerCase());
      if (new Set(names).size !== names.length) {
        throw new Error('Duplicate subjects are not allowed');
      }
      await upsertMyClassXii({
        boardName: classXii.boardName || null,
        schoolName: classXii.schoolName || null,
        boardRollNumber: classXii.boardRollNumber || null,
        registrationNumber: classXii.registrationNumber || null,
        examYear: classXii.examYear ? Number(classXii.examYear) : null,
        stream: normalizeClass12Stream(classXii.stream) || null,
        totalMarks: classXii.totalMarks ? Number(classXii.totalMarks) : null,
        maximumMarks: classXii.maximumMarks ? Number(classXii.maximumMarks) : null,
        grade: classXii.grade || (percent != null ? String(percent) : null),
        division: classXii.division || null,
        subjects: subjectPayload,
      });
      setMessage('Class XII marks saved for verification.');
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Class XII save failed');
    } finally {
      setSavingClassXii(false);
    }
  }

  async function pickAndUpload(documentType: 'PHOTO' | 'CLASS_XII_MARKSHEET') {
    setUploadingDoc(documentType);
    setMessage('');
    try {
      let file: { uri: string; name: string; mimeType: string } | null = null;
      if (documentType === 'PHOTO') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          throw new Error('Photo library permission is required');
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
        file = {
          uri: asset.uri,
          name: asset.fileName ?? `passport-photo.${ext}`,
          mimeType: asset.mimeType ?? `image/${ext === 'png' ? 'png' : 'jpeg'}`,
        };
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        file = {
          uri: asset.uri,
          name: asset.name || 'class-xii-marksheet.pdf',
          mimeType: asset.mimeType || 'application/pdf',
        };
      }
      await uploadMyDocument(documentType, file);
      setMessage(
        documentType === 'PHOTO'
          ? 'Passport photo uploaded for verification.'
          : 'Class XII marksheet uploaded for verification.',
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  }

  const completion = bootstrap?.completion;
  const student = bootstrap?.student;
  const docs: Array<{ id: string; documentType: string; verificationStatus?: string }> =
    bootstrap?.sections?.documents?.documents ?? [];
  const canEditProfile = bootstrap?.profileUpdate?.canEdit !== false;
  const profileClosedMessage =
    bootstrap?.profileUpdate?.message ||
    'The profile update period has ended. Please contact the College Office if you need to make any changes.';

  return (
    <StudentScreenShell title="Complete Profile" subtitle="Update permitted personal details">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {student?.fullName ? <Text style={styles.name}>{student.fullName}</Text> : null}
          <Text style={styles.meta}>
            {[student?.rollNumber, student?.programme].filter(Boolean).join(' · ') || ' '}
          </Text>
          <Text style={styles.heading}>
            {completion ? `${completion.percent}% complete` : 'Loading…'}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${completion?.percent ?? 0}%` }]} />
          </View>
          {(completion?.missing ?? []).map((m) => (
            <Text key={m.key} style={styles.missing}>
              • {m.label}
            </Text>
          ))}
          {bootstrap?.verificationStatus ? (
            <Text style={styles.status}>Status: {bootstrap.verificationStatus}</Text>
          ) : null}
        </View>

        {!canEditProfile ? (
          <View style={[styles.card, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
            <Text style={{ color: '#92400e', fontSize: 14, lineHeight: 20 }}>
              {profileClosedMessage}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/[^\d+]/g, '').slice(0, 13))}
            keyboardType="phone-pad"
          />
          <Text style={styles.label}>Personal Email *</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>Aadhaar Number *</Text>
          <TextInput
            style={styles.input}
            value={aadhaar}
            onChangeText={(t) => setAadhaar(t.replace(/\D/g, '').slice(0, 12))}
            keyboardType="number-pad"
            maxLength={12}
          />
          <Pressable
            style={[styles.button, !canEditProfile && { opacity: 0.5 }]}
            onPress={() => void onSavePersonal()}
            disabled={savingPersonal || !canEditProfile}
          >
            <Text style={styles.buttonText}>
              {savingPersonal ? 'Saving…' : 'Save personal details'}
            </Text>
          </Pressable>
        </View>

        {bootstrap?.visibleSections?.bank ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bank details</Text>
            <Text style={styles.hint}>
              Required for scholarships and refunds. Needs office approval.
            </Text>
            {(
              [
                ['bankName', 'Bank Name *'],
                ['accountHolderName', 'Account Holder Name *'],
                ['accountNumber', 'Account Number *'],
                ['ifsc', 'IFSC Code *'],
                ['branchName', 'Branch Name'],
              ] as const
            ).map(([key, label]) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={bank[key]}
                  editable={canEditProfile}
                  autoCapitalize={key === 'ifsc' ? 'characters' : 'words'}
                  onChangeText={(t) =>
                    setBank((prev) => ({
                      ...prev,
                      [key]:
                        key === 'ifsc'
                          ? t
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, '')
                              .slice(0, 11)
                          : t,
                    }))
                  }
                />
              </View>
            ))}
            <Pressable
              style={[styles.button, !canEditProfile && { opacity: 0.5 }]}
              onPress={() => void onSaveBank()}
              disabled={savingBank || !canEditProfile}
            >
              <Text style={styles.buttonText}>{savingBank ? 'Saving…' : 'Save bank details'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parent / Guardian</Text>
          {(
            [
              ['Father', father, setFather],
              ['Mother', mother, setMother],
              ['Guardian (optional)', guardian, setGuardian],
            ] as const
          ).map(([title, value, setValue]) => (
            <View key={title} style={styles.subCard}>
              <Text style={styles.subTitle}>{title}</Text>
              {(
                [
                  ['fullName', 'Full name'],
                  ['occupation', 'Occupation'],
                  ['contactNumber', 'Mobile'],
                  ['email', 'Email'],
                ] as const
              ).map(([key, label]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={String((value as any)[key] ?? '')}
                    onChangeText={(t) => setValue({ ...value, [key]: t } as any)}
                    keyboardType={
                      key === 'contactNumber'
                        ? 'phone-pad'
                        : key === 'email'
                          ? 'email-address'
                          : 'default'
                    }
                  />
                </View>
              ))}
            </View>
          ))}
          <Pressable
            style={styles.button}
            onPress={() => void onSaveGuardians()}
            disabled={savingGuardians}
          >
            <Text style={styles.buttonText}>
              {savingGuardians ? 'Saving…' : 'Save parent / guardian'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Address</Text>
          {(
            [
              ['Current address', currentAddress, setCurrentAddress],
              ['Permanent address', permanentAddress, setPermanentAddress],
            ] as const
          ).map(([title, value, setValue]) => (
            <View key={title} style={styles.subCard}>
              <Text style={styles.subTitle}>{title}</Text>
              {(
                [
                  ['line1', 'Address line 1'],
                  ['line2', 'Address line 2'],
                  ['city', 'City'],
                  ['district', 'District'],
                  ['state', 'State'],
                  ['pinCode', 'PIN code'],
                ] as const
              ).map(([key, label]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={String((value as any)[key] ?? '')}
                    onChangeText={(t) => setValue({ ...value, [key]: t } as any)}
                    keyboardType={key === 'pinCode' ? 'number-pad' : 'default'}
                  />
                </View>
              ))}
            </View>
          ))}
          <Pressable
            style={styles.button}
            onPress={() => void onSaveAddress()}
            disabled={savingAddress}
          >
            <Text style={styles.buttonText}>{savingAddress ? 'Saving…' : 'Save address'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Emergency contact</Text>
          {(
            [
              ['emergencyContactName', 'Contact person'],
              ['emergencyContactRelation', 'Relationship'],
              ['emergencyContactMobile', 'Mobile'],
            ] as const
          ).map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={emergency[key]}
                onChangeText={(t) => setEmergency((p) => ({ ...p, [key]: t }))}
                keyboardType={key === 'emergencyContactMobile' ? 'phone-pad' : 'default'}
              />
            </View>
          ))}
          <Pressable
            style={styles.button}
            onPress={() => void onSaveEmergency()}
            disabled={savingEmergency}
          >
            <Text style={styles.buttonText}>
              {savingEmergency ? 'Saving…' : 'Save emergency contact'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Class XII marks</Text>
          <Text style={styles.hint}>Enter board exam details and subject-wise marks.</Text>
          <Text style={styles.label}>Board / Council *</Text>
          <View style={styles.chipRow}>
            {boards.map((b) => {
              const active = classXii.boardName === b;
              return (
                <Pressable
                  key={b}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setClassXii((p) => ({ ...p, boardName: b }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{b}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Stream *</Text>
          <View style={styles.chipRow}>
            {CLASS12_STREAMS.map((s) => {
              const active = classXii.stream === s;
              return (
                <Pressable
                  key={s}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setClassXii((p) => ({ ...p, stream: s }))}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.label}>Year of Passing *</Text>
          <TextInput
            style={styles.input}
            value={classXii.examYear}
            keyboardType="number-pad"
            placeholder={years[0] ? String(years[0]) : '2024'}
            onChangeText={(t) =>
              setClassXii((p) => ({ ...p, examYear: t.replace(/\D/g, '').slice(0, 4) }))
            }
          />
          <Text style={styles.label}>School Name</Text>
          <TextInput
            style={styles.input}
            value={classXii.schoolName}
            onChangeText={(t) => setClassXii((p) => ({ ...p, schoolName: t }))}
          />
          <Text style={styles.label}>Board Roll No.</Text>
          <TextInput
            style={styles.input}
            value={classXii.boardRollNumber}
            onChangeText={(t) => setClassXii((p) => ({ ...p, boardRollNumber: t }))}
          />
          <Text style={styles.label}>Registration No.</Text>
          <TextInput
            style={styles.input}
            value={classXii.registrationNumber}
            onChangeText={(t) => setClassXii((p) => ({ ...p, registrationNumber: t }))}
          />
          <Text style={styles.label}>Total Marks</Text>
          <TextInput
            style={styles.input}
            value={classXii.totalMarks}
            keyboardType="number-pad"
            onChangeText={(t) => setClassXii((p) => ({ ...p, totalMarks: t.replace(/\D/g, '') }))}
          />
          <Text style={styles.label}>Maximum Marks</Text>
          <TextInput
            style={styles.input}
            value={classXii.maximumMarks}
            keyboardType="number-pad"
            onChangeText={(t) => setClassXii((p) => ({ ...p, maximumMarks: t.replace(/\D/g, '') }))}
          />
          {percent != null ? <Text style={styles.hint}>Percentage (auto): {percent}%</Text> : null}
          <Text style={styles.label}>Grade</Text>
          <TextInput
            style={styles.input}
            value={classXii.grade}
            onChangeText={(t) => setClassXii((p) => ({ ...p, grade: t }))}
          />
          <Text style={styles.label}>Division</Text>
          <TextInput
            style={styles.input}
            value={classXii.division}
            onChangeText={(t) => setClassXii((p) => ({ ...p, division: t }))}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            Subjects * (min {MIN_CLASS12_SUBJECTS})
          </Text>
          {!classXii.boardName || !classXii.stream ? (
            <Text style={styles.hint}>Select Board and Stream to load subjects.</Text>
          ) : loadingSubjects ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={studentTheme.primary} />
              <Text style={styles.hint}>Loading subjects…</Text>
            </View>
          ) : subjectOptions.length === 0 ? (
            <Text style={styles.hint}>
              No Class XII subjects configured for this Board and Stream.
            </Text>
          ) : null}
          {subjects.map((row, idx) => (
            <View key={idx} style={styles.subjectCard}>
              <Pressable
                style={styles.input}
                onPress={() => {
                  if (!subjectOptions.length) return;
                  setSubjectSearch('');
                  setSubjectPickerIdx(idx);
                }}
              >
                <Text
                  style={{
                    color: row.subjectName ? studentTheme.text : studentTheme.textMuted,
                    fontSize: 16,
                  }}
                >
                  {row.subjectName || 'Select subject'}
                </Text>
              </Pressable>
              <View style={styles.subjectRow}>
                <TextInput
                  style={[styles.input, styles.subjectHalf]}
                  placeholder="Marks"
                  keyboardType="number-pad"
                  value={row.marksObtained}
                  onChangeText={(t) => {
                    const next = [...subjects];
                    next[idx] = { ...row, marksObtained: t.replace(/\D/g, '') };
                    setSubjects(next);
                  }}
                />
                <TextInput
                  style={[styles.input, styles.subjectHalf]}
                  placeholder="Max"
                  keyboardType="number-pad"
                  value={row.maxMarks}
                  onChangeText={(t) => {
                    const next = [...subjects];
                    next[idx] = { ...row, maxMarks: t.replace(/\D/g, '') };
                    setSubjects(next);
                  }}
                />
                {subjects.length > MIN_CLASS12_SUBJECTS ? (
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setSubjects([
                ...subjects,
                { subjectName: '', marksObtained: '', maxMarks: '100', grade: '' },
              ])
            }
          >
            <Text style={styles.secondaryButtonText}>Add subject</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => void onSaveClassXii()}
            disabled={savingClassXii}
          >
            <Text style={styles.buttonText}>
              {savingClassXii ? 'Saving…' : 'Save Class XII marks'}
            </Text>
          </Pressable>
        </View>

        <Modal
          visible={subjectPickerIdx != null}
          transparent
          animationType="slide"
          onRequestClose={() => setSubjectPickerIdx(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>Select subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Search…"
                value={subjectSearch}
                onChangeText={setSubjectSearch}
                autoFocus
              />
              <FlatList
                data={pickerOptions}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                ListEmptyComponent={<Text style={styles.hint}>No subjects match your search.</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickerRow}
                    onPress={() => {
                      if (subjectPickerIdx == null) return;
                      const next = [...subjects];
                      next[subjectPickerIdx] = {
                        ...next[subjectPickerIdx],
                        subjectName: item.subjectName,
                      };
                      setSubjects(next);
                      setSubjectPickerIdx(null);
                    }}
                  >
                    <Text style={{ color: studentTheme.text, fontSize: 15 }}>
                      {item.subjectName}
                    </Text>
                  </Pressable>
                )}
              />
              <Pressable style={styles.secondaryButton} onPress={() => setSubjectPickerIdx(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <Text style={styles.hint}>Upload passport photo and Class XII marksheet.</Text>
          <Pressable
            style={styles.button}
            onPress={() => void pickAndUpload('PHOTO')}
            disabled={uploadingDoc === 'PHOTO'}
          >
            <Text style={styles.buttonText}>
              {uploadingDoc === 'PHOTO' ? 'Uploading…' : 'Upload passport photo'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => void pickAndUpload('CLASS_XII_MARKSHEET')}
            disabled={uploadingDoc === 'CLASS_XII_MARKSHEET'}
          >
            <Text style={styles.secondaryButtonText}>
              {uploadingDoc === 'CLASS_XII_MARKSHEET'
                ? 'Uploading…'
                : 'Upload Class XII marksheet (PDF/image)'}
            </Text>
          </Pressable>
          {docs.length ? (
            docs.map((doc) => (
              <Text key={doc.id} style={styles.docRow}>
                • {doc.documentType} — {doc.verificationStatus ?? 'PENDING'}
              </Text>
            ))
          ) : (
            <Text style={styles.hint}>No documents uploaded yet.</Text>
          )}
        </View>

        {message ? (
          <Text style={styles.message} onLongPress={() => Alert.alert('Message', message)}>
            {message}
          </Text>
        ) : null}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: '700', color: studentTheme.text },
  meta: { fontSize: 13, color: studentTheme.textMuted, marginBottom: 4 },
  heading: { fontSize: 16, fontWeight: '600', color: studentTheme.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: studentTheme.text, marginBottom: 4 },
  subCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginTop: 8,
    backgroundColor: '#f8fafc',
  },
  subTitle: { fontSize: 13, fontWeight: '700', color: studentTheme.text, marginBottom: 2 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: studentTheme.border,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barFill: { height: '100%', backgroundColor: studentTheme.primary },
  missing: { color: studentTheme.textMuted, fontSize: 13 },
  status: { marginTop: 6, fontSize: 12, color: studentTheme.textMuted },
  label: { marginTop: 8, fontSize: 13, fontWeight: '600', color: studentTheme.text },
  hint: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: studentTheme.text,
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: studentTheme.primary,
    backgroundColor: `${studentTheme.primary}18`,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: studentTheme.textMuted },
  chipTextActive: { color: studentTheme.primary },
  subjectCard: {
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: '#fff',
  },
  subjectRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  subjectHalf: { flex: 1 },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 10 },
  removeText: { color: '#DC2626', fontWeight: '700', fontSize: 12 },
  button: {
    marginTop: 12,
    backgroundColor: studentTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studentTheme.primary,
    backgroundColor: '#fff',
  },
  secondaryButtonText: { color: studentTheme.primary, fontWeight: '700', fontSize: 14 },
  docRow: { fontSize: 13, color: studentTheme.textMuted },
  message: { marginTop: 4, marginBottom: 12, fontSize: 13, color: studentTheme.textMuted },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
    maxHeight: '80%',
  },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: studentTheme.border,
  },
});
