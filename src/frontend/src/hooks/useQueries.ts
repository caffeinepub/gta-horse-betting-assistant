import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Horse, Race, OddsRange } from '../backend';

export function useGetValueBets(horses: Horse[]) {
  const { actor, isFetching } = useActor();

  return useQuery<Horse[]>({
    queryKey: ['valueBets', horses],
    queryFn: async () => {
      if (!actor || horses.length === 0) return [];
      return actor.getValueBets(horses);
    },
    enabled: !!actor && !isFetching && horses.length > 0,
  });
}

export function useLogRace() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (horses: Horse[]) => {
      if (!actor) throw new Error('Actor not initialized');
      return actor.logRace(horses);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['roi'] });
      queryClient.invalidateQueries({ queryKey: ['trustWeights'] });
    },
  });
}

export function useGetRaceHistory() {
  const { actor, isFetching } = useActor();

  return useQuery<Race[]>({
    queryKey: ['raceHistory'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRaceHistory();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetROI() {
  const { actor, isFetching } = useActor();

  return useQuery<number>({
    queryKey: ['roi'],
    queryFn: async () => {
      if (!actor) return 0;
      return actor.getROI();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetTrustWeights() {
  const { actor, isFetching } = useActor();

  return useQuery<Array<[OddsRange, number]>>({
    queryKey: ['trustWeights'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTrustWeights();
    },
    enabled: !!actor && !isFetching,
  });
}
