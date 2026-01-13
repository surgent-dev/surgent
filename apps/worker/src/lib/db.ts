import { createClient } from "@repo/db";
import { config } from "./config";

if (!config.database.url) throw new Error("DATABASE_URL not set");

export const { db, dialect } = createClient(config.database.url, config.database.type);
