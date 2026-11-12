import type { AccountRoute } from "@/lib/account-routing";

export function backDestination(pathname: string, account: AccountRoute) {
  if (account === "/admin") return pathname === "/notifications" ? "/admin" : "/admin/finance";
  if (account === "/merchant") return pathname === "/notifications" ? "/merchant" : "/merchant/finance";
  if (account === "/driver") {
    if (pathname === "/driver/task-details") return "/driver/orders";
    return pathname === "/notifications" ? "/driver" : "/driver/cash-account";
  }
  if (account !== "/home") return account;
  if (pathname === "/order-details") return "/orders";
  if (pathname === "/orders") return "/home/account";
  if (pathname === "/financial-invoice") return "/invoice";
  return "/home/account";
}
