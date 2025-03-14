import { FC } from 'react';

export const Footer: FC = () => {
  return (
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
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
          <a
            href="/docs"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Documentation
          </a>
          <a
            href="/terms"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Terms
          </a>
          <a
            href="/privacy"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </a>
        </div>
      </div>

  );
}; 