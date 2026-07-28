import { Link } from "wouter";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

const categoryColors: Record<string, string> = {
  organize: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  convert: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300",
  optimize: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
  security: "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300",
};

export function ToolCard({ id, name, description, icon: Icon, category }: ToolCardProps) {
  const colorClass = categoryColors[category] || categoryColors.organize;

  return (
    <Link
      href={`/tools/${id}`}
      className="group relative block rounded-lg border border-card-border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
      data-testid={`card-tool-${id}`}
    >
      <div className="flex flex-col gap-4">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", colorClass)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-card-foreground mb-1 group-hover:text-primary transition-colors">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
