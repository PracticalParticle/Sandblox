import { FC } from 'react';

export const Footer: FC = () => {
  return (
    <footer className="border-t py-6 md:py-0 glass">
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
            href="https://twitter.com/Particlecs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Twitter
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
            href="https://docs.particlecs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Documentation
          </a>
        </div>
      </div>
    </footer>
  );
}; 