import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-navy flex items-center justify-center">
      <SignIn />
    </main>
  );
}
