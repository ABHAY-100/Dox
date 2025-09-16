import { useAtom } from "jotai";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userAtom } from "@/store/auth";
import { apiRequest } from "@/lib/axios";
import { User } from "@/types";
import React from "react";

export const useAuth = () => {
  const [user, setUser] = useAtom(userAtom);
  const queryClient = useQueryClient();

  const {
    data: authData,
    isLoading: isAuthLoading,
    refetch,
  } = useQuery({
    queryKey: ["auth"],
    queryFn: async (): Promise<{ user: User | null }> => {
      try {
        const response = await apiRequest.get("http://localhost:8080/api/v1/profile/get-profile");
        return response.data;
      } catch (error) {
        return { user: null };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (authData?.user) {
      setUser(authData.user);
    } else {
      setUser(null);
    }
  }, [authData, setUser]);

  const logoutMutation = useMutation({
  mutationFn: async () => {
      await apiRequest.post("/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  },
  onError: (error) => {
    console.error("Logout error:", error);
    queryClient.clear();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  },
});


  const loginWithGitHub = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/auth/github`;
  };

  const checkAuth = async () => {
    const result = await refetch();
    return result.data;
  };

  return {
    user: authData?.user || null,
    isAuthenticated: !!authData?.user,
    isLoading: isAuthLoading,
    loginWithGitHub,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    checkAuth,
    refetch,
  };
};
