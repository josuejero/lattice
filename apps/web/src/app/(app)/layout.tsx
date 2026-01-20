import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <Link href="/dashboard" style={{ fontWeight: 700 }}>
          Lattice
        </Link>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ opacity: 0.8 }}>{session?.user?.email ?? ""}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
