'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Flame,
  Settings,
  Menu,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Prayers', href: '/prayers', icon: BookOpen },
  { name: 'Streaks', href: '/streaks', icon: Flame },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Topbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center px-6 border-b">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold">Salaty Streak</span>
            </Link>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page title area */}
      <div className="flex-1" />

      {/* Desktop user info */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
          {user?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
      </div>
    </header>
  );
}