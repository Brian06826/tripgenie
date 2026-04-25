export type UILocale = 'en' | 'zh-TW' | 'zh-CN'

export const UI_LOCALES: { code: UILocale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'zh-TW', label: '繁中' },
  { code: 'zh-CN', label: '简中' },
]

const STORAGE_KEY = 'lulgo_ui_lang'

/** Save UI language preference to localStorage */
export function saveUILocale(locale: UILocale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale)
  }
}

/** Load saved UI language preference from localStorage */
export function loadUILocale(): UILocale | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'zh-TW' || saved === 'zh-CN') return saved
  return null
}

/** Detect UI language from Accept-Language header value */
export function detectLocaleFromHeader(acceptLang: string): UILocale {
  // Check for simplified Chinese indicators
  if (/zh-cn|zh-hans/i.test(acceptLang)) return 'zh-CN'
  // Check for any Chinese (defaults to Traditional)
  if (/^zh\b/i.test(acceptLang) || /,\s*zh\b/i.test(acceptLang)) return 'zh-TW'
  return 'en'
}

/** Check if a locale is Chinese (Traditional or Simplified) */
export function isChinese(locale: UILocale): boolean {
  return locale === 'zh-TW' || locale === 'zh-CN'
}

// ─── Translation Dictionary ───

type TranslationKey = keyof typeof translations.en

const translations = {
  en: {
    // Homepage hero
    'hero.tagline': 'The laziest way to plan a trip.',
    'hero.step1': 'Describe',
    'hero.step2': 'AI Plans',
    'hero.step3': 'Edit & Go',
    'hero.trust': '🗺️ Interactive map · ⭐ Google-verified ratings · ✏️ Edit & share with friends',
    'hero.examples': 'Not sure where to go? Try these ✨',

    // Footer
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms',

    // ChatInput
    'chat.ariaLabel': 'Describe your trip',
    'chat.whoGoing': "Who's going?",
    'chat.tripStyle': 'Trip style',
    'chat.generating': '⏳ Generating...',
    'chat.cta': '✨ Plan My Trip',
    'chat.addPrefs': '+ Add preferences',
    'chat.tryAgain': 'Try Again',
    'chat.validation': "Please describe a trip! Include a destination and how long.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'",

    // Chips
    'chip.partner': 'With Partner',
    'chip.kids': 'With Kids',
    'chip.friends': 'With Friends',
    'chip.solo': 'Solo',
    'chip.foodie': 'Foodie',
    'chip.budget': 'Budget',
    'chip.relaxed': 'Relaxed',
    'chip.nightlife': 'Nightlife',

    // PlaceCard
    'place.verifying': 'Verifying...',
    'place.verified': 'Verified',
    'place.moveUp': 'Move {name} up',
    'place.moveDown': 'Move {name} down',
    'place.editPlaceholder': 'e.g. change to Japanese, make cheaper, remove...',
    'place.editConfirm': 'Go',
    'place.parking': 'Parking',
    'place.tip': 'Tip',
    'place.maps': 'Maps',
    'place.reviews': 'Reviews',
    'place.book': 'Book',
    'place.removing': 'Removing...',
    'place.updating': 'Updating...',

    // ExportButton
    'export.ariaLabel': 'Export trip',
    'export.button': 'Export',
    'export.copied': '✅ Copied!',
    'export.copyText': 'Copy as Text',
    'export.copyDesc': 'Full itinerary for WhatsApp / LINE',
    'export.downloadImage': 'Download Image',
    'export.imageDesc': 'Full itinerary image for offline',
    'export.mapsRoute': 'Google Maps Route',
    'export.mapsDesc': 'Open route in Maps',
    'export.calendar': 'Add to Calendar',
    'export.calendarDesc': 'Download .ics file',
    'export.selectDay': 'Select Day',
    'export.dayN': 'Day {n}',
    'export.selectDate': 'Select start date',
    'export.calendarDateHint': 'Calendar events will be scheduled from this date',
    'export.imageDateHint': 'Dates will appear on each day header in the image',
    'export.skip': 'Skip',
    'export.confirm': 'Confirm',

    // ShareButton
    'share.button': 'Share',
    'share.shared': '✅ Shared!',
    'share.title': 'Share Trip',
    'share.qr': 'Scan to view (WeChat friendly)',
    'share.linkCopied': '✅ Copied!',
    'share.copyFailed': '⚠️ Copy failed — try long-press the link above',
    'share.copyLink': '📋 Copy Link',
    'share.collabHint': '🤝 Anyone with this link can view AND edit this trip',
    'share.sharedCollab': '✅ Shared! Recipients can edit this trip together',
    'collab.receiverHint': '✏️ Share this link with friends — everyone can edit this trip together. Changes save automatically!',
    'collab.dismiss': 'Got it',

    // TripMap
    'map.hide': '📋 Hide Map',
    'map.show': '🗺️ Show Map',
    'map.all': 'All',

    // AlternativesPanel
    'alt.suggestions': 'Alternative Suggestions ({n})',
    'alt.title': 'Alternatives',
    'alt.swap': 'Swap',

    // TripItinerary
    'itin.dayN': 'Day {n}',
    'itin.adding': 'Adding...',
    'itin.custom': 'Custom',
    'itin.customPlaceholder': 'e.g. ramen shop, bookstore...',
    'itin.add': 'Add',
    'itin.addPlace': 'Add place',
    'itin.added': 'Added',
    'itin.addFailed': 'Failed to add',
    'itin.removed': 'Removed {name}',
    'itin.removeFailed': 'Remove failed',
    'itin.saveFailed': 'Save failed',
    'itin.attraction': 'Attraction',
    'itin.restaurant': 'Restaurant',
    'itin.cafe': 'Café',
    'itin.shopping': 'Shopping',
    'itin.park': 'Park',

    // TripEditBar
    'edit.hint': '💡 Add places, swap restaurants, add hotels, adjust times... just describe what you want!',
    'edit.undo': 'Undo',
    'edit.placeholder': "Modify your trip... e.g. 'change dinner to sushi'",
    'edit.cancel': 'Cancel',
    'edit.updating': 'Updating...',

    // HotelSuggestion
    'hotel.needHotel': 'Need a hotel for Day {n}?',
    'hotel.aiRecommend': 'AI Recommend',
    'hotel.finding': 'Finding...',
    'hotel.recommendFailed': 'Failed, please try again',
    'hotel.hotelPlaceholder': 'Enter your hotel name...',
    'hotel.addToTrip': 'Add to Trip',
    'hotel.addFailed': 'Failed to add, please try again',
    'hotel.bookingLink': 'Paste booking link (optional)',
    'hotel.nightlifeHint': '💡 Want to add nightlife? Use the edit box below!',

    // TripPage
    'trip.dayCount': '{n} day{s}',
    'trip.planSimilar': '✨ Plan a trip like this → {dest}',

    // UserMenu
    'user.signIn': 'Sign In',
    'user.signOut': 'Sign Out',
    'user.deleteAccount': 'Delete My Account',
    'user.deleteConfirm': 'This will permanently delete all your trips, purchase history, and account data. This action cannot be undone.',
    'user.deleteSuccess': 'Account deleted.',
    'user.deleteFailed': 'Deletion failed. Please try again.',
    'user.deleting': 'Deleting...',

    // Sign-in page
    'signin.title': 'Welcome to Lulgo',
    'signin.subtitle': 'Sign in to save your trips',
    'signin.google': 'Continue with Google',
    'signin.apple': 'Continue with Apple',
    'signin.terms': 'By signing in, you agree to our Terms and Privacy Policy.',
    'signin.error': 'Sign-in failed. Please try again.',

    // RecentTrips
    'recent.title': 'Your Recent Trips',
    'recent.clearAll': 'Clear All',
    'recent.stops': '{n} stops',

    // ExampleTripLink
    'example.stops': '{n} stops',

    // Paywall
    'paywall.title': "You've used all free trips this month",
    'paywall.subtitle': '{used}/{limit} trips used',
    'paywall.feature1': '3 extra trip generations',
    'paywall.feature2': 'Longer trips up to 14 days',
    'paywall.feature3': 'Credits never expire',
    'paywall.signInHint': 'Sign in to purchase',
    'paywall.buy': 'Buy Trip Pass — $2.99',
    'paywall.signInAndBuy': 'Sign In & Buy Trip Pass',
    'paywall.later': 'Maybe later',
    'paywall.nativeTitle': "You've reached this month's limit",
    'paywall.nativeSubtitle': 'You get {limit} free trip plans every month. Your limit resets at the start of next month.',
    'paywall.nativeOk': 'Got it',
    'paywall.resetNote': 'Free trips reset every month',
    'paywall.error': 'Something went wrong. Please try again.',
    'paywall.success': 'Trip Pass activated! You have 3 extra trips.',

    // My Trips
    'myTrips.title': 'My Trips',
    'myTrips.delete': 'Delete',
    'myTrips.deleteAll': 'Delete All',
    'myTrips.deleteConfirm': 'Delete this trip? This cannot be undone.',
    'myTrips.deleteAllConfirm': 'Delete ALL trips? This cannot be undone.',
    'myTrips.deleteFailed': 'Delete failed. Please try again.',

    // Offline + reminders (native)
    'offline.indicator': 'You are offline — showing saved trips',
    'offline.viewing': 'offline',
    'reminder.title': 'Set a trip reminder?',
    'reminder.description': "We'll remind you the day before your trip starts.",
    'reminder.dateLabel': 'Trip start date',
    'reminder.set': 'Set reminder',
    'reminder.dismiss': 'Not now',
    'reminder.scheduled': 'Reminder scheduled!',
    'reminder.permission': 'Notifications permission denied. Enable it in Settings.',
    'reminder.past': 'That date is too soon — pick a date at least 2 days away.',
    'reminder.invalid': 'Please pick a valid trip start date.',
    'reminder.error': 'Could not schedule reminder. Please try again.',

  },

  'zh-TW': {
    'hero.tagline': '懶人專屬旅行規劃。',
    'hero.step1': '描述行程',
    'hero.step2': 'AI 規劃',
    'hero.step3': '編輯出發',
    'hero.trust': '🗺️ 互動地圖 · ⭐ Google 驗證評分 · ✏️ 即時編輯分享',
    'hero.examples': '唔知去邊？試下呢啲 ✨',

    'footer.privacy': '隱私政策',
    'footer.terms': '服務條款',

    'chat.ariaLabel': '描述你的旅行計劃',
    'chat.whoGoing': '同邊個去？',
    'chat.tripStyle': '旅行風格',
    'chat.generating': '⏳ 生成中...',
    'chat.cta': '✨ 規劃行程',
    'chat.addPrefs': '+ 添加偏好',
    'chat.tryAgain': '重試',
    'chat.validation': "Please describe a trip! Include a destination and how long.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'",

    'chip.partner': '情侶',
    'chip.kids': '親子',
    'chip.friends': '朋友',
    'chip.solo': '一個人',
    'chip.foodie': '美食',
    'chip.budget': '平價',
    'chip.relaxed': '悠閒',
    'chip.nightlife': '夜生活',

    'place.verifying': '驗證中...',
    'place.verified': '已驗證',
    'place.moveUp': '上移 {name}',
    'place.moveDown': '下移 {name}',
    'place.editPlaceholder': '例如：換日式餐廳、平啲、刪除...',
    'place.editConfirm': '確認',
    'place.parking': '泊車',
    'place.tip': '貼士',
    'place.maps': '地圖',
    'place.reviews': '評價',
    'place.book': '訂房',
    'place.removing': '移除中...',
    'place.updating': '更新中...',

    'export.ariaLabel': '匯出行程',
    'export.button': '匯出',
    'export.copied': '✅ 已複製！',
    'export.copyText': '複製文字',
    'export.copyDesc': '詳細行程，貼去 WhatsApp / LINE',
    'export.downloadImage': '下載圖片',
    'export.imageDesc': '長圖，離線睇 / 社交分享',
    'export.mapsRoute': 'Google Maps 路線',
    'export.mapsDesc': '開 Google Maps 導航',
    'export.calendar': '加入日曆',
    'export.calendarDesc': '下載 .ics 檔案',
    'export.selectDay': '選擇日期',
    'export.dayN': '第{n}日',
    'export.selectDate': '選擇出發日期',
    'export.calendarDateHint': '日曆事件將會根據呢個日期排列',
    'export.imageDateHint': '圖片上會顯示每日對應嘅日期',
    'export.skip': '跳過',
    'export.confirm': '確認',

    'share.button': '分享',
    'share.shared': '✅ 已分享！',
    'share.title': '分享行程',
    'share.qr': '掃碼查看（微信適用）',
    'share.linkCopied': '✅ 已複製！',
    'share.copyFailed': '⚠️ 複製失敗',
    'share.copyLink': '📋 複製連結',
    'share.collabHint': '🤝 收到連結嘅人可以一齊睇同編輯呢個行程',
    'share.sharedCollab': '✅ 已分享！對方可以一齊編輯行程',
    'collab.receiverHint': '✏️ 將連結分享畀朋友，大家可以一齊編輯行程，修改自動儲存！',
    'collab.dismiss': '知道了',

    'map.hide': '📋 隱藏地圖',
    'map.show': '🗺️ 顯示地圖',
    'map.all': '全部',

    'alt.suggestions': '替代建議 ({n})',
    'alt.title': '替代選項',
    'alt.swap': '替換',

    'itin.dayN': '第{n}日',
    'itin.adding': '新增中...',
    'itin.custom': '自訂',
    'itin.customPlaceholder': '例如：拉麵店、書店...',
    'itin.add': '加',
    'itin.addPlace': '新增景點',
    'itin.added': '已新增',
    'itin.addFailed': '新增失敗',
    'itin.removed': '已移除 {name}',
    'itin.removeFailed': '移除失敗',
    'itin.saveFailed': '儲存失敗',
    'itin.attraction': '景點',
    'itin.restaurant': '餐廳',
    'itin.cafe': '咖啡店',
    'itin.shopping': '購物',
    'itin.park': '公園',

    'edit.hint': '💡 你可以加景點、換餐廳、加酒店、調整時間... 用自然語言描述就得！',
    'edit.undo': '復原',
    'edit.placeholder': "修改行程... 例如 '晚餐改成日本料理'",
    'edit.cancel': '取消',
    'edit.updating': '更新中...',

    'hotel.needHotel': '第{n}日需要酒店？',
    'hotel.aiRecommend': 'AI 推薦',
    'hotel.finding': '推薦中...',
    'hotel.recommendFailed': '推薦失敗，請重試',
    'hotel.hotelPlaceholder': '輸入酒店名稱...',
    'hotel.addToTrip': '加入行程',
    'hotel.addFailed': '加入失敗，請重試',
    'hotel.bookingLink': '貼上訂房連結（選填）',
    'hotel.nightlifeHint': '💡 想加夜間活動？用下面嘅編輯框告訴 AI！',

    'trip.dayCount': '{n}日',
    'trip.planSimilar': '✨ 規劃類似行程 → {dest}',

    'user.signIn': '登入',
    'user.signOut': '登出',
    'user.deleteAccount': '刪除我的帳戶',
    'user.deleteConfirm': '所有行程、購買記錄同帳戶資料都會永久刪除，無法復原。',
    'user.deleteSuccess': '帳戶已刪除。',
    'user.deleteFailed': '刪除失敗，請再試。',
    'user.deleting': '刪除中...',

    // Sign-in page
    'signin.title': '歡迎使用 Lulgo',
    'signin.subtitle': '登入以儲存您的行程',
    'signin.google': '使用 Google 繼續',
    'signin.apple': '使用 Apple 繼續',
    'signin.terms': '登入即表示您同意我們的服務條款和私隱政策。',
    'signin.error': '登入失敗，請再試一次。',

    'recent.title': '你最近嘅行程',
    'recent.clearAll': '清除全部',
    'recent.stops': '{n} 個景點',

    'example.stops': '{n} 個景點',

    // Paywall
    'paywall.title': '今個月免費次數已用完',
    'paywall.subtitle': '已用 {used}/{limit} 次',
    'paywall.feature1': '額外 3 次行程生成',
    'paywall.feature2': '支援長達 14 日行程',
    'paywall.feature3': '額度永不過期',
    'paywall.signInHint': '需要登入先可以購買',
    'paywall.buy': '購買 Trip Pass — $2.99',
    'paywall.signInAndBuy': '登入 & 購買 Trip Pass',
    'paywall.later': '下次再算',
    'paywall.nativeTitle': '今個月次數已用完',
    'paywall.nativeSubtitle': '每月免費規劃 {limit} 個行程，下個月自動重置。',
    'paywall.nativeOk': '知道了',
    'paywall.resetNote': '免費次數每月重置',
    'paywall.error': '出咗問題，請再試。',
    'paywall.success': 'Trip Pass 已啟用！你有 3 次額外行程。',

    // My Trips
    'myTrips.title': '我嘅行程',
    'myTrips.delete': '刪除',
    'myTrips.deleteAll': '刪除全部',
    'myTrips.deleteConfirm': '確定要刪除呢個行程？刪咗就冇得返。',
    'myTrips.deleteAllConfirm': '確定要刪除全部行程？刪咗就冇得返。',
    'myTrips.deleteFailed': '刪除失敗，請再試。',

    // Offline + reminders (native)
    'offline.indicator': '冇網絡 — 顯示已儲存嘅行程',
    'offline.viewing': '離線',
    'reminder.title': '設定旅行提醒？',
    'reminder.description': '我哋會喺出發前一日提醒你。',
    'reminder.dateLabel': '出發日期',
    'reminder.set': '設定提醒',
    'reminder.dismiss': '下次再算',
    'reminder.scheduled': '提醒已設定！',
    'reminder.permission': '通知權限被拒。請喺設定開啟。',
    'reminder.past': '日期太近喇 — 請揀至少 2 日後。',
    'reminder.invalid': '請揀返一個有效嘅出發日期。',
    'reminder.error': '設定失敗，請再試。',

  },

  'zh-CN': {
    'hero.tagline': '懒人专属旅行规划。',
    'hero.step1': '描述行程',
    'hero.step2': 'AI 规划',
    'hero.step3': '编辑出发',
    'hero.trust': '🗺️ 互动地图 · ⭐ Google 验证评分 · ✏️ 即时编辑分享',
    'hero.examples': '不知道去哪？试试这些 ✨',

    'footer.privacy': '隐私政策',
    'footer.terms': '服务条款',

    'chat.ariaLabel': '描述你的旅行计划',
    'chat.whoGoing': '和谁一起？',
    'chat.tripStyle': '旅行风格',
    'chat.generating': '⏳ 生成中...',
    'chat.cta': '✨ 规划行程',
    'chat.addPrefs': '+ 添加偏好',
    'chat.tryAgain': '重试',
    'chat.validation': "Please describe a trip! Include a destination and how long.\nFor example: '3 days Tokyo food trip' or '一日遊 Long Beach 情侶'",

    'chip.partner': '情侣',
    'chip.kids': '亲子',
    'chip.friends': '朋友',
    'chip.solo': '一个人',
    'chip.foodie': '美食',
    'chip.budget': '平价',
    'chip.relaxed': '悠闲',
    'chip.nightlife': '夜生活',

    'place.verifying': '验证中...',
    'place.verified': '已验证',
    'place.moveUp': '上移 {name}',
    'place.moveDown': '下移 {name}',
    'place.editPlaceholder': '例如：换日式餐厅、便宜点、删除...',
    'place.editConfirm': '确认',
    'place.parking': '停车',
    'place.tip': '小贴士',
    'place.maps': '地图',
    'place.reviews': '评价',
    'place.book': '订房',
    'place.removing': '移除中...',
    'place.updating': '更新中...',

    'export.ariaLabel': '导出行程',
    'export.button': '导出',
    'export.copied': '✅ 已复制！',
    'export.copyText': '复制文字',
    'export.copyDesc': '详细行程，贴去 WhatsApp / LINE',
    'export.downloadImage': '下载图片',
    'export.imageDesc': '长图，离线看 / 社交分享',
    'export.mapsRoute': 'Google Maps 路线',
    'export.mapsDesc': '打开 Google Maps 导航',
    'export.calendar': '加入日历',
    'export.calendarDesc': '下载 .ics 文件',
    'export.selectDay': '选择日期',
    'export.dayN': '第{n}日',
    'export.selectDate': '选择出发日期',
    'export.calendarDateHint': '日历事件将根据这个日期排列',
    'export.imageDateHint': '图片上会显示每日对应的日期',
    'export.skip': '跳过',
    'export.confirm': '确认',

    'share.button': '分享',
    'share.shared': '✅ 已分享！',
    'share.title': '分享行程',
    'share.qr': '扫码查看（微信适用）',
    'share.linkCopied': '✅ 已复制！',
    'share.copyFailed': '⚠️ 复制失败',
    'share.copyLink': '📋 复制链接',
    'share.collabHint': '🤝 收到链接的人可以一起查看和编辑这个行程',
    'share.sharedCollab': '✅ 已分享！对方可以一起编辑行程',
    'collab.receiverHint': '✏️ 把链接分享给朋友，大家可以一起编辑行程，修改自动保存！',
    'collab.dismiss': '知道了',

    'map.hide': '📋 隐藏地图',
    'map.show': '🗺️ 显示地图',
    'map.all': '全部',

    'alt.suggestions': '替代建议 ({n})',
    'alt.title': '替代选项',
    'alt.swap': '替换',

    'itin.dayN': '第{n}日',
    'itin.adding': '添加中...',
    'itin.custom': '自定义',
    'itin.customPlaceholder': '例如：拉面店、书店...',
    'itin.add': '加',
    'itin.addPlace': '添加景点',
    'itin.added': '已添加',
    'itin.addFailed': '添加失败',
    'itin.removed': '已移除 {name}',
    'itin.removeFailed': '移除失败',
    'itin.saveFailed': '保存失败',
    'itin.attraction': '景点',
    'itin.restaurant': '餐厅',
    'itin.cafe': '咖啡店',
    'itin.shopping': '购物',
    'itin.park': '公园',

    'edit.hint': '💡 你可以加景点、换餐厅、加酒店、调整时间... 用自然语言描述就行！',
    'edit.undo': '撤销',
    'edit.placeholder': "修改行程... 例如 '晚餐改成日本料理'",
    'edit.cancel': '取消',
    'edit.updating': '更新中...',

    'hotel.needHotel': '第{n}日需要酒店？',
    'hotel.aiRecommend': 'AI 推荐',
    'hotel.finding': '推荐中...',
    'hotel.recommendFailed': '推荐失败，请重试',
    'hotel.hotelPlaceholder': '输入酒店名称...',
    'hotel.addToTrip': '加入行程',
    'hotel.addFailed': '加入失败，请重试',
    'hotel.bookingLink': '粘贴订房链接（选填）',
    'hotel.nightlifeHint': '💡 想加夜间活动？用下面的编辑框告诉 AI！',

    'trip.dayCount': '{n}日',
    'trip.planSimilar': '✨ 规划类似行程 → {dest}',

    'user.signIn': '登录',
    'user.signOut': '退出',
    'user.deleteAccount': '删除我的账户',
    'user.deleteConfirm': '所有行程、购买记录和账户数据都会永久删除，无法恢复。',
    'user.deleteSuccess': '账户已删除。',
    'user.deleteFailed': '删除失败，请重试。',
    'user.deleting': '删除中...',

    // Sign-in page
    'signin.title': '欢迎使用 Lulgo',
    'signin.subtitle': '登录以保存您的行程',
    'signin.google': '使用 Google 继续',
    'signin.apple': '使用 Apple 继续',
    'signin.terms': '登录即表示您同意我们的服务条款和隐私政策。',
    'signin.error': '登录失败，请再试一次。',

    'recent.title': '你最近的行程',
    'recent.clearAll': '清除全部',
    'recent.stops': '{n} 个景点',

    'example.stops': '{n} 个景点',

    // Paywall
    'paywall.title': '本月免费次数已用完',
    'paywall.subtitle': '已用 {used}/{limit} 次',
    'paywall.feature1': '额外 3 次行程生成',
    'paywall.feature2': '支持长达 14 天行程',
    'paywall.feature3': '额度永不过期',
    'paywall.signInHint': '需要登录才能购买',
    'paywall.buy': '购买 Trip Pass — $2.99',
    'paywall.signInAndBuy': '登录 & 购买 Trip Pass',
    'paywall.later': '下次再说',
    'paywall.nativeTitle': '本月次数已用完',
    'paywall.nativeSubtitle': '每月免费规划 {limit} 个行程，下个月自动重置。',
    'paywall.nativeOk': '知道了',
    'paywall.resetNote': '免费次数每月重置',
    'paywall.error': '出了问题，请再试。',
    'paywall.success': 'Trip Pass 已激活！你有 3 次额外行程。',

    // My Trips
    'myTrips.title': '我的行程',
    'myTrips.delete': '删除',
    'myTrips.deleteAll': '删除全部',
    'myTrips.deleteConfirm': '确定要删除这个行程？删除后无法恢复。',
    'myTrips.deleteAllConfirm': '确定要删除全部行程？删除后无法恢复。',
    'myTrips.deleteFailed': '删除失败，请重试。',

    // Offline + reminders (native)
    'offline.indicator': '无网络 — 显示已保存的行程',
    'offline.viewing': '离线',
    'reminder.title': '设定旅行提醒？',
    'reminder.description': '我们会在出发前一天提醒你。',
    'reminder.dateLabel': '出发日期',
    'reminder.set': '设定提醒',
    'reminder.dismiss': '下次再说',
    'reminder.scheduled': '提醒已设定！',
    'reminder.permission': '通知权限被拒。请在设置中开启。',
    'reminder.past': '日期太近 — 请选至少 2 天后。',
    'reminder.invalid': '请选择有效的出发日期。',
    'reminder.error': '设定失败，请重试。',

  },
} as const

/** Get a translated string with optional interpolation */
export function t(locale: UILocale, key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = translations[locale] ?? translations.en
  let text = (dict as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return text
}
