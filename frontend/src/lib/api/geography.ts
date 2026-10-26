'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const statesQueryKey = ['backend', 'states'] as const;
export const citiesQueryKey = ['backend', 'cities'] as const;
export const areasQueryKey = ['backend', 'areas'] as const;

/* ═══════════════════════════════════════════════════════════════════════════
   States
   ═══════════════════════════════════════════════════════════════════════════ */
export interface StateRow {
  id: string;
  name: string;
  is_active: boolean;
  active_city_count?: number;
  created_at: string;
  updated_at: string;
}

export interface StatePayload {
  name?: string;
  is_active?: boolean;
}

export interface ListStatesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface PaginatedStatesResponse {
  data: StateRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

function queryString(params: object) {
  const searchParams = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function useStatesList(params: ListStatesParams) {
  return useQuery<PaginatedStatesResponse>({
    queryKey: [...statesQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedStatesResponse>(`/states${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateState() {
  return useMutation<StateRow, Error, StatePayload>({
    mutationFn: body => backendPost<StateRow, StatePayload>('/states', body),
  });
}

export function useUpdateState() {
  return useMutation<StateRow, Error, { id: string; data: StatePayload }>({
    mutationFn: ({ id, data }) => backendPatch<StateRow, StatePayload>(`/states/${id}`, data),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Cities
   ═══════════════════════════════════════════════════════════════════════════ */
export interface CityRow {
  id: string;
  state_id: string;
  state_name?: string | null;
  name: string;
  is_active: boolean;
  active_area_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CityPayload {
  state_id?: string;
  name?: string;
  is_active?: boolean;
}

export interface ListCitiesParams {
  page?: number;
  limit?: number;
  search?: string;
  state_id?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface PaginatedCitiesResponse {
  data: CityRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export function useCitiesList(params: ListCitiesParams) {
  return useQuery<PaginatedCitiesResponse>({
    queryKey: [...citiesQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedCitiesResponse>(`/cities${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateCity() {
  return useMutation<CityRow, Error, CityPayload>({
    mutationFn: body => backendPost<CityRow, CityPayload>('/cities', body),
  });
}

export function useUpdateCity() {
  return useMutation<CityRow, Error, { id: string; data: CityPayload }>({
    mutationFn: ({ id, data }) => backendPatch<CityRow, CityPayload>(`/cities/${id}`, data),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Areas
   ═══════════════════════════════════════════════════════════════════════════ */
export interface AreaRow {
  id: string;
  city_id: string;
  city_name?: string | null;
  state_id?: string | null;
  state_name?: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AreaPayload {
  city_id?: string;
  name?: string;
  is_active?: boolean;
}

export interface ListAreasParams {
  page?: number;
  limit?: number;
  search?: string;
  city_id?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface PaginatedAreasResponse {
  data: AreaRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export function useAreasList(params: ListAreasParams) {
  return useQuery<PaginatedAreasResponse>({
    queryKey: [...areasQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedAreasResponse>(`/areas${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateArea() {
  return useMutation<AreaRow, Error, AreaPayload>({
    mutationFn: body => backendPost<AreaRow, AreaPayload>('/areas', body),
  });
}

export function useUpdateArea() {
  return useMutation<AreaRow, Error, { id: string; data: AreaPayload }>({
    mutationFn: ({ id, data }) => backendPatch<AreaRow, AreaPayload>(`/areas/${id}`, data),
  });
}
