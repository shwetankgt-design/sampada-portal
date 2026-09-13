"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  PlusCircle,
  LayoutGrid,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  chart: LayoutDashboard,
  inbox: Inbox,
  plus: PlusCircle,
  grid: LayoutGrid,
  settings: Settings,
  users: Users,
  grant: Wallet,
};

export function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  const Icon = ICONS[icon];
  return (
    <Link href={href} className={`gt-nav-link ${active ? "active" : ""}`}>
      <Icon size={16} strokeWidth={2} />
      <span>{label}</span>
    </Link>
  );
}
