import { ReactNode } from 'react';
import { Trophy } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const currentYear = new Date().getFullYear();
  const appIdentifier = encodeURIComponent(
    typeof window !== 'undefined' ? window.location.hostname : 'gta-horse-betting'
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b-4 border-accent bg-card shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-lg">
              <Trophy className="h-8 w-8 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">
                GTA Horse Betting
              </h1>
              <p className="text-sm text-muted-foreground font-semibold">
                Value Detection • Learning System • ROI Tracking
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            © {currentYear} • Built with ❤️ using{' '}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${appIdentifier}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-accent transition-colors font-semibold"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
