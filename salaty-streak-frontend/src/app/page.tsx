import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Flame, BookOpen, TrendingUp, Trophy } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-emerald-500" />
            <span className="text-xl font-bold">Salaty Streak</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-600 hover:bg-emerald-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero section */}
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Build your prayer
              <span className="text-emerald-500"> consistency</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              Track your daily prayers, maintain streaks, earn points, and build a lasting habit of prayer.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8">
                  Start Tracking
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-muted/50">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-center mb-12">Stay on track</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-emerald-100 text-emerald-700 mb-4">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Track Prayers</h3>
                <p className="text-muted-foreground">
                  Log each of your 5 daily prayers with status: on time, late, or missed.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-emerald-100 text-emerald-700 mb-4">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Earn Points</h3>
                <p className="text-muted-foreground">
                  Get rewarded for consistency. Earn bonus points for mosque prayers and Fajr on time.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-emerald-100 text-emerald-700 mb-4">
                  <Trophy className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Build Streaks</h3>
                <p className="text-muted-foreground">
                  Complete all 5 prayers daily to maintain your streak and track your best record.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Salaty Streak. Made with ❤️ for the Muslim Ummah.
        </div>
      </footer>
    </div>
  );
}