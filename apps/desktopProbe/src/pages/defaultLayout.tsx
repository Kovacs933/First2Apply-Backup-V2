import { cn } from '@/lib/utils';

import { Navbar } from '../components/navbar';

/**
 * Default layout for all pages
 */
export function DefaultLayout({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="ml-44 md:ml-52">
        <div className={cn('mx-auto min-h-screen max-w-[1536px]', className)}>{children}</div>
      </main>
    </>
  );
}
