import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/axios';
import { GitHubRepo } from '@/types';


export const useRepos = () => {
  return useQuery({
    queryKey: ['repos'],
    queryFn: async (): Promise<GitHubRepo[]> => {
      const response = await apiRequest.get('/core/repos');
      return response.data.repos || [];
    },
    enabled: true,
    staleTime: 2 * 60 * 1000,
  });
};


export const useConnectedRepos = () => {
  return useQuery({
    queryKey: ['connected-repos'],
    queryFn: async (): Promise<any[]> => {
      const response = await apiRequest.get('/core/connected-repos');
      return response.data.repos || [];
    },
    staleTime: 1 * 60 * 1000,
  });
};

export const useConnectRepo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ repoName, owner }: { repoName: string; owner: string }) => {
      const response = await apiRequest.post('/core/connect-repo', {
        repoName,
        owner,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-repos'] });
    },
  });
};


export const useDisconnectRepo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repoId: string) => {
      const response = await apiRequest.post('/core/disconnect-repo', {
        repoId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-repos'] });
    },
  });
};
