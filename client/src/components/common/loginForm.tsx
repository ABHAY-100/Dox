"use client";

import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { useAuth } from "@/hooks/auth";

const LoginForm = () => {
  const { loginWithGitHub, isLoading, isLoggingOut } = useAuth();

  const handleGitHubLogin = () => {
    loginWithGitHub();
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">
            Login
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email to receive a login link, or login with a provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input
              type="text"
              placeholder="Display name"
              required
              className="py-3 px-3 text-lg"
            />
            <Input
              type="email"
              placeholder="Email address"
              required
              className="py-3 px-3 text-lg"
            />
            <Button type="submit" className="w-full text-lg font-semibold py-3">
              Login
            </Button>
          </form>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 justify-center"
            >
              <FcGoogle size={22} />
              Google
            </Button>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 justify-center cursor-pointer"
              onClick={handleGitHubLogin}
            >
              <FaGithub size={22} />
              GitHub
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms & Privacy Policy.
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
