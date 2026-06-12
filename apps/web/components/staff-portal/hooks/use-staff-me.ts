'use client';

import { useQuery } from '@tanstack/react-query';

import {
  fetchMyDocuments,
  fetchMySubjectAssignments,
  fetchMyTodaySchedule,
  fetchStaffDashboard,
  fetchStaffMe,
} from '@/services/staff-portal';

export function useStaffMe({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['staff-portal', 'me'],
    queryFn: fetchStaffMe,
    enabled,
    staleTime: 60_000,
  });
}

export function useStaffDashboard() {
  return useQuery({
    queryKey: ['staff-portal', 'dashboard'],
    queryFn: fetchStaffDashboard,
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
