import * as React from "react";
import { auth, signOut } from "@/auth";
import { prisma } from "@lattice/db";
import Link from "next/link";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const calendarConnection =
    session?.user?.id &&
    (await prisma.calendarConnection.findFirst({
      where: {
        userId: session.user.id,
        provider: "GOOGLE",
        status: "ACTIVE",
      },
      select: { id: true },
    }));
  const showDemoBanner = Boolean(session?.user?.id && !calendarConnection);

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Availability", href: "/availability" },
    env.SUGGESTIONS_ENABLED ? { label: "Suggestions", href: "/suggestions" } : null,
    { label: "Audit log", href: "/audit" },
    env.EVENTS_ENABLED ? { label: "Events", href: "/events" } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight focus-visible:ring-ring focus-visible:ring-2"
          >
            Lattice
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Navigate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {navLinks.map((link, index) => (
                <React.Fragment key={`${link.href}-${index}`}>
                  <DropdownMenuItem asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                  {index === 1 && <DropdownMenuSeparator />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session?.user?.email ?? ""}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      {showDemoBanner && (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-center text-sm text-muted-foreground">
          Demo mode: using simulated busy blocks
        </div>
      )}

      {children}
    </div>
  );
}
