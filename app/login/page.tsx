import { login } from "./actions"

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; from?: string }>
}) {
  const searchParams = await props.searchParams;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
      <div className="w-full max-w-sm border border-[rgba(17,17,17,0.14)] rounded-sm bg-white p-6 md:p-8 shadow-[var(--shadow-card)]">
        <div className="text-center mb-8">
          <div className="mx-auto w-[42px] h-[42px] grid place-items-center rounded-sm text-[#111] bg-[#FDE047] font-serif font-semibold text-[20px] mb-3">路</div>
          <h1 className="font-serif text-[26px] font-semibold text-[#111] leading-none mb-1.5">路小理</h1>
          <p className="text-[var(--color-text-secondary)] text-[13px] tracking-wide">LEXORA ATELIER</p>
        </div>
        <form action={login} className="space-y-4">
          <input type="hidden" name="from" value={searchParams.from ?? "/"} />
          <div>
            <input
              type="password"
              name="password"
              placeholder="Enter secure passport..."
              required
              className="w-full min-h-[46px] border border-[rgba(17,17,17,0.16)] rounded-sm p-[12px] text-[var(--color-text-primary)] text-[14px] bg-[#F5F7FA] outline-none focus:border-[var(--color-primary)] focus:bg-white transition-colors"
            />
          </div>
          <button type="submit" className="w-full min-h-[46px] border-0 rounded-sm text-[#111] bg-[#FDE047] font-semibold text-[15px] hover:bg-[#FACC15] transition-colors cursor-pointer">
            进入
          </button>
          {searchParams.error && (
            <p className="text-[#E84A5F] text-[13px] text-center mt-3 font-medium">Wrong password. Please try again.</p>
          )}
        </form>
      </div>
    </div>
  )
}
