import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useI18n } from "@/i18n/I18nContext";

export function UserMenu() {
  const t = useI18n();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 border-[var(--color-border)] px-3 font-normal">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">
            {(user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-[140px] truncate text-left text-sm sm:inline">{user?.email}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-[var(--color-muted)]">{t("user.signedInAs")}</p>
          <p className="truncate text-sm font-medium">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <User className="h-4 w-4" />
          {t("user.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          {t("user.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
