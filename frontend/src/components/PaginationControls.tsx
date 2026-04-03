import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nContext";

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function PaginationControls({ page, total, pageSize, onPageChange, disabled }: Props) {
  const t = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-sm text-[var(--color-muted)]">
        {t("pagination.summary")
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total))}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          {t("pagination.prev")}
        </Button>
        <span className="min-w-[5rem] text-center text-sm tabular-nums text-zinc-700">
          {t("pagination.pageOf").replace("{page}", String(safePage)).replace("{totalPages}", String(totalPages))}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
}
