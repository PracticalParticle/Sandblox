import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;

    // Apply the theme immediately
    root.classList.toggle('dark', theme === 'dark');
    document.body.classList.toggle('dark', theme === 'dark');

    // Set CSS variables for light and dark themes
    root.style.setProperty('--background', theme === 'dark' ? 'hsl(var(--background-dark))' : 'hsl(var(--background-light))');
    root.style.setProperty('--foreground', theme === 'dark' ? 'hsl(var(--foreground-dark))' : 'hsl(var(--foreground-light))');
    root.style.setProperty('--background-gradient', theme === 'dark' ? 'var(--dark-background-gradient)' : 'var(--light-background-gradient)');

    // Force color update
    document.body.style.color = theme === 'dark' ? 'hsl(214 32% 91%)' : 'hsl(222 47% 11%)';

    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center rounded-lg p-0 hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-primary" />
      ) : (
        <Moon className="h-5 w-5 text-primary" />
      )}
    </button>
  );
} 