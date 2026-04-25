'use client'
import { useEffect, useState, useMemo } from 'react'
import type { LoadingVibe } from './ChatInput'
import { EmojiQuiz } from './EmojiQuiz'

type Lang = 'en' | 'zh-TW' | 'zh-CN'

const MSGS: Record<string, { en: string[]; 'zh-TW': string[]; 'zh-CN': string[] }> = {
  default: {
    en: [
      'Packing your bags... 🧳',
      'Booking the best restaurants... 🍜',
      'Finding hidden gems... 💎',
      'Checking the weather forecast... ☀️',
      'Negotiating with locals... 🗣️',
      'Planning the perfect route... 🗺️',
      'Asking locals for secret spots... 🤫',
      'Comparing all the reviews... ⭐',
      'Scanning for must-try dishes... 🥢',
      'Reserving the best views... 🏔️',
      'Verifying restaurants on Google... ✅',
      'Optimizing your route... 📍',
    ],
    'zh-TW': [
      '整理行李中... 🧳',
      '預訂最好的餐廳... 🍜',
      '發掘隱藏寶藏... 💎',
      '查看天氣預報... ☀️',
      '和當地人溝通中... 🗣️',
      '規劃完美路線... 🗺️',
      '詢問當地人秘密景點... 🤫',
      '比較各大評分... ⭐',
      '搜尋必試美食... 🥢',
      '預留最美的景色... 🏔️',
      '在 Google 驗證餐廳中... ✅',
      '優化你的路線... 📍',
    ],
    'zh-CN': [
      '收拾行李中... 🧳',
      '预订最好的餐厅... 🍜',
      '发现隐藏宝藏... 💎',
      '查看天气预报... ☀️',
      '和当地人沟通中... 🗣️',
      '规划完美路线... 🗺️',
      '打听当地秘密景点... 🤫',
      '比较各大评分... ⭐',
      '搜索必试美食... 🥢',
      '预留最美的景色... 🏔️',
      '在 Google 验证餐厅中... ✅',
      '优化你的路线... 📍',
    ],
  },
  couple: {
    en: [
      'Finding the most romantic spots... 💑',
      'Reserving the best sunset views... 🌅',
      'Scouting cozy date-night restaurants... 🕯️',
      'Planning the perfect scenic walk... 🌸',
      'Finding hidden rooftop bars... 🍷',
      'Checking the best photo spots... 📸',
    ],
    'zh-TW': [
      '尋找最浪漫的地方... 💑',
      '預留最美的日落景色... 🌅',
      '尋找氣氛好的約會餐廳... 🕯️',
      '規劃完美散步路線... 🌸',
      '尋找隱藏的天台酒吧... 🍷',
      '尋找最佳打卡點... 📸',
    ],
    'zh-CN': [
      '找最浪漫的地方... 💑',
      '预留最美的日落景色... 🌅',
      '找氛围好的约会餐厅... 🕯️',
      '规划完美散步路线... 🌸',
      '找隐藏的天台酒吧... 🍷',
      '找最佳打卡点... 📸',
    ],
  },
  family: {
    en: [
      'Finding kid-friendly activities... 👨‍👩‍👧',
      'Making sure there\'s something for everyone... 🎠',
      'Checking playground ratings... 🛝',
      'Finding family-friendly restaurants... 🍕',
      'Planning rest stops between activities... 😴',
      'Scouting the best ice cream shops... 🍦',
    ],
    'zh-TW': [
      '尋找適合小朋友的活動... 👨‍👩‍👧',
      '確保大人小孩都開心... 🎠',
      '尋找親子餐廳... 🍕',
      '計劃活動之間的休息時間... 😴',
      '尋找最好的冰淇淋店... 🍦',
      '尋找公園和遊樂場... 🛝',
    ],
    'zh-CN': [
      '找适合小朋友的活动... 👨‍👩‍👧',
      '确保大人小孩都开心... 🎠',
      '找亲子餐厅... 🍕',
      '计划活动之间的休息时间... 😴',
      '找最好的冰淇淋店... 🍦',
      '找公园和游乐场... 🛝',
    ],
  },
  food: {
    en: [
      'Hunting down the best local eats... 🍜',
      'Reading thousands of reviews... ⭐',
      'Finding the hidden foodie gems... 🥢',
      'Checking which spots have lines out the door... 🚪',
      'Scouting the best street food... 🌮',
      'Comparing Michelin and hole-in-the-wall picks... 🏆',
    ],
    'zh-TW': [
      '尋找最道地的美食... 🍜',
      '看了上千則評論... ⭐',
      '發掘隱藏美食... 🥢',
      '尋找排隊名店... 🚪',
      '尋找最好的街頭小吃... 🌮',
      '比較米其林和巷弄小店... 🏆',
    ],
    'zh-CN': [
      '找最正宗的地道美食... 🍜',
      '看了上千条评论... ⭐',
      '发现隐藏美食... 🥢',
      '找排队名店... 🚪',
      '找最好的街头小吃... 🌮',
      '比较米其林和苍蝇馆子... 🏆',
    ],
  },
  budget: {
    en: [
      'Finding the best free attractions... 💰',
      'Maximizing fun, minimizing cost... 🎯',
      'Scouting the cheapest eats with the best reviews... 🌟',
      'Finding happy hour deals... 🍻',
      'Checking for free museum days... 🎨',
      'Planning the most efficient route to save on transport... 🚶',
    ],
    'zh-TW': [
      '尋找最划算的免費景點... 💰',
      '花最少的錢玩最多... 🎯',
      '尋找便宜又好評的餐廳... 🌟',
      '尋找 happy hour 優惠... 🍻',
      '尋找免費博物館日... 🎨',
      '規劃最省錢的路線... 🚶',
    ],
    'zh-CN': [
      '找最划算的免费景点... 💰',
      '花最少的钱玩最多... 🎯',
      '找便宜又好评的餐厅... 🌟',
      '找 happy hour 优惠... 🍻',
      '找免费博物馆日... 🎨',
      '规划最省钱的路线... 🚶',
    ],
  },
}

// Destination-aware progress steps — ${D} is replaced with destination name
function getPhaseSteps(dest: string, lang: Lang): { msg: string; maxSec: number }[] {
  const d = dest
  if (lang === 'zh-TW') return [
    { msg: `🔍 研究${d}的必去景點...`, maxSec: 8 },
    { msg: `🍜 尋找${d}最好的餐廳...`, maxSec: 20 },
    { msg: `📍 規劃完美路線...`, maxSec: 35 },
    { msg: `⭐ 查看 Google 評分和評論...`, maxSec: 50 },
    { msg: `💡 加入當地人才知道的小貼士...`, maxSec: 70 },
    { msg: `💰 優化你的預算...`, maxSec: 90 },
    { msg: `🎁 最後整理行程中...`, maxSec: Infinity },
  ]
  if (lang === 'zh-CN') return [
    { msg: `🔍 研究${d}的必去景点...`, maxSec: 8 },
    { msg: `🍜 找${d}最好的餐厅...`, maxSec: 20 },
    { msg: `📍 规划完美路线...`, maxSec: 35 },
    { msg: `⭐ 查看 Google 评分和评论...`, maxSec: 50 },
    { msg: `💡 加入当地人才知道的小贴士...`, maxSec: 70 },
    { msg: `💰 优化你的预算...`, maxSec: 90 },
    { msg: `🎁 最后整理行程中...`, maxSec: Infinity },
  ]
  return [
    { msg: `🔍 Researching ${d}'s best spots...`, maxSec: 8 },
    { msg: `🍜 Finding top-rated restaurants in ${d}...`, maxSec: 20 },
    { msg: `📍 Mapping out the perfect route...`, maxSec: 35 },
    { msg: `⭐ Checking Google ratings & reviews...`, maxSec: 50 },
    { msg: `💡 Adding local insider tips...`, maxSec: 70 },
    { msg: `💰 Optimizing for your budget...`, maxSec: 90 },
    { msg: `🎁 Finalizing your itinerary...`, maxSec: Infinity },
  ]
}

// ---- Destination fun facts ----

type FactSet = { en: string[]; 'zh-TW': string[]; 'zh-CN': string[] }

const DESTINATION_FACTS: Record<string, FactSet> = {
  tokyo: {
    en: [
      'Tokyo has more Michelin-starred restaurants than any other city in the world.',
      'Tokyo\'s Shinjuku Station is the busiest train station on Earth, serving 3.5 million passengers daily.',
      'There are over 160,000 restaurants in Tokyo — more than New York, Paris, and London combined.',
      'Tokyo\'s vending machines outnumber its residents\' thirst — there\'s 1 for every 23 people.',
      'The Tokyo Skytree is the tallest tower in the world at 634 meters.',
      'Tokyo was originally called Edo, and was renamed in 1868.',
    ],
    'zh-TW': [
      '東京的米其林星級餐廳數量是全世界最多的城市。',
      '新宿站是全球最繁忙的車站，每天服務 350 萬名乘客。',
      '東京有超過 16 萬間餐廳，比紐約、巴黎和倫敦加起來還多。',
      '東京的自動販賣機密度驚人，每 23 人就有一台。',
      '東京晴空塔是世界最高的電波塔，高 634 米。',
      '東京原名「江戶」，1868 年才改名為東京。',
    ],
    'zh-CN': [
      '东京的米其林星级餐厅数量是全世界最多的城市。',
      '新宿站是全球最繁忙的车站，每天服务 350 万名乘客。',
      '东京有超过 16 万间餐厅，比纽约、巴黎和伦敦加起来还多。',
      '东京的自动贩卖机密度惊人，每 23 人就有一台。',
      '东京晴空塔是世界最高的电波塔，高 634 米。',
      '东京原名「江户」，1868 年才改名为东京。',
    ],
  },
  osaka: {
    en: [
      'Osaka is known as Japan\'s "Kitchen" — the food capital of the country.',
      'Osaka Castle was originally built in 1583 and has been rebuilt twice.',
      'Dotonbori\'s famous Glico Running Man sign has been a landmark since 1935.',
      'Osaka invented instant ramen — Cup Noodles were born here in 1971.',
      'Osaka people stand on the right side of escalators, opposite to Tokyo.',
    ],
    'zh-TW': [
      '大阪被稱為日本的「天下廚房」，是日本的美食之都。',
      '大阪城最初建於 1583 年，已經重建了兩次。',
      '道頓堀的固力果跑步人招牌自 1935 年起就是地標。',
      '大阪發明了即食拉麵 — 杯麵於 1971 年在這裡誕生。',
      '大阪人搭電扶梯站右邊，跟東京相反。',
    ],
    'zh-CN': [
      '大阪被称为日本的「天下厨房」，是日本的美食之都。',
      '大阪城最初建于 1583 年，已经重建了两次。',
      '道顿堀的固力果跑步人招牌自 1935 年起就是地标。',
      '大阪发明了即食拉面 — 杯面于 1971 年在这里诞生。',
      '大阪人搭电扶梯站右边，跟东京相反。',
    ],
  },
  kyoto: {
    en: [
      'Kyoto has over 2,000 temples and shrines — more than any other city in Japan.',
      'Kyoto was Japan\'s capital for over 1,000 years, from 794 to 1868.',
      'The famous Fushimi Inari shrine has over 10,000 torii gates.',
      'Kyoto\'s geisha district, Gion, has been active since the 1600s.',
      'Nintendo was founded in Kyoto in 1889 — originally as a playing card company.',
    ],
    'zh-TW': [
      '京都有超過 2,000 座寺廟和神社，是日本最多的城市。',
      '京都曾是日本首都超過 1,000 年，從 794 年到 1868 年。',
      '伏見稻荷大社有超過一萬座鳥居。',
      '京都的祇園花街自 1600 年代起就有藝妓活動。',
      '任天堂於 1889 年在京都創立，最初是一家撲克牌公司。',
    ],
    'zh-CN': [
      '京都有超过 2,000 座寺庙和神社，是日本最多的城市。',
      '京都曾是日本首都超过 1,000 年，从 794 年到 1868 年。',
      '伏见稻荷大社有超过一万座�的鸟居。',
      '京都的祇园花街自 1600 年代起就有艺妓活动。',
      '任天堂于 1889 年在京都创立，最初是一家扑克牌公司。',
    ],
  },
  paris: {
    en: [
      'The Eiffel Tower was supposed to be temporary — built for the 1889 World Fair.',
      'Paris has 470+ parks and gardens, making it one of Europe\'s greenest capitals.',
      'The Louvre is the world\'s most visited museum with 10 million visitors per year.',
      'Paris has only one stop sign in the entire city — it\'s in the 16th arrondissement.',
      'There are 1,500+ bakeries in Paris. Baguettes are regulated by law.',
    ],
    'zh-TW': [
      '艾菲爾鐵塔原本是臨時建築，為 1889 年世界博覽會而建。',
      '巴黎有超過 470 個公園和花園，是歐洲最綠的首都之一。',
      '羅浮宮是全球最多人造訪的博物館，每年有 1,000 萬訪客。',
      '巴黎全市只有一個停車標誌，位於第 16 區。',
      '巴黎有超過 1,500 家麵包店，法棍麵包的製作有法律規定。',
    ],
    'zh-CN': [
      '埃菲尔铁塔原本是临时建筑，为 1889 年世界博览会而建。',
      '巴黎有超过 470 个公园和花园，是欧洲最绿的首都之一。',
      '卢浮宫是全球最多人造访的博物馆，每年有 1,000 万访客。',
      '巴黎全市只有一个停车标志，位于第 16 区。',
      '巴黎有超过 1,500 家面包店，法棍面包的制作有法律规定。',
    ],
  },
  seoul: {
    en: [
      'Seoul\'s subway system is one of the longest in the world with 340+ stations.',
      'South Korea has the fastest average internet speed in the world.',
      'Seoul\'s Gangnam district inspired the viral hit "Gangnam Style" in 2012.',
      'There are over 100,000 restaurants in Seoul — a food lover\'s paradise.',
      'Korean BBQ originated in the Joseon dynasty over 600 years ago.',
    ],
    'zh-TW': [
      '首爾地鐵系統擁有超過 340 個車站，是世界上最長的地鐵之一。',
      '韓國的平均網速是全世界最快的。',
      '首爾的江南區啟發了 2012 年的洗腦神曲「江南 Style」。',
      '首爾有超過 10 萬間餐廳，是美食愛好者的天堂。',
      '韓式烤肉起源於超過 600 年前的朝鮮王朝。',
    ],
    'zh-CN': [
      '首尔地铁系统拥有超过 340 个车站，是世界上最长的地铁之一。',
      '韩国的平均网速是全世界最快的。',
      '首尔的江南区启发了 2012 年的洗脑神曲「江南 Style」。',
      '首尔有超过 10 万间餐厅，是美食爱好者的天堂。',
      '韩式烤肉起源于超过 600 年前的朝鲜王朝。',
    ],
  },
  taipei: {
    en: [
      'Taipei\'s night markets serve over 1 million visitors every night.',
      'Taipei 101 was the world\'s tallest building from 2004 to 2010.',
      'Taiwan is home to the world\'s best bubble tea — invented in Taichung in the 1980s.',
      'Taipei has one of the highest densities of convenience stores in the world.',
      'The Taipei MRT is consistently ranked one of the cleanest subway systems globally.',
    ],
    'zh-TW': [
      '台北的夜市每晚吸引超過 100 萬名遊客。',
      '台北 101 從 2004 年到 2010 年是世界最高建築。',
      '珍珠奶茶於 1980 年代在台中發明，是台灣的驕傲。',
      '台北的便利店密度是全世界最高之一。',
      '台北捷運一直被評為全球最乾淨的地鐵系統之一。',
    ],
    'zh-CN': [
      '台北的夜市每晚吸引超过 100 万名游客。',
      '台北 101 从 2004 年到 2010 年是世界最高建筑。',
      '珍珠奶茶于 1980 年代在台中发明，是台湾的骄傲。',
      '台北的便利店密度是全世界最高之一。',
      '台北捷运一直被评为全球最干净的地铁系统之一。',
    ],
  },
  london: {
    en: [
      'London\'s Underground is the world\'s oldest metro system, opened in 1863.',
      'Big Ben actually refers to the bell inside, not the tower itself.',
      'London has over 170 museums — many of them are free.',
      'Over 300 languages are spoken in London, making it the most linguistically diverse city.',
      'The black cabs\' drivers must pass "The Knowledge" — memorizing 25,000 streets.',
    ],
    'zh-TW': [
      '倫敦地鐵是全世界最古老的地鐵系統，於 1863 年啟用。',
      '大笨鐘其實是指裡面的鐘，不是鐘塔本身。',
      '倫敦有超過 170 間博物館，許多都是免費的。',
      '倫敦使用超過 300 種語言，是世界上語言最多元的城市。',
      '黑色計程車司機必須通過「The Knowledge」考試，背下 25,000 條街道。',
    ],
    'zh-CN': [
      '伦敦地铁是全世界最古老的地铁系统，于 1863 年启用。',
      '大笨钟其实是指里面的钟，不是钟塔本身。',
      '伦敦有超过 170 间博物馆，许多都是免费的。',
      '伦敦使用超过 300 种语言，是世界上语言最多元的城市。',
      '黑色出租车司机必须通过「The Knowledge」考试，背下 25,000 条街道。',
    ],
  },
  bangkok: {
    en: [
      'Bangkok\'s full ceremonial name is 168 letters long — the longest city name in the world.',
      'Bangkok has over 400 temples (wats), including the famous Wat Arun and Wat Pho.',
      'Thai street food is so good that a street vendor won a Michelin star.',
      'Bangkok\'s Chatuchak Weekend Market has over 15,000 stalls.',
      'Thailand has never been colonized by a European power — the only Southeast Asian country.',
    ],
    'zh-TW': [
      '曼谷的正式名稱有 168 個字母，是全世界最長的城市名。',
      '曼谷有超過 400 座寺廟，包括著名的黎明寺和臥佛寺。',
      '泰國街頭小吃厲害到一位攤販獲得了米其林一星。',
      '曼谷的恰圖恰週末市場有超過 15,000 個攤位。',
      '泰國是東南亞唯一從未被歐洲殖民的國家。',
    ],
    'zh-CN': [
      '曼谷的正式名称有 168 个字母，是全世界最长的城市名。',
      '曼谷有超过 400 座寺庙，包括著名的黎明寺和卧佛寺。',
      '泰国街头小吃厉害到一位摊贩获得了米其林一星。',
      '曼谷的恰图恰周末市场有超过 15,000 个摊位。',
      '泰国是东南亚唯一从未被欧洲殖民的国家。',
    ],
  },
  singapore: {
    en: [
      'Singapore is one of only three surviving city-states in the world.',
      'Chewing gum has been banned in Singapore since 1992.',
      'Singapore\'s Changi Airport has been voted the world\'s best airport for 12 years.',
      'Singapore has over 6,000 hawker stalls — street food is a UNESCO cultural heritage.',
      'The Singapore Botanic Gardens is a UNESCO World Heritage Site.',
    ],
    'zh-TW': [
      '新加坡是世界上僅存的三個城市國家之一。',
      '新加坡自 1992 年起禁止口香糖。',
      '新加坡樟宜機場連續 12 年被評為全球最佳機場。',
      '新加坡有超過 6,000 個小販攤位，街頭美食已被列為聯合國非物質文化遺產。',
      '新加坡植物園是聯合國教科文組織世界遺產。',
    ],
    'zh-CN': [
      '新加坡是世界上仅存的三个城市国家之一。',
      '新加坡自 1992 年起禁止口香糖。',
      '新加坡樟宜机场连续 12 年被评为全球最佳机场。',
      '新加坡有超过 6,000 个小贩摊位，街头美食已被列为联合国非物质文化遗产。',
      '新加坡植物园是联合国教科文组织世界遗产。',
    ],
  },
  'hong kong': {
    en: [
      'Hong Kong has more skyscrapers than any other city in the world.',
      'The Star Ferry has been running across Victoria Harbour since 1888.',
      'Hong Kong has the most Rolls-Royces per capita in the world.',
      'Dim sum originated in Guangdong and was perfected in Hong Kong\'s tea houses.',
      'Hong Kong\'s MTR system runs at 99.9% on-time rate.',
    ],
    'zh-TW': [
      '香港的摩天大樓數量是全世界最多的城市。',
      '天星小輪自 1888 年起就在維多利亞港往返。',
      '香港的勞斯萊斯人均擁有量是全球最高。',
      '點心起源於廣東，在香港的茶樓被發揚光大。',
      '香港 MTR 的準時率高達 99.9%。',
    ],
    'zh-CN': [
      '香港的摩天大楼数量是全世界最多的城市。',
      '天星小轮自 1888 年起就在维多利亚港往返。',
      '香港的劳斯莱斯人均拥有量是全球最高。',
      '点心起源于广东，在香港的茶楼被发扬光大。',
      '香港 MTR 的准时率高达 99.9%。',
    ],
  },
  'san francisco': {
    en: [
      'The Golden Gate Bridge\'s iconic orange color is called "International Orange".',
      'San Francisco\'s cable cars are the only mobile National Historic Landmark.',
      'Alcatraz Island was a federal prison for only 29 years (1934-1963).',
      'San Francisco\'s Chinatown is the oldest in North America, established in 1848.',
      'The city has more restaurants per capita than any other US city.',
    ],
    'zh-TW': ['金門大橋的標誌性橙色叫做「國際橙」。', '舊金山的纜車是美國唯一的移動國家歷史地標。', '惡魔島作為聯邦監獄只用了 29 年（1934-1963）。', '舊金山的中國城是北美最古老的，建於 1848 年。', '舊金山的人均餐廳數量是全美最多的。'],
    'zh-CN': ['金门大桥的标志性橙色叫做「国际橙」。', '旧金山的缆车是美国唯一的移动国家历史地标。', '恶魔岛作为联邦监狱只用了 29 年（1934-1963）。', '旧金山的中国城是北美最古老的，建于 1848 年。', '旧金山的人均餐厅数量是全美最多的。'],
  },
  'los angeles': {
    en: [
      'The Hollywood Sign was originally "Hollywoodland" — an ad for a housing development in 1923.',
      'LA has more museums per capita than any other US city.',
      'Los Angeles averages 284 sunny days per year.',
      'The La Brea Tar Pits are the only active urban Ice Age excavation site in the world.',
      'Over 100 languages are spoken in Los Angeles.',
    ],
    'zh-TW': ['好萊塢標誌最初寫的是「Hollywoodland」，是 1923 年的房地產廣告。', '洛杉磯的人均博物館數量是全美最多的。', '洛杉磯平均每年有 284 天是晴天。', '拉布雷亞瀝青坑是全世界唯一活躍的城市冰河時期挖掘地。', '洛杉磯使用超過 100 種語言。'],
    'zh-CN': ['好莱坞标志最初写的是「Hollywoodland」，是 1923 年的房地产广告。', '洛杉矶的人均博物馆数量是全美最多的。', '洛杉矶平均每年有 284 天是晴天。', '拉布雷亚沥青坑是全世界唯一活跃的城市冰河时期挖掘地。', '洛杉矶使用超过 100 种语言。'],
  },
  hawaii: {
    en: [
      'Hawaii is the only US state that grows coffee commercially.',
      'Hawaii\'s Mauna Kea is the tallest mountain in the world measured from its base on the ocean floor.',
      'Hawaii has its own time zone and never observes daylight saving time.',
      'The Hawaiian alphabet has only 13 letters.',
      'Hawaii is the most isolated population center on Earth.',
    ],
    'zh-TW': ['夏威夷是美國唯一商業種植咖啡的州。', '夏威夷的冒納凱亞山從海底算起是世界最高的山。', '夏威夷有自己的時區，而且從不實行夏令時間。', '夏威夷語字母表只有 13 個字母。', '夏威夷是地球上最孤立的人口中心。'],
    'zh-CN': ['夏威夷是美国唯一商业种植咖啡的州。', '夏威夷的冒纳凯亚山从海底算起是世界最高的山。', '夏威夷有自己的时区，而且从不实行夏令时间。', '夏威夷语字母表只有 13 个字母。', '夏威夷是地球上最孤立的人口中心。'],
  },
  bali: {
    en: [
      'Bali has over 20,000 temples — there\'s at least one in every village.',
      'Bali\'s Nyepi (Day of Silence) shuts down the entire island, including the airport.',
      'Bali produces some of the world\'s most expensive coffee — Kopi Luwak.',
      'The Balinese calendar has 210 days instead of 365.',
      'Bali\'s rice terraces have been farmed using the same irrigation system for 1,000 years.',
    ],
    'zh-TW': ['峇里島有超過 20,000 座寺廟，每個村莊至少有一座。', '峇里島的寧靜日（Nyepi）會關閉整個島嶼，包括機場。', '峇里島出產世界上最貴的咖啡之一 — 麝香貓咖啡。', '峇里曆有 210 天，而不是 365 天。', '峇里島的梯田已經使用同一灌溉系統耕作了 1,000 年。'],
    'zh-CN': ['巴厘岛有超过 20,000 座寺庙，每个村庄至少有一座。', '巴厘岛的宁静日（Nyepi）会关闭整个岛屿，包括机场。', '巴厘岛出产世界上最贵的咖啡之一 — 麝香猫咖啡。', '巴厘历有 210 天，而不是 365 天。', '巴厘岛的梯田已经使用同一灌溉系统耕作了 1,000 年。'],
  },
  sydney: {
    en: [
      'Sydney Opera House has over 1 million roof tiles.',
      'Sydney Harbour Bridge is the world\'s largest steel arch bridge.',
      'Bondi Beach\'s name comes from an Aboriginal word meaning "waves breaking over rocks".',
      'Sydney has over 100 beaches within the city limits.',
      'The Sydney to Hobart yacht race is one of the most grueling in the world.',
    ],
    'zh-TW': ['悉尼歌劇院的屋頂有超過 100 萬塊瓷磚。', '悉尼港灣大橋是世界最大的鋼拱橋。', 'Bondi Beach 的名字來自原住民語言，意思是「浪打岩石」。', '悉尼市區內有超過 100 個海灘。', '悉尼到霍巴特帆船賽是世界上最艱難的比賽之一。'],
    'zh-CN': ['悉尼歌剧院的屋顶有超过 100 万块瓷砖。', '悉尼港湾大桥是世界最大的钢拱桥。', 'Bondi Beach 的名字来自原住民语言，意思是「浪打岩石」。', '悉尼市区内有超过 100 个海滩。', '悉尼到霍巴特帆船赛是世界上最艰难的比赛之一。'],
  },
  'new york': {
    en: [
      'New York City\'s subway runs 24/7 — one of the few systems in the world that never closes.',
      'Central Park is bigger than the entire country of Monaco.',
      'Over 800 languages are spoken in NYC, making it the most linguistically diverse city on Earth.',
      'The Statue of Liberty was a gift from France, assembled in 1886.',
      'NYC has over 27,000 restaurants across the five boroughs.',
    ],
    'zh-TW': ['紐約地鐵 24 小時運行，是世界上少數從不關閉的地鐵系統。', '中央公園比整個摩納哥國家還大。', '紐約市使用超過 800 種語言，是地球上語言最多元的城市。', '自由女神像是法國送的禮物，於 1886 年組裝完成。', '紐約五個行政區共有超過 27,000 家餐廳。'],
    'zh-CN': ['纽约地铁 24 小时运行，是世界上少数从不关闭的地铁系统。', '中央公园比整个摩纳哥国家还大。', '纽约市使用超过 800 种语言，是地球上语言最多元的城市。', '自由女神像是法国送的礼物，于 1886 年组装完成。', '纽约五个行政区共有超过 27,000 家餐厅。'],
  },
}

const GENERIC_FACTS: FactSet = {
  en: [
    'The world\'s longest flight is 18 hours and 50 minutes (Singapore to New York).',
    'France is the most visited country in the world with 90 million tourists per year.',
    'There are 195 countries in the world, but only 193 are UN members.',
    'The Great Wall of China is over 13,000 miles long.',
    'Iceland has no mosquitoes — one of the few places on Earth without them.',
    'Japan\'s trains are so punctual that a delay of 5 minutes gets a formal apology.',
  ],
  'zh-TW': [
    '全世界最長的航班是 18 小時 50 分鐘（新加坡到紐約）。',
    '法國是全世界最多遊客造訪的國家，每年有 9,000 萬名遊客。',
    '全世界有 195 個國家，但只有 193 個是聯合國成員。',
    '萬里長城全長超過 21,000 公里。',
    '冰島沒有蚊子，是地球上少數沒有蚊子的地方之一。',
    '日本的火車準時到如果延誤 5 分鐘，會發出正式道歉。',
  ],
  'zh-CN': [
    '全世界最长的航班是 18 小时 50 分钟（新加坡到纽约）。',
    '法国是全世界最多游客造访的国家，每年有 9,000 万名游客。',
    '全世界有 195 个国家，但只有 193 个是联合国成员。',
    '万里长城全长超过 21,000 公里。',
    '冰岛没有蚊子，是地球上少数没有蚊子的地方之一。',
    '日本的火车准时到如果延误 5 分钟，会发出正式道歉。',
  ],
}

// Parse destination from user prompt
function parseDestination(prompt: string): string | null {
  // Common English patterns
  const patterns = [
    /(?:trip to|go to|going to|visit|visiting|fly to|travel to|heading to|explore)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:for|from|with|,|\.|!|\?|$))/i,
    /([A-Z][A-Za-z\s]+?)\s+(?:trip|vacation|holiday|itinerary|tour|getaway)/i,
    /(\d+)\s*(?:days?|nights?|weeks?)\s+(?:in\s+)?([A-Z][A-Za-z\s]+?)(?:\s+(?:for|from|with|,|\.|!|\?|$))/i,
  ]

  for (const pat of patterns) {
    const m = prompt.match(pat)
    if (m) {
      // Third pattern captures destination in group 2
      const dest = (m[2] ?? m[1]).trim()
      if (dest.length >= 2 && dest.length <= 40) return dest
    }
  }

  // Chinese destination patterns
  const zhPatterns = [
    /(?:去|到|遊|游|玩)\s*([^\s,，。！!?？]{2,15})/,
    /([^\s,，。！!?？]{2,10})(?:之旅|旅行|旅遊|旅游|自由行|遊|游)/,
  ]
  for (const pat of zhPatterns) {
    const m = prompt.match(pat)
    if (m) return m[1].trim()
  }

  return null
}

// Match destination to fun facts key
function matchDestinationKey(dest: string): string | null {
  const d = dest.toLowerCase()
  const keys = Object.keys(DESTINATION_FACTS)
  // Direct match
  for (const key of keys) {
    if (d.includes(key) || key.includes(d)) return key
  }
  // Alias matching
  const aliases: Record<string, string> = {
    nyc: 'new york', manhattan: 'new york', brooklyn: 'new york',
    sf: 'san francisco', 'san fran': 'san francisco',
    la: 'los angeles',
    hk: 'hong kong', '香港': 'hong kong',
    '東京': 'tokyo', '东京': 'tokyo',
    '大阪': 'osaka',
    '京都': 'kyoto',
    '巴黎': 'paris',
    '首爾': 'seoul', '首尔': 'seoul',
    '台北': 'taipei',
    '倫敦': 'london', '伦敦': 'london',
    '曼谷': 'bangkok',
    '新加坡': 'singapore',
    '峇里': 'bali', '巴厘': 'bali',
    '悉尼': 'sydney',
    '紐約': 'new york', '纽约': 'new york',
    '洛杉磯': 'los angeles', '洛杉矶': 'los angeles',
    '舊金山': 'san francisco', '旧金山': 'san francisco',
    '夏威夷': 'hawaii',
    maui: 'hawaii', honolulu: 'hawaii', waikiki: 'hawaii',
  }
  for (const [alias, key] of Object.entries(aliases)) {
    if (d.includes(alias)) return key
  }
  return null
}

// Static positions — no Math.random() to avoid hydration mismatches
const STARS: [number, number, number][] = [
  [7, 4, 2], [12, 18, 1.5], [5, 33, 2], [19, 47, 1], [9, 61, 2.5],
  [14, 75, 1.5], [22, 88, 2], [30, 10, 1], [28, 29, 2], [35, 52, 1.5],
  [41, 70, 1], [38, 84, 2], [50, 6, 1.5], [55, 43, 2], [48, 93, 1],
]

// Overtime threshold multiplier — after this, show "almost there" messaging
const OVERTIME_MULTIPLIER = 1.3

// Fuzzy time estimate — deliberately overestimate ("underpromise, overdeliver")
function getFuzzyEstimate(days: number, lang: Lang): string {
  if (days <= 3) {
    return lang === 'zh-CN' ? '⏱️ 通常少于 1 分钟' : lang === 'zh-TW' ? '⏱️ 通常少於 1 分鐘' : '⏱️ Usually < 1 min'
  }
  if (days <= 7) {
    return lang === 'zh-CN' ? '⏱️ 通常少于 2 分钟' : lang === 'zh-TW' ? '⏱️ 通常少於 2 分鐘' : '⏱️ Usually < 2 min'
  }
  return lang === 'zh-CN' ? '⏱️ 通常少于 3 分钟' : lang === 'zh-TW' ? '⏱️ 通常少於 3 分鐘' : '⏱️ Usually < 3 min'
}

interface Props {
  lang: Lang
  phase: 'generating' | 'validating' | 'optimizing' | 'saving'
  estimatedSeconds: number
  vibe?: LoadingVibe
  prompt?: string
  dayProgress?: { current: number; total: number } | null
  totalDays?: number
  onCancel?: () => void
}

export function TripLoadingOverlay({ lang, phase, estimatedSeconds, vibe = 'default', prompt, dayProgress, totalDays, onCancel }: Props) {
  const isChinese = lang !== 'en'
  const vibeSet = MSGS[vibe] ?? MSGS.default
  const msgs = vibeSet[lang]
  const [idx, setIdx] = useState(0)
  const [factIdx, setFactIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(4)

  // Parse destination and get fun facts
  const { destination, facts, phaseSteps } = useMemo(() => {
    const parsed = prompt ? parseDestination(prompt) : null
    const destKey = parsed ? matchDestinationKey(parsed) : null
    const factSet = destKey ? DESTINATION_FACTS[destKey] : GENERIC_FACTS
    const displayDest = parsed || (isChinese ? '你的目的地' : 'your destination')
    return {
      destination: displayDest,
      facts: factSet[lang],
      phaseSteps: getPhaseSteps(displayDest, lang),
    }
  }, [prompt, lang, isChinese])

  // Rotate fun messages every 3 seconds
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % msgs.length), 3000)
    return () => clearInterval(t)
  }, [msgs.length])

  // Rotate fun facts every 7 seconds
  useEffect(() => {
    const t = setInterval(() => setFactIdx(i => (i + 1) % facts.length), 7000)
    return () => clearInterval(t)
  }, [facts.length])

  // Elapsed time counter
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Phase-based progress targets
  const phaseCap = phase === 'saving' ? 96
    : phase === 'optimizing' ? 90
    : phase === 'validating' ? 78
    : 60 // generating

  // Asymptotic progress — always moving, never stops, approaches phaseCap but never reaches it
  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        const remaining = phaseCap - p
        if (remaining <= 0.05) return phaseCap
        // Approach at 8% of remaining distance — fast start, exponential slowdown
        // At 30%→cap60: step=2.4, at 50%: step=0.8, at 58%: step=0.16
        const step = remaining * 0.08
        return p + Math.max(step, 0.03) // min 0.03% per tick so bar never truly stops
      })
    }, 800)
    return () => clearInterval(t)
  }, [phaseCap])

  // Jump progress when phase advances
  useEffect(() => {
    if (phase === 'validating') setProgress(p => Math.max(p, 62))
    if (phase === 'optimizing') setProgress(p => Math.max(p, 80))
    if (phase === 'saving') setProgress(p => Math.max(p, 88))
  }, [phase])

  // Server phase messages (when backend sends validating/optimizing/saving)
  const serverPhaseMsg = phase === 'saving'
    ? (lang === 'zh-CN' ? '生成分享页面中... ✨' : lang === 'zh-TW' ? '生成分享頁面中... ✨' : 'Generating your shareable page... ✨')
    : phase === 'optimizing'
    ? (lang === 'zh-CN' ? '优化你的路线... 📍' : lang === 'zh-TW' ? '優化你的路線... 📍' : 'Optimizing your route... 📍')
    : phase === 'validating'
    ? (lang === 'zh-CN' ? '在 Google 验证餐厅中... ✅' : lang === 'zh-TW' ? '在 Google 驗證餐廳中... ✅' : 'Verifying restaurants on Google... ✅')
    : null

  // During 'generating' phase, show destination-aware phase steps
  const timePhase = phaseSteps.find(p => elapsed < p.maxSec)
  const timePhaseMsg = timePhase ? timePhase.msg : null

  // Day-level progress message (replaces time-based steps when available)
  const dayProgressMsg = dayProgress && phase === 'generating'
    ? (lang === 'zh-CN' ? `📋 正在规划第 ${dayProgress.current} 天（共 ${dayProgress.total} 天）...`
       : lang === 'zh-TW' ? `📋 正在規劃第 ${dayProgress.current} 日（共 ${dayProgress.total} 日）...`
       : `📋 Planning Day ${dayProgress.current} of ${dayProgress.total}...`)
    : null

  const displayMsg = serverPhaseMsg ?? dayProgressMsg ?? timePhaseMsg ?? msgs[idx]
  const msgKey = serverPhaseMsg ? phase : dayProgressMsg ? `day-${dayProgress!.current}` : timePhaseMsg ? `time-${elapsed < 5 ? 0 : elapsed < 12 ? 1 : elapsed < 20 ? 2 : elapsed < 30 ? 3 : elapsed < 42 ? 4 : elapsed < 55 ? 5 : 6}` : idx

  // Overtime detection — when elapsed exceeds estimate, show reassuring message
  const isOvertime = elapsed > estimatedSeconds * OVERTIME_MULTIPLIER

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #091b2e 0%, #1a3a5c 55%, #2d5a8e 100%)' }}
      aria-live="polite"
      aria-label={isChinese ? '正在生成行程' : 'Generating your trip'}
    >
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {STARS.map(([top, left, size], i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ top: `${top}%`, left: `${left}%`, width: size, height: size, opacity: 0.22 }}
          />
        ))}
      </div>

      {/* Plane flight zone */}
      <div className="relative w-full mt-8 sm:mt-14" style={{ height: 72 }}>
        {/* Dashed flight path */}
        <div
          className="absolute left-0 right-0"
          style={{ top: '50%', borderTop: '1px dashed rgba(255,255,255,0.13)' }}
          aria-hidden
        />

        {/* Floating clouds */}
        <span
          className="absolute text-xl pointer-events-none"
          style={{ top: '10%', left: '10%', opacity: 0.28, animation: 'tgCloudFloat 8s ease-in-out infinite' }}
          aria-hidden
        >☁️</span>
        <span
          className="absolute text-lg pointer-events-none"
          style={{ top: '55%', left: '52%', opacity: 0.18, animation: 'tgCloudFloat 10s ease-in-out infinite reverse' }}
          aria-hidden
        >☁️</span>
        <span
          className="absolute text-2xl pointer-events-none"
          style={{ top: '8%', left: '80%', opacity: 0.22, animation: 'tgCloudFloat 7s ease-in-out infinite 1s' }}
          aria-hidden
        >☁️</span>

        {/* Animated plane — outer div moves horizontally, inner bobs vertically */}
        <div
          className="tg-plane-fly absolute pointer-events-none"
          style={{ top: 'calc(50% - 20px)' }}
          aria-hidden
        >
          <div
            className="tg-plane-bob text-4xl leading-none"
            style={{ filter: 'drop-shadow(0 0 12px rgba(255,140,66,0.85))' }}
          >
            ✈️
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-6">
        <p className="text-white/40 text-xs tracking-[0.18em] uppercase font-semibold mb-4">
          Lulgo ✨
        </p>

        {/* Real-time status message */}
        <div className="mb-4 h-8 flex items-center justify-center" key={msgKey}>
          <p className="text-white/70 text-sm font-medium animate-fade-in">
            {displayMsg}
          </p>
        </div>

        {/* Emoji Quiz */}
        <div className="mb-4">
          <EmojiQuiz lang={lang} prompt={prompt} />
        </div>

        {/* Fun fact */}
        {facts.length > 0 && (
          <div className="mb-6 max-w-sm mx-auto" key={`fact-${factIdx}`}>
            <p className="text-white/40 text-xs italic animate-fade-in">
              💡 {facts[factIdx]}
            </p>
          </div>
        )}

        {/* Progress bar + timer */}
        <div className="w-72 max-w-xs mx-auto">
          <div className="bg-white/10 rounded-full overflow-hidden mb-2.5" style={{ height: 6 }}>
            <div
              className="h-full rounded-full transition-all duration-[900ms] ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #ff8c42 0%, #ffb347 100%)',
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/30 text-xs">
              {phase === 'saving'
                ? (lang === 'zh-CN' ? '保存行程中...' : lang === 'zh-TW' ? '保存行程中...' : 'Saving your trip...')
                : phase === 'optimizing'
                ? (lang === 'zh-CN' ? '优化路线中...' : lang === 'zh-TW' ? '優化路線中...' : 'Optimizing routes...')
                : phase === 'validating'
                ? (lang === 'zh-CN' ? '验证餐厅中...' : lang === 'zh-TW' ? '驗證餐廳中...' : 'Verifying restaurants...')
                : (lang === 'zh-CN' ? 'AI 生成中...' : lang === 'zh-TW' ? 'AI 生成中...' : 'AI is working its magic...')}
            </span>
            <span className="text-white/40 text-xs">
              {isOvertime
                ? (lang === 'zh-CN' ? '✨ 快好了...' : lang === 'zh-TW' ? '✨ 快好了...' : '✨ Almost there...')
                : phase === 'generating'
                  ? getFuzzyEstimate(totalDays ?? 2, lang)
                  : (lang === 'zh-CN' ? '✨ 正在生成中' : lang === 'zh-TW' ? '✨ 正在生成中' : '✨ Working on it')}
            </span>
          </div>
        </div>

        {/* Cancel button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-8 text-white/40 text-xs hover:text-white/70 transition-colors underline underline-offset-2"
          >
            {isChinese ? '取消' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  )
}
