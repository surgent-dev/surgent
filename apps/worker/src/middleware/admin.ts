import { Context, Next } from "hono";
import type { AppContext } from "@/types/application";

const ADMIN_EMAIL = "bahodirrajabovb@gmail.com";

export async function requireAdmin(c: Context<AppContext>, next: Next) {
  const user = c.get("user");
  const session = c.get("session");

  if (!user || !session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (user.email !== ADMIN_EMAIL) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return next();
}
