/**
 * GitHub Routes - OAuth callback and webhooks
 */

import { Hono } from "hono";
import { Webhooks } from "@octokit/webhooks";
import { db } from "@/lib/db";
import type { AppContext } from "@/types/application";
import { createGitHubApp } from "@/apis/github";
import { config } from "@/lib/config";

const github = new Hono<AppContext>();

/**
 * GET /api/github/callback
 * Called by GitHub after user installs the app
 */
github.get("/callback", async (c) => {
  const installationIdStr = c.req.query("installation_id");
  const state = c.req.query("state");
  const code = c.req.query("code");

  const githubApp = createGitHubApp();
  if (!githubApp) {
    return c.text("GitHub App not configured", 500);
  }

  const payload = state ? await githubApp.verifyState(state) : null;
  if (state && !payload) {
    return c.text("Invalid or expired state", 400);
  }

  try {
    let userId = payload?.userId;
    const projectId = payload?.projectId;
    let installationId: number | null = null;

    if (installationIdStr) {
      installationId = parseInt(installationIdStr, 10);

      if (!userId) {
        const existing = await db
          .selectFrom("github_installations")
          .select("userId")
          .where("installationId", "=", installationId)
          .executeTakeFirst();
        userId = existing?.userId;
      }
    }

    if (!userId) {
      return c.text("Missing installation_id or state", 400);
    }

    // Exchange code for OAuth token
    const redirectBase = config.auth.baseUrl || new URL(c.req.url).origin;
    const redirectUrl = new URL("/api/github/callback", redirectBase).toString();

    const oauthAuth = code ? await githubApp.exchangeUserAccessToken(code, redirectUrl, state ?? undefined) : null;

    const tokenUpdate = oauthAuth
      ? {
          userAccessToken: oauthAuth.token,
          userAccessTokenExpiresAt:
            "expiresAt" in oauthAuth && oauthAuth.expiresAt ? new Date(oauthAuth.expiresAt as string) : null,
          userRefreshToken: "refreshToken" in oauthAuth ? (oauthAuth.refreshToken as string) : null,
          userRefreshTokenExpiresAt:
            "refreshTokenExpiresAt" in oauthAuth && oauthAuth.refreshTokenExpiresAt
              ? new Date(oauthAuth.refreshTokenExpiresAt as string)
              : null,
        }
      : {};

    // Save installation
    if (installationId) {
      const installation = await githubApp.getInstallation(installationId);

      const existing = await db
        .selectFrom("github_installations")
        .select("id")
        .where("installationId", "=", installationId)
        .executeTakeFirst();

      if (existing) {
        await db
          .updateTable("github_installations")
          .set({
            userId,
            accountLogin: installation.account.login,
            accountType: installation.account.type,
            ...tokenUpdate,
            updatedAt: new Date(),
          })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await db
          .insertInto("github_installations")
          .values({
            userId,
            installationId,
            accountLogin: installation.account.login,
            accountType: installation.account.type,
            ...tokenUpdate,
          })
          .execute();
      }

      console.log("[github] Installation saved", {
        installationId,
        userId,
        account: installation.account.login,
      });
    } else if (oauthAuth) {
      await db
        .updateTable("github_installations")
        .set({ updatedAt: new Date(), ...tokenUpdate })
        .where("userId", "=", userId)
        .execute();

      console.log("[github] User authorization saved", { userId });
    }

    // Redirect back to app
    const redirect = projectId
      ? `${config.server.clientOrigin}/project/${projectId}?github=installed`
      : `${config.server.clientOrigin}/dashboard?github=installed`;

    return c.redirect(redirect);
  } catch (err) {
    console.error("[github] Callback failed", err);
    return c.text("Failed to process installation", 500);
  }
});

/**
 * POST /api/github/webhook
 * Receives GitHub webhook events
 */
github.post("/webhook", async (c) => {
  const secret = config.github.webhookSecret;
  if (!secret) {
    return c.text("Webhook not configured", 500);
  }

  const signature = c.req.header("X-Hub-Signature-256");
  const event = c.req.header("X-GitHub-Event");

  if (!signature || !event) {
    return c.text("Missing signature or event header", 400);
  }

  const body = await c.req.text();
  const webhooks = new Webhooks({ secret });

  if (!(await webhooks.verify(body, signature))) {
    return c.text("Invalid signature", 401);
  }

  const payload = JSON.parse(body);
  console.log("[github] Webhook received", { event, action: payload.action });

  try {
    if (event === "installation" && payload.action === "deleted") {
      const installationId = payload.installation.id;

      await db.deleteFrom("github_installations").where("installationId", "=", installationId).execute();

      console.log("[github] Installation deleted", { installationId });
    }

    return c.text("OK");
  } catch (err) {
    console.error("[github] Webhook handler failed", { event, error: err });
    return c.text("Handler failed", 500);
  }
});

export default github;
