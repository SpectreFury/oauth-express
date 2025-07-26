import { Router } from "express";
import { randomBytes } from "crypto";
import { Redis } from "@upstash/redis";
import { PrismaClient } from "../generated/prisma";
import crypto from "crypto";

const prisma = new PrismaClient();
const redis = Redis.fromEnv();
const authRouter = Router();
const stateStore = new Map();

type State = {
  timestamp: number;
  userId: string;
  redirectURL: string;
};

authRouter.get("/google", (req, res) => {
  // Create query params for the request and redirect
  console.log("Req query: ", req.query.redirectURL);

  // State to secure CSRF attacks
  const state = randomBytes(32).toString("hex");

  stateStore.set(state, {
    timestamp: Date.now(),
    userId: req.query.userId || null,
    redirectURL: req.query.redirectURL,
  });

  const authURL = new URL(process.env.GOOGLE_AUTH_URL!);

  authURL.searchParams.append("client_id", process.env.GOOGLE_CLIENT_ID!); // Google Client ID;
  authURL.searchParams.append("redirect_uri", process.env.REDIRECT_URI!); // Redirect URL
  authURL.searchParams.append("response_type", "code"); // We will get authorization code from google
  authURL.searchParams.append("scope", "openid email profile"); // We want id, email, and password from google
  authURL.searchParams.append("state", state); // Unique identifier
  authURL.searchParams.append("access_type", "offline"); // Refresh token
  authURL.searchParams.append("prompt", "consent");

  res.redirect(authURL.toString());
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) throw new Error("Oauth error");
    if (!code || !state) throw new Error("Missing required paramaters");

    const store: State = stateStore.get(state);
    if (!store) throw new Error("Invalid or expired state parameter");

    console.log("Store: ", store);

    if (Date.now() - store.timestamp > 5 * 60 * 1000) {
      stateStore.delete(state);
      res
        .json(400)
        .json({ success: false, message: "State parameter expired" });
    }

    stateStore.delete(state);

    // We exchange the authorization code for access token
    const params = new URLSearchParams();
    params.append("client_id", process.env.GOOGLE_CLIENT_ID!);
    params.append("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
    params.append("code", code as string);
    params.append("grant_type", "authorization_code");
    params.append("redirect_uri", process.env.REDIRECT_URI!);

    const response = await fetch(process.env.GOOGLE_TOKEN_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) throw new Error("Error during token exchange");

    const result = await response.json();
    const { access_token, refresh_token, expires_in, token_type } = result;

    console.log("Access Token: ", access_token);
    console.log("Refresh Token: ", refresh_token);
    console.log("Expires In: ", expires_in);
    console.log("Token Type: ", token_type);

    // Get the user info from google
    const userResponse = await fetch(process.env.GOOGLE_USER_INFO_URL!, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const googleUser = await userResponse.json();

    // Find the user or create them
    let user = null;
    user = await prisma.user.findFirst({
      where: {
        google_id: googleUser.id,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          google_id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        },
      });
    }

    // Set the tokens in Redis
    await redis.hmset(`auth:${user.id}:tokens`, {
      access_token: access_token,
      refresh_token: refresh_token,
      expires_in: Date.now() + expires_in * 1000,
    });

    // Generate a session and set it in Redis
    const sessionId = generateSessionId();
    await redis.setex(`session:${sessionId}`, 86400, user.id);

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
    });

    res.redirect(`${store.redirectURL}/dashboard`);
  } catch (error: any) {
    console.error("Error: ", error.message);
    res.status(500).json({ success: false, message: error });
  }
});

function generateSessionId() {
  return crypto.randomBytes(32).toString("hex"); // 64 character hex string
}

export { authRouter };
