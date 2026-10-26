import { Skeleton } from '../fx/Skeleton'

/** Same footprint as PortfolioCard: 16:10 cover, category row, title, two lines, chips, footer. */
export default function PortfolioCardSkeleton() {
  return (
    <div className="ngp-card pf-card" aria-hidden="true">
      <Skeleton className="!rounded-none" style={{ aspectRatio: '16 / 10' }} />
      <div className="pf-card__body">
        <Skeleton className="h-[12px] w-24" />
        <Skeleton className="h-[19px] w-3/4" />
        <Skeleton className="h-[13px] w-full" />
        <Skeleton className="h-[13px] w-4/5" />
        <div className="flex gap-1.5">
          <Skeleton className="h-[24px] w-16" />
          <Skeleton className="h-[24px] w-14" />
          <Skeleton className="h-[24px] w-20" />
        </div>
        <div className="pf-card__foot">
          <Skeleton className="h-[12px] w-20" />
        </div>
      </div>
    </div>
  )
}
