'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

type Lang = 'en' | 'zh-TW' | 'zh-CN'

interface QuizQuestion {
  emoji: string
  answer: string
  answerZh: string   // zh-TW
  answerZhCN: string // zh-CN
  fact: string
  factZh: string
  factZhCN: string
}

const QUESTIONS: QuizQuestion[] = [
  { emoji: '🗼🍣🌸', answer: 'Tokyo', answerZh: '東京', answerZhCN: '东京', fact: 'Tokyo has more Michelin-starred restaurants than any other city.', factZh: '東京的米其林星級餐廳數量是全球最多的。', factZhCN: '东京的米其林星级餐厅数量是全球最多的。' },
  { emoji: '🗽🍕🌃', answer: 'New York', answerZh: '紐約', answerZhCN: '纽约', fact: 'NYC\'s subway runs 24/7 and never closes.', factZh: '紐約地鐵 24 小時運行，從不關閉。', factZhCN: '纽约地铁 24 小时运行，从不关闭。' },
  { emoji: '🥐🗼🎨', answer: 'Paris', answerZh: '巴黎', answerZhCN: '巴黎', fact: 'The Eiffel Tower was meant to be temporary.', factZh: '艾菲爾鐵塔原本只是臨時建築。', factZhCN: '埃菲尔铁塔原本只是临时建筑。' },
  { emoji: '🌮🏖️🎸', answer: 'Mexico City', answerZh: '墨西哥城', answerZhCN: '墨西哥城', fact: 'Mexico City is sinking 10 inches per year.', factZh: '墨西哥城每年下沉 25 厘米。', factZhCN: '墨西哥城每年下沉 25 厘米。' },
  { emoji: '🍝🏛️⛪', answer: 'Rome', answerZh: '羅馬', answerZhCN: '罗马', fact: 'Visitors throw €1.5 million into the Trevi Fountain yearly.', factZh: '每年遊客往許願池投入 150 萬歐元。', factZhCN: '每年游客往许愿池投入 150 万欧元。' },
  { emoji: '🌊🏄🌺', answer: 'Hawaii', answerZh: '夏威夷', answerZhCN: '夏威夷', fact: 'The Hawaiian alphabet has only 13 letters.', factZh: '夏威夷語字母表只有 13 個字母。', factZhCN: '夏威夷语字母表只有 13 个字母。' },
  { emoji: '🎰🏜️✨', answer: 'Las Vegas', answerZh: '拉斯維加斯', answerZhCN: '拉斯维加斯', fact: 'Las Vegas hotels have no clocks — to keep you gambling.', factZh: '拉斯維加斯酒店沒有時鐘，讓你一直賭。', factZhCN: '拉斯维加斯酒店没有时钟，让你一直赌。' },
  { emoji: '🧇🍫🏰', answer: 'Brussels', answerZh: '布魯塞爾', answerZhCN: '布鲁塞尔', fact: 'Belgium has over 2,000 chocolate shops.', factZh: '比利時有超過 2,000 間巧克力店。', factZhCN: '比利时有超过 2,000 间巧克力店。' },
  { emoji: '🦘🏖️🎭', answer: 'Sydney', answerZh: '悉尼', answerZhCN: '悉尼', fact: 'Sydney Opera House has over 1 million roof tiles.', factZh: '悉尼歌劇院屋頂有超過 100 萬塊瓷磚。', factZhCN: '悉尼歌剧院屋顶有超过 100 万块瓷砖。' },
  { emoji: '🏔️🧀🍫', answer: 'Switzerland', answerZh: '瑞士', answerZhCN: '瑞士', fact: 'The Swiss eat 22 lbs of chocolate per person per year.', factZh: '瑞士人每年人均吃 10 公斤巧克力。', factZhCN: '瑞士人每年人均吃 10 公斤巧克力。' },
  { emoji: '🌸🏯🦌', answer: 'Kyoto', answerZh: '京都', answerZhCN: '京都', fact: 'Kyoto has over 2,000 temples and shrines.', factZh: '京都有超過 2,000 座寺廟和神社。', factZhCN: '京都有超过 2,000 座寺庙和神社。' },
  { emoji: '🛕🍛🐘', answer: 'India', answerZh: '印度', answerZhCN: '印度', fact: 'India has 22 official languages and 1,600+ dialects.', factZh: '印度有 22 種官方語言和 1,600 多種方言。', factZhCN: '印度有 22 种官方语言和 1,600 多种方言。' },
  { emoji: '🏖️🥥🐒', answer: 'Bali', answerZh: '峇里島', answerZhCN: '巴厘岛', fact: 'Bali has over 20,000 temples.', factZh: '峇里島有超過 20,000 座寺廟。', factZhCN: '巴厘岛有超过 20,000 座寺庙。' },
  { emoji: '🧋🏮🌃', answer: 'Taipei', answerZh: '台北', answerZhCN: '台北', fact: 'Bubble tea was invented in Taiwan in the 1980s.', factZh: '珍珠奶茶於 1980 年代在台灣發明。', factZhCN: '珍珠奶茶于 1980 年代在台湾发明。' },
  { emoji: '🐼🏮🥟', answer: 'Beijing', answerZh: '北京', answerZhCN: '北京', fact: 'The Forbidden City has 9,999 rooms.', factZh: '紫禁城有 9,999 個房間。', factZhCN: '紫禁城有 9,999 个房间。' },
  { emoji: '🌴🍹🎶', answer: 'Caribbean', answerZh: '加勒比海', answerZhCN: '加勒比海', fact: 'The Caribbean has over 7,000 islands.', factZh: '加勒比海有超過 7,000 個島嶼。', factZhCN: '加勒比海有超过 7,000 个岛屿。' },
  { emoji: '🏰🍺🥨', answer: 'Munich', answerZh: '慕尼黑', answerZhCN: '慕尼黑', fact: 'Oktoberfest visitors drink 7 million liters of beer.', factZh: '慕尼黑啤酒節遊客喝掉 700 萬升啤酒。', factZhCN: '慕尼黑啤酒节游客喝掉 700 万升啤酒。' },
  { emoji: '🐉🏮🥡', answer: 'Hong Kong', answerZh: '香港', answerZhCN: '香港', fact: 'Hong Kong has the most skyscrapers in the world.', factZh: '香港的摩天大樓數量是全球最多。', factZhCN: '香港的摩天大楼数量是全球最多。' },
  { emoji: '🌉🦀🌫️', answer: 'San Francisco', answerZh: '舊金山', answerZhCN: '旧金山', fact: 'The Golden Gate Bridge\'s color is "International Orange".', factZh: '金門大橋的顏色叫做「國際橙」。', factZhCN: '金门大桥的颜色叫做「国际橙」。' },
  { emoji: '🎭🍷🥩', answer: 'Buenos Aires', answerZh: '布宜諾斯艾利斯', answerZhCN: '布宜诺斯艾利斯', fact: 'Argentina consumes the most beef per capita in the world.', factZh: '阿根廷的人均牛肉消費量是全球最高。', factZhCN: '阿根廷的人均牛肉消费量是全球最高。' },
  { emoji: '🕌🏜️💎', answer: 'Dubai', answerZh: '杜拜', answerZhCN: '迪拜', fact: 'Dubai\'s police fleet includes Lamborghinis and Bugattis.', factZh: '杜拜警車包括蘭博基尼和布加迪。', factZhCN: '迪拜警车包括兰博基尼和布加迪。' },
  { emoji: '🎪🧀🚲', answer: 'Amsterdam', answerZh: '阿姆斯特丹', answerZhCN: '阿姆斯特丹', fact: 'Amsterdam has more bikes than people.', factZh: '阿姆斯特丹的自行車比人還多。', factZhCN: '阿姆斯特丹的自行车比人还多。' },
  { emoji: '🐻🏔️❄️', answer: 'Alaska', answerZh: '阿拉斯加', answerZhCN: '阿拉斯加', fact: 'Alaska has more coastline than all other US states combined.', factZh: '阿拉斯加的海岸線比其他美國各州加起來還長。', factZhCN: '阿拉斯加的海岸线比其他美国各州加起来还长。' },
  { emoji: '🏖️🐠🌅', answer: 'Maldives', answerZh: '馬爾代夫', answerZhCN: '马尔代夫', fact: 'The Maldives is the flattest country — highest point is 2.4 meters.', factZh: '馬爾代夫是全球最平坦的國家，最高點只有 2.4 米。', factZhCN: '马尔代夫是全球最平坦的国家，最高点只有 2.4 米。' },
  { emoji: '🎋🍜🏯', answer: 'Seoul', answerZh: '首爾', answerZhCN: '首尔', fact: 'South Korea has the fastest internet in the world.', factZh: '韓國的網速是全世界最快的。', factZhCN: '韩国的网速是全世界最快的。' },
  { emoji: '🦁🌿🏔️', answer: 'Kenya', answerZh: '肯尼亞', answerZhCN: '肯尼亚', fact: 'The Great Migration sees 1.5 million wildebeest cross Kenya.', factZh: '每年有 150 萬頭角馬遷徙經過肯尼亞。', factZhCN: '每年有 150 万头角马迁徙经过肯尼亚。' },
  { emoji: '💃🏖️⚽', answer: 'Rio de Janeiro', answerZh: '里約熱內盧', answerZhCN: '里约热内卢', fact: 'Rio\'s Carnival attracts 2 million people per day.', factZh: '里約嘉年華每天吸引 200 萬人。', factZhCN: '里约嘉年华每天吸引 200 万人。' },
  { emoji: '🏔️🙏🕉️', answer: 'Nepal', answerZh: '尼泊爾', answerZhCN: '尼泊尔', fact: 'Nepal is home to 8 of the world\'s 10 tallest mountains.', factZh: '世界十大最高峰中有 8 座在尼泊爾。', factZhCN: '世界十大最高峰中有 8 座在尼泊尔。' },
  { emoji: '🎡🍵☔', answer: 'London', answerZh: '倫敦', answerZhCN: '伦敦', fact: 'London\'s Underground is the world\'s oldest metro (1863).', factZh: '倫敦地鐵是世界上最古老的地鐵（1863 年）。', factZhCN: '伦敦地铁是世界上最古老的地铁（1863 年）。' },
  { emoji: '🍜🛵🏮', answer: 'Vietnam', answerZh: '越南', answerZhCN: '越南', fact: 'Vietnam has more motorbikes than cars — 45 million of them.', factZh: '越南的摩托車比汽車多，有 4,500 萬台。', factZhCN: '越南的摩托车比汽车多，有 4,500 万台。' },
  { emoji: '🏯🍜🌸', answer: 'Osaka', answerZh: '大阪', answerZhCN: '大阪', fact: 'Osaka invented instant ramen in 1971.', factZh: '大阪在 1971 年發明了即食拉麵。', factZhCN: '大阪在 1971 年发明了即食拉面。' },
  { emoji: '🦅🗿🌄', answer: 'Peru', answerZh: '秘魯', answerZhCN: '秘鲁', fact: 'Machu Picchu sits at 2,430 meters above sea level.', factZh: '馬丘比丘位於海拔 2,430 米。', factZhCN: '马丘比丘位于海拔 2,430 米。' },
  { emoji: '🐨🌊🏄', answer: 'Australia', answerZh: '澳洲', answerZhCN: '澳大利亚', fact: 'Australia has 10,685 beaches — it would take 29 years to visit one per day.', factZh: '澳洲有 10,685 個海灘，每天去一個要 29 年。', factZhCN: '澳大利亚有 10,685 个海滩，每天去一个要 29 年。' },
  { emoji: '🎶🥘🌊', answer: 'Barcelona', answerZh: '巴塞隆納', answerZhCN: '巴塞罗那', fact: 'La Sagrada Familia has been under construction since 1882.', factZh: '聖家堂自 1882 年起一直在建造中。', factZhCN: '圣家堂自 1882 年起一直在建造中。' },
  { emoji: '⛩️🍶🗻', answer: 'Japan', answerZh: '日本', answerZhCN: '日本', fact: 'Japan has over 6,800 islands.', factZh: '日本有超過 6,800 個島嶼。', factZhCN: '日本有超过 6,800 个岛屿。' },
  { emoji: '🏖️🐘🍲', answer: 'Thailand', answerZh: '泰國', answerZhCN: '泰国', fact: 'Thailand is the only Southeast Asian country never colonized.', factZh: '泰國是東南亞唯一從未被殖民的國家。', factZhCN: '泰国是东南亚唯一从未被殖民的国家。' },
]

// Deterministic shuffle using a seed from prompt text
function shuffleWithSeed(arr: QuizQuestion[], seed: number): QuizQuestion[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647
    const j = s % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function getAnswer(q: QuizQuestion, lang: Lang): string {
  if (lang === 'zh-TW') return q.answerZh
  if (lang === 'zh-CN') return q.answerZhCN
  return q.answer
}

function getFact(q: QuizQuestion, lang: Lang): string {
  if (lang === 'zh-TW') return q.factZh
  if (lang === 'zh-CN') return q.factZhCN
  return q.fact
}

// Pick 3 wrong answers from other questions, avoiding too-similar answers
function getChoices(questions: QuizQuestion[], currentIdx: number, lang: Lang): string[] {
  const correct = getAnswer(questions[currentIdx], lang)
  const others = questions
    .filter((_, i) => i !== currentIdx)
    .map(q => getAnswer(q, lang))
    .filter(a => a !== correct)

  // Deterministic pick based on index
  const wrong: string[] = []
  let offset = currentIdx * 7 + 3
  while (wrong.length < 3 && wrong.length < others.length) {
    const pick = others[offset % others.length]
    if (!wrong.includes(pick)) wrong.push(pick)
    offset += 11
  }

  // Insert correct answer at a deterministic position
  const pos = currentIdx % 4
  wrong.splice(pos, 0, correct)
  return wrong.slice(0, 4)
}

interface Props {
  lang: Lang
  prompt?: string
}

export function EmojiQuiz({ lang, prompt }: Props) {
  const isChinese = lang !== 'en'

  // Shuffle questions deterministically based on prompt
  const questions = useMemo(() => {
    const seed = (prompt || 'trip').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    return shuffleWithSeed(QUESTIONS, seed)
  }, [prompt])

  const [qIdx, setQIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)

  const current = questions[qIdx % questions.length]
  const correctAnswer = getAnswer(current, lang)
  const choices = useMemo(() => getChoices(questions, qIdx % questions.length, lang), [questions, qIdx, lang])
  const fact = getFact(current, lang)

  const isCorrect = selected === correctAnswer
  const showResult = selected !== null

  // Auto-advance to next question after 3 seconds
  useEffect(() => {
    if (!showResult) return
    const t = setTimeout(() => {
      setSelected(null)
      setQIdx(i => i + 1)
    }, 3000)
    return () => clearTimeout(t)
  }, [showResult])

  const handleSelect = useCallback((choice: string) => {
    if (showResult) return
    setSelected(choice)
    setAnswered(a => a + 1)
    if (choice === correctAnswer) setScore(s => s + 1)
  }, [showResult, correctAnswer])

  return (
    <div className="w-full max-w-sm mx-auto px-4">
      {/* Score */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-white/50 text-xs font-medium">
          {isChinese ? '猜猜係邊度！' : 'Guess the destination!'}
        </p>
        <p className="text-white/40 text-xs tabular-nums">
          {score}/{answered} ✓
        </p>
      </div>

      {/* Emoji clues */}
      <div className="flex items-center justify-center mb-4" style={{ minHeight: 60 }}>
        <span
          key={qIdx}
          className="tg-msg-fadein text-5xl tracking-wider"
          style={{ letterSpacing: '0.15em' }}
        >
          {current.emoji}
        </span>
      </div>

      {/* Answer buttons — 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {choices.map((choice) => {
          let btnClass = 'bg-white/10 border-white/20 text-white hover:bg-white/20'
          if (showResult) {
            if (choice === correctAnswer) {
              btnClass = 'bg-emerald-500/30 border-emerald-400/60 text-emerald-200'
            } else if (choice === selected && !isCorrect) {
              btnClass = 'bg-orange/30 border-orange/60 text-orange-200'
            } else {
              btnClass = 'bg-white/5 border-white/10 text-white/30'
            }
          }
          return (
            <button
              key={`${qIdx}-${choice}`}
              onClick={() => handleSelect(choice)}
              disabled={showResult}
              className={`border rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-95 ${btnClass}`}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Result feedback */}
      <div style={{ minHeight: 48 }} className="flex items-start justify-center">
        {showResult && (
          <p key={qIdx} className="tg-msg-fadein text-center text-xs leading-relaxed max-w-xs">
            {isCorrect ? (
              <span className="text-emerald-300">
                {isChinese ? '✅ 答啱咗！' : '✅ Correct!'}{' '}
              </span>
            ) : (
              <span className="text-orange-300">
                {isChinese ? `答案係 ${correctAnswer}！` : `The answer is ${correctAnswer}!`}{' '}
              </span>
            )}
            <span className="text-white/35">{fact}</span>
          </p>
        )}
      </div>
    </div>
  )
}
