import { FC } from 'react';
import { Link } from 'react-router-dom';

export const Footer: FC = () => {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-24 md:flex-row md:py-0">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="SandBlox Logo" className="h-6 w-6" />
          <p className="text-center text-sm text-muted-foreground">
            Built with ❤️ by{' '}
            <a
              href="https://particlecs.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium gradient-text hover:text-foreground"
            >
              Particle CS
            </a>
          </p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://x.com/particle_cs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            X
          </a>
          <a
            href="https://discord.gg/particlecs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Discord
          </a>
          <Link
            to="/docs"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Documentation
          </Link>
          <Link
            to="/terms"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}; 