"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalyticsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Analytics</CardTitle>
        <CardDescription>Prediction market performance over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">Chart visualization will go here</p>
        </div>
      </CardContent>
    </Card>
  );
}


