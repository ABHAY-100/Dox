import { atom } from "jotai";

export const tokenAtom = atom<string | null>(null);
export const userAtom = atom<{ email: string; name?: string; avatar?: string } | null>(null);