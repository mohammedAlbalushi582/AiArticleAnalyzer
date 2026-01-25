import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    djangoId?: string;
    error?: string;
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    djangoId?: string | number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    djangoId?: string | number;
  }
}