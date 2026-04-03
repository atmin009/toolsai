import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "outline" }> =
  {
    draft_topic: { label: "Draft topic", variant: "outline" },
    approved_topic: { label: "Approved", variant: "success" },
    generating_article: { label: "Generating", variant: "warning" },
    article_draft: { label: "Article draft", variant: "warning" },
    ready_for_publish: { label: "Ready", variant: "success" },
    published_later: { label: "Scheduled (WP later)", variant: "default" },
  };

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_MAP[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
