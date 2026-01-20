import { parseEnv } from "@lattice/shared";

export const env = parseEnv(process.env as Record<string, string | undefined>);
