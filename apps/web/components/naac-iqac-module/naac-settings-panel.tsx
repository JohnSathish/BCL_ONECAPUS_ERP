'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchNaacAqars,
  fetchNaacSettings,
  updateNaacAqar,
  updateNaacSettings,
} from '@/services/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

type InstitutionProfile = {
  name?: string;
  address?: string;
  affiliation?: string;
  accreditation?: string;
  establishedYear?: string;
  motto?: string;
  principalName?: string;
  iqacCoordinator?: string;
};

export function NaacSettingsPanel() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [activeYear, setActiveYear] = useState('2025-26');
  const [profile, setProfile] = useState<InstitutionProfile>({
    name: '',
    address: '',
    affiliation: '',
    accreditation: '',
    establishedYear: '',
    motto: '',
    principalName: '',
    iqacCoordinator: '',
  });

  const settingsQ = useQuery({ queryKey: ['naac-settings'], queryFn: fetchNaacSettings });
  const aqarsQ = useQuery({ queryKey: ['naac-aqars'], queryFn: fetchNaacAqars });

  useEffect(() => {
    const s = settingsQ.data as
      | { activeAqarYear?: string; institutionProfile?: InstitutionProfile }
      | undefined;
    if (!s) return;
    if (s.activeAqarYear) setActiveYear(s.activeAqarYear);
    if (s.institutionProfile) setProfile((p) => ({ ...p, ...s.institutionProfile }));
  }, [settingsQ.data]);

  const saveSettingsMut = useMutation({
    mutationFn: () =>
      updateNaacSettings({
        activeAqarYear: activeYear,
        institutionProfile: profile,
      }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-settings'] });
      void qc.invalidateQueries({ queryKey: ['naac-dashboard'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const syncAqarProfileMut = useMutation({
    mutationFn: async () => {
      const aqar = (aqarsQ.data ?? []).find((a) => a.academicYear === activeYear);
      if (!aqar)
        throw new Error(`No AQAR found for ${activeYear}. Create one on the AQAR page first.`);
      return updateNaacAqar(aqar.id, { institutionProfile: profile });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['naac-aqars'] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  function updateProfile<K extends keyof InstitutionProfile>(key: K, value: InstitutionProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>NAAC module settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label>Active AQAR year</Label>
            <Input value={activeYear} onChange={(e) => setActiveYear(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Institution profile (AQAR / SSR)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Institution name</Label>
            <Input
              value={profile.name ?? ''}
              onChange={(e) => updateProfile('name', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Input
              value={profile.address ?? ''}
              onChange={(e) => updateProfile('address', e.target.value)}
            />
          </div>
          <div>
            <Label>Affiliation</Label>
            <Input
              value={profile.affiliation ?? ''}
              onChange={(e) => updateProfile('affiliation', e.target.value)}
            />
          </div>
          <div>
            <Label>NAAC accreditation</Label>
            <Input
              value={profile.accreditation ?? ''}
              onChange={(e) => updateProfile('accreditation', e.target.value)}
            />
          </div>
          <div>
            <Label>Established year</Label>
            <Input
              value={profile.establishedYear ?? ''}
              onChange={(e) => updateProfile('establishedYear', e.target.value)}
            />
          </div>
          <div>
            <Label>Motto</Label>
            <Input
              value={profile.motto ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, motto: e.target.value }))}
            />
          </div>
          <div>
            <Label>Principal</Label>
            <Input
              value={profile.principalName ?? ''}
              onChange={(e) => updateProfile('principalName', e.target.value)}
            />
          </div>
          <div>
            <Label>IQAC Coordinator</Label>
            <Input
              value={profile.iqacCoordinator ?? ''}
              onChange={(e) => updateProfile('iqacCoordinator', e.target.value)}
            />
          </div>

          {error ? <p className="md:col-span-2 text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button disabled={saveSettingsMut.isPending} onClick={() => saveSettingsMut.mutate()}>
              {saveSettingsMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save settings & profile
            </Button>
            <Button
              variant="outline"
              disabled={syncAqarProfileMut.isPending}
              onClick={() => syncAqarProfileMut.mutate()}
            >
              Push profile to AQAR {activeYear}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
