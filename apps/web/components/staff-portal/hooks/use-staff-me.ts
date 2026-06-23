'use client';

import { useQuery } from '@tanstack/react-query';

import {
  fetchMyDocuments,
  fetchMySubjectAssignments,
  fetchMyTodaySchedule,
  fetchStaffDashboard,
  fetchStaffMe,
} from '@/services/staff-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';

export function useStaffMe({ enabled = true }: { enabled?: boolean } = {}) {
  const authReady = useAuthQueryEnabled();
  return useQuery({
    queryKey: ['staff-portal', 'me'],
    queryFn: fetchStaffMe,
    enabled: enabled && authReady,
    staleTime: 60_000,
  });
}

export function useStaffDashboard() {
  const authReady = useAuthQueryEnabled();
  return useQuery({
    queryKey: ['staff-portal', 'dashboard'],
    queryFn: fetchStaffDashboard,
    enabled: authReady,
    staleTime: 30_000,
  });
}

export function useMySubjectAssignments() {
  return useQuery({
    queryKey: ['staff-portal', 'subject-assignments'],
    queryFn: fetchMySubjectAssignments,
    staleTime: 60_000,
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ['staff-portal', 'documents'],
    queryFn: fetchMyDocuments,
    staleTime: 60_000,
  });
}

export function useMyTodaySchedule() {
  return useQuery({
    queryKey: ['staff-portal', 'timetable', 'today'],
    queryFn: fetchMyTodaySchedule,
    staleTime: 60_000,
  });
}
