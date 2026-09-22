import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/Card';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Card className="p-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
            <p className="mb-6 mt-1.5 text-sm text-muted">Login to continue preparing.</p>
            <AuthForm mode="login" />
          </Card>
        </div>
      </main>
    </div>
  );
}
