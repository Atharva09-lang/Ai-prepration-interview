import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/Card';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Create your account</h1>
            <p className="mb-6 mt-1.5 text-sm text-muted">
              Start turning job descriptions into prep kits.
            </p>
            <AuthForm mode="register" />
          </Card>
        </div>
      </main>
    </div>
  );
}
