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
    'hero.trust': '⚡ AI-powered planning · 📍 Google Maps ratings · ✈️ Free to try',
    'hero.examples': 'Not sure where to go? Try these ✨',

    // Footer
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms',

    // ChatInput
    'chat.ariaLabel': 'Describe your trip',
    'chat.whoGoing': "Who's going?",
    'chat.tripStyle': 'Trip style',
    'chat.generating': '⏳ Generating...',
    'chat.cta': '✨ Plan My Trip — Free',
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

    // RecentTrips
    'recent.title': 'Your Recent Trips',
    'recent.clearAll': 'Clear All',
    'recent.stops': '{n} stops',

    // ExampleTripLink
    'example.stops': '{n} stops',
  },

  'zh-TW': {
    'hero.tagline': '懶人專屬旅行規劃。',
    'hero.step1': '描述行程',
    'hero.step2': 'AI 規劃',
    'hero.step3': '編輯出發',
    'hero.trust': '⚡ AI 即時規劃 · 📍 Google Maps 評分 · ✈️ 免費試用',
    'hero.examples': '唔知去邊？試下呢啲 ✨',

    'footer.privacy': '隱私政策',
    'footer.terms': '服務條款',

    'chat.ariaLabel': '描述你的旅行計劃',
    'chat.whoGoing': '同邊個去？',
    'chat.tripStyle': '旅行風格',
    'chat.generating': '⏳ 生成中...',
    'chat.cta': '✨ 免費規劃行程',
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

    'recent.title': '你最近嘅行程',
    'recent.clearAll': '清除全部',
    'recent.stops': '{n} 個景點',

    'example.stops': '{n} 個景點',
  },

  'zh-CN': {
    'hero.tagline': '懒人专属旅行规划。',
    'hero.step1': '描述行程',
    'hero.step2': 'AI 规划',
    'hero.step3': '编辑出发',
    'hero.trust': '⚡ AI 即时规划 · 📍 Google Maps 评分 · ✈️ 免费试用',
    'hero.examples': '不知道去哪？试试这些 ✨',

    'footer.privacy': '隐私政策',
    'footer.terms': '服务条款',

    'chat.ariaLabel': '描述你的旅行计划',
    'chat.whoGoing': '和谁一起？',
    'chat.tripStyle': '旅行风格',
    'chat.generating': '⏳ 生成中...',
    'chat.cta': '✨ 免费规划行程',
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

    'recent.title': '你最近的行程',
    'recent.clearAll': '清除全部',
    'recent.stops': '{n} 个景点',

    'example.stops': '{n} 个景点',
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
