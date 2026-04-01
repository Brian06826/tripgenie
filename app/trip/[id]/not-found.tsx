export default function TripNotFound() {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <header
        className="text-white px-4 pt-10 pb-8 text-center"
        style={{ background: 'linear-gradient(180deg, var(--color-navy) 0%, var(--color-navy-mid) 100%)' }}
      >
        <div className="max-w-xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Lul<span className="text-orange">go</span> ✨
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center -mt-8">
        <p className="text-5xl mb-4">🧳</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Trip not found
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">
          This trip may have expired or the link is incorrect. Trips are available for 90 days after creation.
        </p>
        <a
          href="/"
          className="bg-orange text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
          Create a New Trip
        </a>
      </div>
    </div>
  )
}
