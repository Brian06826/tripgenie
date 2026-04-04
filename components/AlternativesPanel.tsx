import type { BackupOption } from '@/lib/types'

type Props = {
  backups: BackupOption[]
  onSwap: (backupIndex: number) => void
  language?: string
}

function BackupList({ backups, onSwap, cn }: { backups: BackupOption[]; onSwap: (i: number) => void; cn: boolean }) {
  return (
    <div className="space-y-2">
      {backups.map((backup, i) => (
        <div key={i} className="bg-white border border-gray-100 rounded-lg p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-xs text-gray-800 leading-tight">{backup.name}</div>
              {backup.nameLocal && (
                <div className="text-xs text-gray-500">{backup.nameLocal}</div>
              )}
            </div>
            <button
              onClick={() => onSwap(i)}
              aria-label={`Swap with ${backup.name}`}
              className="shrink-0 text-xs font-semibold bg-orange text-white px-3 py-2 min-h-[44px] rounded-md hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-1"
            >
              {cn ? '替換' : 'Swap'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
            {backup.description}
          </p>
          {(backup.googleRating || backup.yelpRating) && (
            <div className="flex gap-3 mt-1.5">
              {backup.googleRating && (
                <span className="text-xs text-blue-600">
                  G {backup.googleRating.toFixed(1)}
                </span>
              )}
              {backup.yelpRating && (
                <span className="text-xs text-red-500">
                  Y {backup.yelpRating.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function AlternativesPanel({ backups, onSwap, language }: Props) {
  const cn = language === 'zh-TW' || language === 'zh-HK' || language === 'zh-CN'
  return (
    <>
      {/* Mobile: collapsible below the place card */}
      <details className="lg:hidden -mt-1 mb-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium px-1 py-1.5 select-none">
          🔄 {cn ? `替代建議 (${backups.length})` : `Alternative Suggestions (${backups.length})`}
        </summary>
        <div className="mt-2 px-1">
          <BackupList backups={backups} onSwap={onSwap} cn={cn} />
        </div>
      </details>

      {/* Desktop: sidebar panel */}
      <div className="hidden lg:flex lg:flex-col lg:justify-start">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
            {cn ? '替代選項' : 'Alternatives'}
          </p>
          <BackupList backups={backups} onSwap={onSwap} cn={cn} />
        </div>
      </div>
    </>
  )
}
