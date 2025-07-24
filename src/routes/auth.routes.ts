import { Router } from "express";
import { randomBytes } from "crypto";

const authRouter = Router();

authRouter.get("/google", (req, res) => {
  // Create query params for the request and redirect

  // State to secure CSRF attacks
  const state = randomBytes(32).toString("hex");

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

export { authRouter };
