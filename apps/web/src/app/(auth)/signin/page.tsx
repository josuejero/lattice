import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Sign in</h1>

      <form
        action={async (formData) => {
          "use server";
          const email = String(formData.get("email") ?? "");
          await signIn("credentials", { email, redirectTo: "/dashboard" });
        }}
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        <label>
          Email (dev/test)
          <input
            name="email"
            type="email"
            required
            style={{ width: "100%", padding: 8, marginTop: 6 }}
            placeholder="dev@example.com"
          />
        </label>
        <button type="submit" style={{ padding: 10 }}>
          Continue
        </button>
      </form>

      <hr style={{ margin: "24px 0" }} />

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button type="submit" style={{ padding: 10, width: "100%" }}>
          Continue with Google
        </button>
      </form>

      <p style={{ marginTop: 16, opacity: 0.8 }}>
        If Google env vars are not set, the Google button will fail. Dev sign-in
        works in non-production environments.
      </p>
    </main>
  );
}
