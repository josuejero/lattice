import { prisma } from "@lattice/db";
import { env } from "@/lib/env";

export async function GET() {
  const result = (await prisma.$queryRawUnsafe(
    "select now() as now"
  )) as { now: string }[];
  return Response.json({
    ok: true,
    now: result?.[0]?.now ?? null,
    environment: env.NODE_ENV,
  });
}
