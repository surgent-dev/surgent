/**
 * GitHub Routes - Handles OAuth callback and webhooks
 *
 * Patterns from:
 * - @octokit/webhooks.js: Signature verification
 * - probot/probot: Event routing
 */

import { Hono } from "hono";
import { Webhooks } from "@octokit/webhooks";
import { db } from "@repo/db";
import type { AppContext } from "@/types/application";
import { createGitHubApp } from "@/apis/github";

const github = new Hono<AppContext>();

/**
 * GET /api/github/callback
 * Called by GitHub after user installs the app (Setup URL redirect)
 */
github.get("/callback", async (c) => {
  const installationIdStr = c.req.query("installation_id");
  const state = c.req.query("state");
  const code = c.req.query("code");

  const githubApp = createGitHubApp(c.env);
  if (!githubApp) {
    return c.text("GitHub App not configured", 500);
  }

  let payload: { userId: string; projectId: string } | null = null;
  if (state) {
    payload = await githubApp.verifyState(state);
    if (!payload) {
      return c.text("Invalid or expired state", 400);
    }
  }

  try {
    let userId: string | undefined = payload?.userId;
    const projectId = payload?.projectId;
    let installationId: number | null = null;

    if (installationIdStr) {
      installationId = parseInt(installationIdStr, 10);
      if (!userId) {
        const existingUser = await db
          .selectFrom("github_installations")
          .select("userId")
          .where("installationId", "=", installationId)
          .executeTakeFirst();
        userId = existingUser?.userId;
      }
    }

    if (!userId) {
      return c.text("Missing installation_id or state", 400);
    }

    const redirectBase = c.env.BETTER_AUTH_URL || new URL(c.req.url).origin;
    const redirectUrl = new URL(
      "/api/github/callback",
      redirectBase,
    ).toString();
    const oauthAuth = code
      ? await githubApp.exchangeUserAccessToken(
          code,
          redirectUrl,
          state ?? undefined,
        )
      : null;

    const tokenUpdate = oauthAuth
      ? {
          userAccessToken: oauthAuth.token,
          userAccessTokenExpiresAt:
            "expiresAt" in oauthAuth && oauthAuth.expiresAt
              ? new Date(oauthAuth.expiresAt as string)
              : null,
          userRefreshToken:
            "refreshToken" in oauthAuth
              ? (oauthAuth.refreshToken as string)
              : null,
          userRefreshTokenExpiresAt:
            "refreshTokenExpiresAt" in oauthAuth &&
            oauthAuth.refreshTokenExpiresAt
              ? new Date(oauthAuth.refreshTokenExpiresAt as string)
              : null,
        }
      : {};

    if (installationId) {
      const installation = await githubApp.getInstallation(installationId);
      const accountLogin = installation.account.login;

      // Upsert installation (pattern from renovate - handle reinstalls gracefully)
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
        account: accountLogin,
      });
    } else if (oauthAuth) {
      await db
        .updateTable("github_installations")
        .set({
          updatedAt: new Date(),
          userAccessToken: tokenUpdate.userAccessToken,
          userAccessTokenExpiresAt: tokenUpdate.userAccessTokenExpiresAt,
          userRefreshToken: tokenUpdate.userRefreshToken,
          userRefreshTokenExpiresAt: tokenUpdate.userRefreshTokenExpiresAt,
        })
        .where("userId", "=", userId)
        .execute();
    }

    if (!installationId) {
      console.log("[github] User authorization saved", { userId });
    }

    if (projectId) {
      return c.redirect(
        `${c.env.CLIENT_ORIGIN}/project/${projectId}?github=installed`,
      );
    }
    return c.redirect(`${c.env.CLIENT_ORIGIN}/dashboard?github=installed`);
  } catch (err) {
    console.error("[github] Callback failed", err);
    return c.text("Failed to process installation", 500);
  }
});

/**
 * POST /api/github/webhook
 * Receives GitHub webhook events with signature verification
 *
 * Pattern from @octokit/webhooks.js:
 * - Verify X-Hub-Signature-256 header
 * - Route events to handlers
 */
github.post("/webhook", async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[github] GITHUB_WEBHOOK_SECRET not configured");
    return c.text("Webhook not configured", 500);
  }

  const signature = c.req.header("X-Hub-Signature-256");
  const event = c.req.header("X-GitHub-Event");
  const deliveryId = c.req.header("X-GitHub-Delivery");

  if (!signature || !event) {
    return c.text("Missing signature or event header", 400);
  }

  const body = await c.req.text();

  // Verify signature using @octokit/webhooks
  const webhooks = new Webhooks({ secret });
  const isValid = await webhooks.verify(body, signature);

  if (!isValid) {
    console.error("[github] Invalid webhook signature", { deliveryId, event });
    return c.text("Invalid signature", 401);
  }

  const payload = JSON.parse(body);
  console.log("[github] Webhook received", {
    event,
    deliveryId,
    action: payload.action,
  });

  // Handle events (pattern from probot - event routing)
  try {
    switch (event) {
      case "installation":
        await handleInstallationEvent(payload);
        break;

      case "installation_repositories":
        // Repos added/removed from installation
        console.log("[github] Repositories changed", {
          action: payload.action,
          added: payload.repositories_added?.length || 0,
          removed: payload.repositories_removed?.length || 0,
        });
        break;

      case "push":
        // Could trigger syncs or notifications
        console.log("[github] Push event", {
          repo: payload.repository?.full_name,
          ref: payload.ref,
          commits: payload.commits?.length || 0,
        });
        break;

      default:
        console.log("[github] Unhandled event", { event });
    }

    return c.text("OK");
  } catch (err) {
    console.error("[github] Webhook handler failed", { event, error: err });
    return c.text("Handler failed", 500);
  }
});

/**
 * Handle installation events (created, deleted, suspend, unsuspend)
 * Pattern from renovate: Clean up on uninstall
 */
async function handleInstallationEvent(payload: {
  action: string;
  installation: { id: number; account: { login: string; type: string } };
}) {
  const { action, installation } = payload;
  const installationId = installation.id;

  switch (action) {
    case "created":
      console.log("[github] Installation created via webhook", {
        installationId,
        account: installation.account.login,
      });
      // Note: We handle this in the callback route, not here
      // Webhook arrives before user is redirected back
      break;

    case "deleted":
      // Clean up installation record
      await db
        .deleteFrom("github_installations")
        .where("installationId", "=", installationId)
        .execute();

      // Also clear github data from any connected projects
      // (Optional: could keep it but mark as disconnected)
      console.log("[github] Installation deleted", { installationId });
      break;

    case "suspend":
      console.log("[github] Installation suspended", { installationId });
      break;

    case "unsuspend":
      console.log("[github] Installation unsuspended", { installationId });
      break;
  }
}

export default github;
