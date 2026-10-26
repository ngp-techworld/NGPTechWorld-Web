/**
 * Per-page link previews for a client-rendered site.
 *
 * WhatsApp, Facebook, X, Telegram and LinkedIn build a preview by fetching the URL and reading the
 * HTML. None of them runs JavaScript. So for this SPA every shared link — a person, a project, the
 * home page — returned the same markup and therefore the same preview, no matter what the app set
 * on `document` once it booted.
 *
 * This function serves the real index.html with the block between the `<!--og-->` markers swapped
 * for tags describing whatever the URL actually points at. The response is still the ordinary app
 * shell, so a human following the link gets the SPA exactly as before; only the head differs.
 *
 * Wired up by vercel.json, which rewrites /team/:slug and /portfolio/:slug here, and the fixed
 * pages (/about, /services, /portfolio, /contact, /team).
 *
 * Project pages also carry JSON-LD (a SoftwareApplication, or a CreativeWork for design work), and
 * /portfolio an ItemList of the published projects, so search engines read what each page is about
 * without running the app either.
 */

const SITE = (process.env.SITE_URL || 'https://www.ngptechworld.com').replace(/\/+$/, '')
const API = (process.env.API_BASE_URL || 'https://api.ngptechworld.com/api').replace(/\/+$/, '')
const FALLBACK_IMAGE = `${SITE}/assets/og-cover.jpg`

/** HTML-escape everything interpolated into an attribute — titles are user-supplied content. */
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * JSON for inside a <script> element. JSON.stringify alone is not enough: a project named
 * `</script><script>…` would close the element and run whatever follows. `<`, `>` and `&` are
 * written as \u escapes — still the same string to a JSON parser, but never markup to an HTML one —
 * and so are the two line separators that JavaScript (unlike JSON) treats as line breaks.
 */
const jsonForScript = (data) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const ldScript = (data) => `<script type="application/ld+json">${jsonForScript(data)}</script>`

const ORGANIZATION = { '@type': 'Organization', name: 'NGP TechWorld', url: SITE }

/** Collapse whitespace and cut on a word boundary: previews truncate hard at ~200 characters. */
function summarise(text, max = 190) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ') || max).trimEnd() + '…'
}

/** Uploaded media comes back from the API with whatever scheme it was generated with. */
const https = (url) => (url ? String(url).replace(/^http:\/\//i, 'https://') : null)

function tags({ title, description, url, image, type = 'website', imageAlt, jsonLd = null }) {
  const picture = https(image) || FALLBACK_IMAGE
  // A portrait or a project shot is not 1.91:1, so width/height are declared only for the shared
  // cover — claiming the wrong dimensions makes some clients letterbox or refuse the image.
  const dimensions = picture === FALLBACK_IMAGE
    ? '<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />'
    : ''

  return `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />

    <meta property="og:type" content="${esc(type)}" />
    <meta property="og:site_name" content="NGP TechWorld" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(picture)}" />
    ${dimensions}
    <meta property="og:image:alt" content="${esc(imageAlt || title)}" />
    <meta property="og:locale" content="ar_AR" />
    <meta property="og:locale:alternate" content="en_US" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(picture)}" />
    ${jsonLd ? ldScript(jsonLd) : ''}
  `.trim()
}

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const body = await res.json()
  return body?.data ?? null
}

/** The Arabic field with the English one as the fallback, since the site defaults to Arabic. */
const pick = (record, key) => record?.[`${key}_ar`] || record?.[`${key}_en`] || ''

/**
 * The site's fixed pages.
 *
 * Every one of them was being served the same index.html, which meant the same <title>, the same
 * description and the same canonical for /about as for /contact. Google's first look at them was
 * therefore six identical documents, and it left thirteen of them in "discovered, not indexed" —
 * never crawled, because nothing in the markup suggested there was anything new to crawl.
 *
 * `texts` is the key each page's heading has in GET /api/content, so the title the crawler reads
 * is the heading the admin actually set rather than a second copy drifting out of step with it.
 * `fallback` is what stands in when the API is unreachable — never nothing, since a page with no
 * title is the problem this exists to fix.
 */
const PAGES = {
  about: {
    texts: ['aboutTitle', 'aboutStory'],
    fallback: ['من نحن', 'تعرّف على NGP TechWorld: قصتنا ورؤيتنا وقيمنا وفريق المهندسين والمصممين الذي يبني حلولك الرقمية.'],
  },
  services: {
    texts: ['servicesTitle', 'servicesSub'],
    fallback: ['خدماتنا', 'تطوير مواقع وتطبيقات، تصميم UI/UX، أنظمة ERP و CRM، حلول سحابية وذكاء اصطناعي، ودعم وصيانة.'],
  },
  portfolio: {
    texts: ['portfolioTitle', 'portfolioSub'],
    fallback: ['معرض الأعمال', 'مشاريع أنجزناها لعملاء في قطاعات متنوعة — مواقع وتطبيقات وأنظمة إدارية وحلول ذكاء اصطناعي.'],
  },
  contact: {
    texts: ['contactTitle', 'contactSub'],
    fallback: ['تواصل معنا', 'أخبرنا عن مشروعك وسنعود إليك خلال 24 ساعة. اطلب عرض سعر لتطوير موقع أو تطبيق أو نظام.'],
  },
  team: {
    // The team page has no dashboard-managed heading, so it is only ever the fallback.
    texts: [],
    fallback: ['فريقنا', 'المهندسون والمصممون في NGP TechWorld — الأشخاص الذين يحوّلون أفكارك إلى منتجات برمجية حقيقية.'],
  },
}

/** The published projects as a schema.org ItemList, or null when the list cannot be had. */
async function projectList(url) {
  const projects = await fetchJson('/projects').catch(() => null)
  if (!Array.isArray(projects) || projects.length === 0) return null
  // Enough to describe the page; a crawler that wants every project has the sitemap.
  const shown = projects.filter((p) => p?.slug).slice(0, 50)
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url,
    numberOfItems: shown.length,
    itemListElement: shown.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}/portfolio/${encodeURIComponent(p.slug)}`,
      name: pick(p, 'name'),
    })),
  }
}

async function describePage(name, url) {
  const page = PAGES[name]
  if (!page) return null

  const [content, list] = await Promise.all([
    fetchJson('/content').catch(() => null),
    name === 'portfolio' ? projectList(url).catch(() => null) : null,
  ])
  const texts = content?.texts ?? {}
  // The Arabic wording, matching the language the shell itself is served in.
  const fromDashboard = (key) => (typeof texts?.[key]?.ar === 'string' ? texts[key].ar.trim() : '')

  const [titleKey, descriptionKey] = page.texts
  const [titleFallback, descriptionFallback] = page.fallback

  const heading = fromDashboard(titleKey) || titleFallback
  const description = fromDashboard(descriptionKey) || descriptionFallback

  return tags({
    title: `${heading} | NGP TechWorld`,
    description: summarise(description),
    url,
    jsonLd: list ? { ...list, name: heading } : null,
  })
}

async function describeTeamMember(slug, url) {
  const member = await fetchJson(`/team/${encodeURIComponent(slug)}`)
  if (!member) return null

  const name = pick(member, 'name')
  const role = pick(member, 'job_title')
  const bio = pick(member, 'bio')

  return tags({
    // `profile` rather than `website`: it is a person, and some clients lay the card out differently.
    type: 'profile',
    title: role ? `${name} — ${role} | NGP TechWorld` : `${name} | NGP TechWorld`,
    description: summarise(bio || role || 'عضو في فريق NGP TechWorld'),
    url,
    image: member.avatar,
    imageAlt: name,
  })
}

// The project's category as a schema.org application category. Design work is not software, so it
// is described as a CreativeWork instead and gets neither this nor an operating system.
const APPLICATION_CATEGORIES = {
  web: 'WebApplication',
  mobile: 'MobileApplication',
  erp: 'BusinessApplication',
  ai: 'BusinessApplication',
}

// The registry's platforms that are operating systems; `api`, `cli` and `other` are not.
const OPERATING_SYSTEMS = { web: 'Web', android: 'Android', ios: 'iOS', windows: 'Windows', macos: 'macOS', linux: 'Linux' }

function projectJsonLd(project, url, description) {
  const software = project.category !== 'design'
  const systems = [...new Set((project.platforms ?? []).map((p) => OPERATING_SYSTEMS[p]).filter(Boolean))]
  const name = pick(project, 'name')
  const english = project.name_en && project.name_en !== name ? project.name_en : null

  const data = {
    '@context': 'https://schema.org',
    '@type': software ? 'SoftwareApplication' : 'CreativeWork',
    name,
    ...(english ? { alternateName: english } : {}),
    ...(description ? { description } : {}),
    ...(project.cover_image ? { image: https(project.cover_image) } : {}),
    url,
    author: ORGANIZATION,
  }
  if (software) {
    if (APPLICATION_CATEGORIES[project.category]) data.applicationCategory = APPLICATION_CATEGORIES[project.category]
    if (systems.length) data.operatingSystem = systems.join(', ')
  }
  return data
}

async function describeProject(slug, url) {
  const project = await fetchJson(`/projects/${encodeURIComponent(slug)}`)
  if (!project) return null

  const name = pick(project, 'name')
  const short = pick(project, 'short')
  const description = pick(project, 'description')

  const summary = summarise(short || description)

  return tags({
    type: 'article',
    title: `${name} | NGP TechWorld`,
    description: summary,
    url,
    image: project.cover_image,
    imageAlt: name,
    jsonLd: projectJsonLd(project, url, summary),
  })
}

export default async function handler(request, response) {
  const { searchParams, origin } = new URL(request.url, `https://${request.headers.host}`)
  const type = searchParams.get('type')
  const slug = searchParams.get('slug')

  // The shell is fetched from this same deployment rather than read off disk: a serverless
  // function does not share a filesystem with the static output, and this way the hashed asset
  // names in it are always the ones this deployment actually built.
  const shell = await fetch(`${origin}/index.html`).then((r) => r.text())

  const path = type === 'page' ? `/${slug}` : type === 'team' ? `/team/${slug}` : `/portfolio/${slug}`
  const url = `${SITE}${path}`

  let replacement = null
  try {
    if (type === 'page') replacement = await describePage(slug, url)
    else if (type === 'team') replacement = await describeTeamMember(slug, url)
    else replacement = await describeProject(slug, url)
  } catch {
    // An API hiccup must not take the page down with it — fall through to the site's own tags.
    replacement = null
  }

  const html = replacement
    ? shell.replace(/<!--og-->[\s\S]*?<!--\/og-->/, `<!--og-->\n${replacement}\n    <!--/og-->`)
    : shell

  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  // Cached at the edge so a popular link is not one API round trip per crawler, and served stale
  // while it refreshes so an edit to a profile shows up without anyone waiting for it.
  response.setHeader(
    'Cache-Control',
    replacement
      ? 'public, s-maxage=300, stale-while-revalidate=86400'
      : 'public, s-maxage=30, stale-while-revalidate=300',
  )
  response.status(200).send(html)
}
