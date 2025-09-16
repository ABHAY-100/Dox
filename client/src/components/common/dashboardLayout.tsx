"use client";

import React from "react";
import RepoCard from "./repoCard";
import { useConnectedRepos } from "@/hooks/getRepos";
import { useRepos } from "@/hooks/getRepos";
import { Skeleton } from "@/components/ui/skeleton";

const DashboardLayout = () => {
  const { data: repos = [], isLoading, error } = useRepos();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <h2 className="text-3xl font-black">Your Repositories</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <h2 className="text-3xl font-black">Your Repositories</h2>
        <div className="text-destructive">
          Error loading repositories. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-10">
      <h2 className="text-3xl font-black">Your Repositories</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {repos.length === 0 ? (
          <div className="col-span-2 text-center text-muted-foreground py-10">
            No repositories connected yet.
          </div>
        ) : (
          repos.map((repo: any) => (
            <RepoCard
              key={repo.id}
              name={repo.name}
              description={repo.description}
              isPrivate={repo.private}
              url={`https://github.com/${repo.full_name || `${repo.owner?.login}/${repo.name}`}`}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;
