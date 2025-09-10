"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";

type RepoCardProps = {
  name: string;
  description?: string | null;
  url?: string;
  cloneUrl?: string;
  isPrivate?: boolean;
};

export default function RepoCard({ name, description, url, isPrivate = false}: RepoCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>{name}</CardTitle>
          <Badge variant={isPrivate ? "secondary" : "outline"}>
            {isPrivate ? "Private" : "Public"}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                Open on GitHub
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alert("Create Doc clicked!")}>
              Create Documentation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {description || "No description available."}
        </p>
      </CardContent>
    </Card>
  );
}
