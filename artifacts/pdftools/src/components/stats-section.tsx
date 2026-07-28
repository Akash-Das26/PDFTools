import { useGetStats } from "@workspace/api-client-react";
import { FileText, TrendingUp, HardDrive, Zap } from "lucide-react";

export function StatsSection() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading) {
    return (
      <div className="w-full py-16 bg-card/50">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
                <div className="w-20 h-6 bg-muted rounded animate-pulse" />
                <div className="w-24 h-4 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statItems = [
    {
      icon: FileText,
      value: stats.filesProcessed.toLocaleString(),
      label: "Files Processed",
      testId: "stat-files-processed",
    },
    {
      icon: TrendingUp,
      value: stats.totalJobs.toLocaleString(),
      label: "Total Jobs",
      testId: "stat-total-jobs",
    },
    {
      icon: HardDrive,
      value: `${stats.totalInputSizeMb.toFixed(1)} MB`,
      label: "Data Processed",
      testId: "stat-data-processed",
    },
    {
      icon: Zap,
      value: stats.jobsToday.toLocaleString(),
      label: "Jobs Today",
      testId: "stat-jobs-today",
    },
  ];

  return (
    <div className="w-full py-16 bg-card/50 border-y border-border">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {statItems.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-3 text-center"
              data-testid={stat.testId}
            >
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <stat.icon className="w-7 h-7 text-accent" />
              </div>
              <div className="text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
