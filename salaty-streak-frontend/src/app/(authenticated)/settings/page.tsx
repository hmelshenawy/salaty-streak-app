'use client';

import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Globe, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" /> Name
              </Label>
              <p className="font-medium">{user.name}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> Email
              </Label>
              <p className="font-medium">{user.email}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" /> Gender
              </Label>
              <p className="font-medium">{user.gender || 'Not set'}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" /> Timezone
              </Label>
              <p className="font-medium">{user.timezone}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" /> Member since
              </Label>
              <p className="font-medium">
                {format(new Date(user.createdAt), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}