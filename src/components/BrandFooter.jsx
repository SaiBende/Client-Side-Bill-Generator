const GITHUB = 'https://github.com/saibende'
const PORTFOLIO = 'https://saibende.vercel.app'

export default function BrandFooter({ compact = false }) {
  if (compact) {
    return (
      <p className="text-center text-[11px] text-gray-400 mt-4">
        Made by{' '}
        <a href={PORTFOLIO} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-blue-600">
          Sai Bende
        </a>
      </p>
    )
  }
  return (
    <footer className="border-t border-gray-200 mt-8 py-4">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3 text-xs text-gray-500">
        <span className="font-medium text-gray-600">ShareMyBill</span>
        <span className="text-gray-300 hidden sm:inline">·</span>
        <span>
          Made by{' '}
          <a href={PORTFOLIO} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 font-medium">
            Sai Bende
          </a>
        </span>
        <span className="text-gray-300 hidden sm:inline">·</span>
        <a href={GITHUB} target="_blank" rel="noreferrer"
          className="text-gray-500 hover:text-gray-800 transition-colors">
          GitHub
        </a>
        <span className="text-gray-300 hidden sm:inline">·</span>
        <a href={PORTFOLIO} target="_blank" rel="noreferrer"
          className="text-gray-500 hover:text-gray-800 transition-colors">
          Portfolio
        </a>
      </div>
    </footer>
  )
}