import { Router } from "express";
import { randomBytes } from "crypto";

const authRouter = Router();

const stateStore = new Map();

authRouter.get("/google", (req, res) => {
  // Create query params for the request and redirect

  // State to secure CSRF attacks
  const state = randomBytes(32).toString("hex");

  stateStore.set(state, {
    timestamp: Date.now(),
    userId: req.query.userId || null,
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

    console.log("Code: ", code);
    console.log("State: ", state);
    console.log("Error: ", error);

    if (error) throw new Error("Oauth error");
    if (!code || !state) throw new Error("Missing required paramaters");

    const store = stateStore.get(state);
    if (!store) throw new Error("Invalid or expired state parameter");

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

    // Push the refresh to DB and use access to log in

  } catch (error: any) {
    res.status(500).json({ success: false, message: error });
  }
});

export { authRouter };
