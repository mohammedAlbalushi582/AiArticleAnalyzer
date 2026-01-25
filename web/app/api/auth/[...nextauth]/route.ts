import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const DJANGO_API_URL = process.env.DJANGO_API_URL || "http://localhost:8000/api";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
    CredentialsProvider({
      id: 'magic-link',
      name: 'Magic Link',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token) {
          return null;
        }

        try {
          const response = await fetch(`${DJANGO_API_URL}/users/auth/verify-magic-link/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: credentials.token,
            }),
          });

          if (!response.ok) {
            return null;
          }

          const authData = await response.json();

          return {
            id: authData.user.id.toString(),
            name: authData.user.username || authData.user.first_name,
            email: authData.user.email,
            accessToken: authData.access_token,
            refreshToken: authData.refresh_token,
            provider: "magic-link",
          };
        } catch (error) {
          console.error("Magic link verification failed:", error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const response = await fetch(`${DJANGO_API_URL}/users/login/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          });

          if (!response.ok) {
            return null;
          }

          const tokenData = await response.json();
          console.log("Token data:", tokenData);
          console.log("Login response status:", response.status)
          const userResponse = await fetch(`${DJANGO_API_URL}/users/auth/user/`, {
            headers: {
              Authorization: `Bearer ${tokenData.access}`,
              "Content-Type": "application/json",
            },
          });
          console.log("User response status:", userResponse.status); // Add this

          if (!userResponse.ok) {
            return null;
          }

          const userData = await userResponse.json();
          console.log("User data:", userData);

          return {
            id: userData.id.toString(),
            username: userData.username,
            email: userData.email || "",
            accessToken: tokenData.access,
            refreshToken: tokenData.refresh,
            provider: "credentials",
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const response = await fetch(`${DJANGO_API_URL}/users/auth/google/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              google_id: user.id,
              avatar_url: user.image,
            }),
          });

          if (!response.ok) {
            console.error("Failed to create/get Google user in Django");
            return false;
          }

          const djangoUser = await response.json();
          user.djangoId = djangoUser.user.id;
          user.accessToken = djangoUser.access_token;
          user.refreshToken = djangoUser.refresh_token;

          return true;
        } catch (error) {
          console.error("Google sign-in error:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.provider = account?.provider || "credentials";
        token.djangoId = user.djangoId;
        token.accessTokenExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      }

      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.provider = token.provider as string;
      session.djangoId = token.djangoId as string;
      session.error = token.error as string;
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: '/auth/verify-request',
    error: "/auth/error",
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  debug: process.env.NODE_ENV === "development",
};

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch(`${DJANGO_API_URL}/users/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access,
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      refreshToken: refreshedTokens.refresh ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
