import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — TripGenie',
  description: 'TripGenie privacy policy / 隱私政策',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gray-900">
            Trip<span className="text-orange">Genie</span> ✨
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">Last updated: March 31, 2026 / 最後更新：2026年3月31日</p>

        <div className="space-y-8 text-gray-700 text-sm leading-relaxed">

          {/* Section 1 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. Information We Collect / 我們收集嘅資料</h2>
            <p className="mb-2">
              When you sign in with Google, we receive your <strong>name</strong>, <strong>email address</strong>, and <strong>profile picture</strong> from your Google account. We also store the trip itineraries you generate.
            </p>
            <p className="text-gray-500">
              當你使用 Google 登入時，我們會收到你嘅<strong>姓名</strong>、<strong>電郵地址</strong>同<strong>頭像</strong>。我們亦會儲存你生成嘅旅行行程。
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. How We Use Your Data / 我們點樣使用你嘅資料</h2>
            <p className="mb-2">
              Your data is used solely to provide the TripGenie service: generating, saving, and displaying your trip itineraries. We associate trips with your account so you can access them later.
            </p>
            <p className="text-gray-500">
              你嘅資料只會用嚟提供 TripGenie 服務：生成、儲存同顯示你嘅旅行行程。我們會將行程同你嘅帳戶關聯，方便你之後查閱。
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. What We Don&apos;t Do / 我們唔會做嘅事</h2>
            <ul className="list-disc list-inside space-y-1 mb-2">
              <li>We do <strong>not</strong> sell your personal data</li>
              <li>We do <strong>not</strong> share your data with third parties for marketing</li>
              <li>We do <strong>not</strong> use your data for advertising</li>
            </ul>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>我們<strong>唔會</strong>出售你嘅個人資料</li>
              <li>我們<strong>唔會</strong>同第三方分享你嘅資料作營銷用途</li>
              <li>我們<strong>唔會</strong>用你嘅資料嚟賣廣告</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. Third-Party Services / 第三方服務</h2>
            <p className="mb-2">
              TripGenie uses the following third-party services to operate:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-2">
              <li><strong>Google OAuth</strong> — for authentication</li>
              <li><strong>Google Places API</strong> — to verify and geocode places</li>
              <li><strong>Anthropic Claude API</strong> — to generate trip itineraries</li>
              <li><strong>Unsplash</strong> — for hero images</li>
            </ul>
            <p className="text-gray-500">
              TripGenie 使用以下第三方服務運作：Google OAuth（認證）、Google Places API（驗證地點）、Anthropic Claude API（生成行程）、Unsplash（封面圖片）。
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. Cookies / Cookie 使用</h2>
            <p className="mb-2">
              We use <strong>session cookies only</strong> to keep you signed in. We do not use tracking cookies, analytics cookies, or advertising cookies.
            </p>
            <p className="text-gray-500">
              我們只使用<strong>會話 Cookie</strong> 嚟保持你嘅登入狀態。我們唔會使用追蹤、分析或廣告 Cookie。
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">6. Data Storage & Retention / 資料儲存</h2>
            <p className="mb-2">
              Trip data is stored for up to <strong>90 days</strong> and may be deleted after that period. You can use TripGenie without signing in; anonymous trips are not linked to any account.
            </p>
            <p className="text-gray-500">
              行程資料最多儲存 <strong>90 日</strong>，之後可能會被刪除。你可以喺唔登入嘅情況下使用 TripGenie，匿名行程唔會連結到任何帳戶。
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">7. Contact / 聯絡我們</h2>
            <p className="mb-2">
              If you have any questions about this privacy policy, please contact us at:{' '}
              <a href="mailto:brian777asd@gmail.com" className="text-orange hover:underline">brian777asd@gmail.com</a>
            </p>
            <p className="text-gray-500">
              如果你對此隱私政策有任何疑問，請聯絡：{' '}
              <a href="mailto:brian777asd@gmail.com" className="text-orange hover:underline">brian777asd@gmail.com</a>
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
