declare module "@lattice/db" {
  import { PrismaClient } from "@prisma/client";

  export const prisma: PrismaClient;
}
