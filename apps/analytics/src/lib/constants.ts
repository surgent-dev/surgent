export const CURRENT_VERSION = process.env.currentVersion

export const DEFAULT_DATE_RANGE_VALUE = '24hour'
export const DEFAULT_WEBSITE_LIMIT = 10
export const DEFAULT_RESET_DATE = '2000-01-01'
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_DATE_COMPARE = 'prev'

export const REALTIME_RANGE = 30

export const UNIT_TYPES = ['year', 'month', 'hour', 'day', 'minute']

export const EVENT_COLUMNS = [
  'path',
  'entry',
  'exit',
  'referrer',
  'domain',
  'title',
  'query',
  'event',
  'tag',
  'hostname',
]

export const SESSION_COLUMNS = [
  'browser',
  'os',
  'device',
  'screen',
  'language',
  'country',
  'city',
  'region',
]

export const SEGMENT_TYPES = {
  segment: 'segment',
  cohort: 'cohort',
}

export const FILTER_COLUMNS = {
  path: 'url_path',
  entry: 'url_path',
  exit: 'url_path',
  referrer: 'referrer_domain',
  domain: 'referrer_domain',
  hostname: 'hostname',
  title: 'page_title',
  query: 'url_query',
  os: 'os',
  browser: 'browser',
  device: 'device',
  country: 'country',
  region: 'region',
  city: 'city',
  language: 'language',
  event: 'event_name',
  tag: 'tag',
  eventType: 'event_type',
}

export const COLLECTION_TYPE = {
  event: 'event',
  identify: 'identify',
} as const

export const EVENT_TYPE = {
  pageView: 1,
  customEvent: 2,
  linkEvent: 3,
  pixelEvent: 4,
} as const

export const DATA_TYPE = {
  string: 1,
  number: 2,
  boolean: 3,
  date: 4,
  array: 5,
} as const

export const OPERATORS = {
  equals: 'eq',
  notEquals: 'neq',
  set: 's',
  notSet: 'ns',
  contains: 'c',
  doesNotContain: 'dnc',
  true: 't',
  false: 'f',
  greaterThan: 'gt',
  lessThan: 'lt',
  greaterThanEquals: 'gte',
  lessThanEquals: 'lte',
  before: 'bf',
  after: 'af',
} as const

export const DATA_TYPES = {
  [DATA_TYPE.string]: 'string',
  [DATA_TYPE.number]: 'number',
  [DATA_TYPE.boolean]: 'boolean',
  [DATA_TYPE.date]: 'date',
  [DATA_TYPE.array]: 'array',
} as const

export const DOMAIN_REGEX =
  /^(localhost(:[1-9]\d{0,4})?|((?=[a-z0-9-_]{1,63}\.)(xn--)?[a-z0-9-_]+(-[a-z0-9-_]+)*\.)+(xn--)?[a-z0-9-_]{2,63})$/
export const DATETIME_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3}(Z|\+[0-9]{2}:[0-9]{2})?)?$/

export const URL_LENGTH = 500
export const PAGE_TITLE_LENGTH = 500
export const EVENT_NAME_LENGTH = 50

export const UTM_PARAMS = ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term']

export const OS_NAMES = {
  'Android OS': 'Android',
  'Chrome OS': 'ChromeOS',
  'Mac OS': 'macOS',
  'Sun OS': 'SunOS',
  'Windows 10': 'Windows 10/11',
} as const

export const BROWSERS = {
  android: 'Android',
  aol: 'AOL',
  bb10: 'BlackBerry 10',
  beaker: 'Beaker',
  chrome: 'Chrome',
  'chromium-webview': 'Chrome (webview)',
  crios: 'Chrome (iOS)',
  curl: 'Curl',
  edge: 'Edge',
  'edge-chromium': 'Edge (Chromium)',
  'edge-ios': 'Edge (iOS)',
  facebook: 'Facebook',
  firefox: 'Firefox',
  fxios: 'Firefox (iOS)',
  ie: 'IE',
  instagram: 'Instagram',
  ios: 'iOS',
  'ios-webview': 'iOS (webview)',
  kakaotalk: 'KakaoTalk',
  miui: 'MIUI',
  opera: 'Opera',
  'opera-mini': 'Opera Mini',
  phantomjs: 'PhantomJS',
  safari: 'Safari',
  samsung: 'Samsung',
  searchbot: 'Searchbot',
  silk: 'Silk',
  yandexbrowser: 'Yandex',
} as const

export const SOCIAL_DOMAINS = [
  'bsky.app',
  'facebook.com',
  'fb.com',
  'ig.com',
  'instagram.com',
  'linkedin.',
  'news.ycombinator.com',
  'pinterest.',
  'reddit.',
  'snapchat.',
  't.co',
  'threads.net',
  'tiktok.',
  'twitter.com',
  'x.com',
]

export const SEARCH_DOMAINS = [
  'baidu.com',
  'bing.com',
  'chatgpt.com',
  'duckduckgo.com',
  'ecosia.org',
  'google.',
  'msn.com',
  'perplexity.ai',
  'search.brave.com',
  'yandex.',
]

export const SHOPPING_DOMAINS = [
  'alibaba.com',
  'aliexpress.com',
  'amazon.',
  'bestbuy.com',
  'ebay.com',
  'etsy.com',
  'newegg.com',
  'target.com',
  'walmart.com',
]

export const EMAIL_DOMAINS = [
  'gmail.',
  'hotmail.',
  'mail.yahoo.',
  'outlook.',
  'proton.me',
  'protonmail.',
]

export const VIDEO_DOMAINS = ['twitch.', 'youtube.']

export const PAID_AD_PARAMS = [
  'ad_id=',
  'aid=',
  'dclid=',
  'epik=',
  'fbclid=',
  'gclid=',
  'li_fat_id=',
  'msclkid=',
  'ob_click_id=',
  'pc_id=',
  'rdt_cid=',
  'scid=',
  'ttclid=',
  'twclid=',
  'utm_medium=cpc',
  'utm_medium=paid',
  'utm_medium=paid_social',
  'utm_source=google',
]

export const GROUPED_DOMAINS = [
  { name: 'Baidu', domain: 'baidu.com', match: 'baidu.' },
  { name: 'Bing', domain: 'bing.com', match: 'bing.' },
  { name: 'Brave', domain: 'brave.com', match: 'brave.' },
  { name: 'ChatGPT', domain: 'chatgpt.com', match: 'chatgpt.' },
  { name: 'DuckDuckGo', domain: 'duckduckgo.com', match: 'duckduckgo.' },
  { name: 'Facebook', domain: 'facebook.com', match: 'facebook.' },
  { name: 'GitHub', domain: 'github.com', match: 'github.' },
  { name: 'Google', domain: 'google.com', match: 'google.' },
  { name: 'Hacker News', domain: 'news.ycombinator.com', match: 'news.ycombinator.com' },
  { name: 'Instagram', domain: 'instagram.com', match: ['instagram.', 'ig.com'] },
  { name: 'LinkedIn', domain: 'linkedin.com', match: 'linkedin.' },
  { name: 'Pinterest', domain: 'pinterest.com', match: 'pinterest.' },
  { name: 'Reddit', domain: 'reddit.com', match: 'reddit.' },
  { name: 'Snapchat', domain: 'snapchat.com', match: 'snapchat.' },
  { name: 'Twitter', domain: 'twitter.com', match: ['twitter.', 't.co', 'x.com'] },
  { name: 'Yahoo', domain: 'yahoo.com', match: 'yahoo.' },
  { name: 'Yandex', domain: 'yandex.ru', match: 'yandex.' },
]
