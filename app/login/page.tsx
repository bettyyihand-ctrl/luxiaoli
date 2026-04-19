import { login } from "./actions"

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; from?: string }>
}) {
  const searchParams = await props.searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] px-5">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-[var(--color-primary)] grid place-items-center text-white font-semibold text-[22px] shadow-[var(--shadow-card)] mb-4">
            路
          </div>
          <h1 className="text-[var(--color-text-primary)] text-[24px] font-bold leading-none mb-1.5">路小理</h1>
          <p className="text-[var(--color-text-tertiary)] text-[11px] tracking-widest">LEXORA ATELIER</p>
        </div>

        {/* Login card */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-card)]">
          <form action={login} className="space-y-4">
            <input type="hidden" name="from" value={searchParams.from ?? "/"} />
            <input
              type="password"
              name="password"
              placeholder="请输入访问密码..."
              required
              className="w-full min-h-[46px] border-0 rounded-[var(--radius-md)] px-4 py-3 text-[var(--color-text-primary)] text-[14px] bg-[var(--color-bg-subtle)] outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] transition-all placeholder:text-[var(--color-text-tertiary)]"
            />
            <button
              type="submit"
              className="w-full min-h-[46px] border-0 rounded-full bg-[var(--color-primary)] text-white font-semibold text-[15px] hover:bg-[var(--color-primary-deep)] transition-colors cursor-pointer shadow-[var(--shadow-soft)]"
            >
              进入
            </button>
            {searchParams.error && (
              <p className="text-[var(--color-error)] text-[13px] text-center font-medium">
                密码错误，请重试。
              </p>
            )}
          </form>
        </div>

      </div>
    </div>
  )
}
