import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/axios';

export const useUser = () => {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await apiRequest.get('profile/get-profile');
      return response.data.profile;
    },
    staleTime: 5 * 60 * 1000,
  });
};
