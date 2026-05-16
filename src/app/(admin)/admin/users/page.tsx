import Link from "next/link";
import { listUsersWithStats } from "@/lib/admin-users";
import { isAdminEmail } from "@/lib/admin";
import { DeleteUserButton } from "./delete-user-button";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

const PLAN_STYLES: Record<string, string> = {
  free: "bg-surface text-ink-3 border-line-soft",
  starter: "bg-sky-50 text-sky-800 border-sky-200",
  pro: "bg-emerald-50 text-emerald-800 border-emerald-200",
  studio: "bg-amber-50 text-amber-800 border-amber-200",
  agency: "bg-violet-50 text-violet-800 border-violet-200",
};

export default async function UsersPage() {
  const users = await listUsersWithStats();

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[clamp(2rem,2.4vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
          Users
        </h1>
        <p className="mt-2 max-w-[58ch] text-[14px] text-ink-3">
          {users.length} accounts. Click any row to see uploaded sources and
          generated outputs.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-line-soft bg-paper">
        <table className="min-w-full text-[13px]">
          <thead className="border-b border-line-soft bg-surface/40 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Quota</th>
              <th className="px-4 py-3 text-right">Gens</th>
              <th className="px-4 py-3 text-right">OK</th>
              <th className="px-4 py-3 text-right">Fail</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-line-soft last:border-b-0 hover:bg-surface/40"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {u.email}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                      PLAN_STYLES[u.plan] ?? PLAN_STYLES.free
                    }`}
                  >
                    {u.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                  {u.quotaBalance}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {u.totalGenerations}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                  {u.succeeded || ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                  {u.failed || ""}
                </td>
                <td className="px-4 py-3 text-ink-3">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-ink-3">{fmtDate(u.lastGenAt)}</td>
                <td className="px-4 py-3 text-right">
                  <DeleteUserButton
                    userId={u.id}
                    email={u.email}
                    disabled={isAdminEmail(u.email)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
