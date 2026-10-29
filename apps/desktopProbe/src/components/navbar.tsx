import {
  ChatBubbleIcon,
  Crosshair2Icon,
  FileTextIcon,
  GearIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  QuestionMarkCircledIcon,
  ReaderIcon,
  SunIcon,
} from '@radix-ui/react-icons';
import { RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Icons } from '@/components/icons';
import { useAppState } from '@/hooks/appState';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { useTheme } from 'next-themes';

export function Navbar() {
  // Hook to get the current location
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { isScanning, newUpdate } = useAppState();

  const hasUpdate = !!newUpdate;

  const navItems = [
    { name: 'Jobs', path: '/', icon: <HomeIcon className="h-7 w-7" /> },
    {
      name: 'Searches',
      path: '/links',
      icon: <MagnifyingGlassIcon className="h-7 w-7" />,
    },
    {
      name: 'AI Filters',
      path: '/filters',
      icon: <Crosshair2Icon className="h-7 w-7" />,
    },
    {
      name: 'CV Builder',
      path: '/cv',
      icon: <FileTextIcon className="h-7 w-7" />,
    },
    {
      // the page is "Future training (CPD)"; the full name doesn't fit the menu
      name: 'Training (CPD)',
      path: '/training',
      icon: <ReaderIcon className="h-7 w-7" />,
    },
    {
      name: 'Feedback',
      path: '/feedback',
      icon: <ChatBubbleIcon className="h-7 w-7" />,
    },
    {
      name: 'Settings',
      path: '/settings',

      icon: (
        <div className="relative">
          <GearIcon className="h-7 w-7" />
          {hasUpdate && <div className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-destructive"></div>}
        </div>
      ),
    },
    {
      name: 'Help',
      path: '/help',
      icon: <QuestionMarkCircledIcon className="h-7 w-7" />,
    },
  ];

  const Logo = () =>
    isScanning ? <RefreshCw className="h-7 w-7 animate-spin" /> : <Icons.logo className="h-7 w-7"></Icons.logo>;

  return (
    <nav className="fixed z-50 flex h-screen w-44 flex-col items-start justify-between overflow-y-auto border-r border-muted-foreground/20 px-4 py-6 md:w-52 md:px-8 md:py-10">
      <div className="flex flex-col items-start gap-5">
        <Link to={isScanning ? '/links' : '/'} className="mb-10 md:mb-14">
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger className="flex gap-3">
                <Logo />
                <span className="text-lg">{isScanning ? 'Scanning ...' : 'Foundation'}</span>
              </TooltipTrigger>

              <TooltipContent side="right" className="hidden">
                {isScanning ? 'Scanning for new jobs ...' : 'Foundation'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Link>

        {navItems.map((item) => (
          <TooltipProvider delayDuration={500} key={item.name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  key={item.name}
                  to={item.path}
                  className={`after:transition-width relative flex items-center gap-3 p-1 duration-200 after:absolute after:bottom-0 after:right-0 after:block after:h-0.5 after:w-0 after:bg-primary after:transition-all after:content-[''] hover:text-primary hover:after:w-full ${
                    location.pathname === item.path && 'text-primary'
                  }`}
                >
                  {item.icon}
                  <span className="whitespace-nowrap text-base">{item.name}</span>
                </Link>
              </TooltipTrigger>

              <TooltipContent side="right" className="hidden">
                {item.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>

      {/* theme toggle */}
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-3 p-1 hover:text-primary"
            >
              {theme === 'dark' ? <SunIcon className="h-7 w-7" /> : <MoonIcon className="h-7 w-7" />}
              <span className="whitespace-nowrap text-base">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </TooltipTrigger>

          <TooltipContent side="right" className="hidden">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </nav>
  );
}
