import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './share.js'

/**
 * These previews are only ever seen by crawlers, so nothing in the app breaks when this function
 * breaks — the page still loads, the link just looks like every other link. That is exactly why
 * it is worth testing.
 */

const SHELL = `<!doctype html>
<html><head>
<!--og-->
<title>NGP TechWorld — نبني مستقبلك الرقمي</title>
<meta property="og:image" content="https://www.ngptechworld.com/assets/og-cover.jpg" />
<!--/og-->
<script type="module" src="/assets/index-abc123.js"></script>
</head><body><div id="app"></div></body></html>`

const MEMBER = {
  slug: 'sara-ahmad',
  name_ar: 'سارة أحمد', name_en: 'Sara Ahmad',
  job_title_ar: 'مهندسة برمجيات', job_title_en: 'Software Engineer',
  bio_ar: 'تبني تطبيقات موبايل منذ ست سنوات.', bio_en: 'Builds mobile apps.',
  avatar: 'http://api.ngptechworld.com/media/team-profiles/sara.jpg',
}

const PROJECT = {
  slug: 'food-delivery-app',
  name_ar: 'تطبيق توصيل طلبات', name_en: 'Food Delivery App',
  short_ar: 'تطبيق توصيل مع تتبّع لحظي للطلبات.', short_en: 'Delivery with live tracking.',
  cover_image: 'https://api.ngptechworld.com/media/projects/food.jpg',
}

/** Stand in for both the shell fetch and the API call. */
function mockFetch({ member = null, project = null, content = null, projects = null } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url)
    if (href.endsWith('/index.html')) return { ok: true, text: async () => SHELL }
    if (href.endsWith('/projects')) {
      return projects ? { ok: true, json: async () => ({ data: projects }) } : { ok: false }
    }
    if (href.includes('/team/')) {
      return member ? { ok: true, json: async () => ({ data: member }) } : { ok: false }
    }
    if (href.includes('/projects/')) {
      return project ? { ok: true, json: async () => ({ data: project }) } : { ok: false }
    }
    if (href.endsWith('/content')) {
      return content ? { ok: true, json: async () => ({ data: content }) } : { ok: false }
    }
    return { ok: false }
  }))
}

/** Minimal stand-in for Vercel's response object. */
function makeResponse() {
  const res = {
    headers: {},
    body: null,
    statusCode: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v },
    status(code) { this.statusCode = code; return this },
    send(body) { this.body = body; return this },
  }
  return res
}

const request = (query) => ({ url: `/api/share?${query}`, headers: { host: 'www.ngptechworld.com' } })

afterEach(() => vi.unstubAllGlobals())

describe('share previews', () => {
  it('describes a team member with their own name, role, bio and photo', async () => {
    mockFetch({ member: MEMBER })
    const res = makeResponse()
    await handler(request('type=team&slug=sara-ahmad'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>سارة أحمد — مهندسة برمجيات | NGP TechWorld</title>')
    expect(res.body).toContain('content="تبني تطبيقات موبايل منذ ست سنوات."')
    expect(res.body).toContain('property="og:url" content="https://www.ngptechworld.com/team/sara-ahmad"')
    expect(res.body).toContain('property="og:type" content="profile"')
    // Upgraded: an http image on an https page is blocked as mixed content by several clients.
    expect(res.body).toContain('content="https://api.ngptechworld.com/media/team-profiles/sara.jpg"')
    expect(res.body).not.toContain('content="http://api.ngptechworld.com')
    // The shell's own script tag has to survive, or the page would preview but never boot.
    expect(res.body).toContain('/assets/index-abc123.js')
  })

  it('describes a project', async () => {
    mockFetch({ project: PROJECT })
    const res = makeResponse()
    await handler(request('type=project&slug=food-delivery-app'), res)

    expect(res.body).toContain('<title>تطبيق توصيل طلبات | NGP TechWorld</title>')
    expect(res.body).toContain('content="تطبيق توصيل مع تتبّع لحظي للطلبات."')
    expect(res.body).toContain('content="https://api.ngptechworld.com/media/projects/food.jpg"')
  })

  it('declares image dimensions only for the shared cover, never for an upload', async () => {
    mockFetch({ member: MEMBER })
    const res = makeResponse()
    await handler(request('type=team&slug=sara-ahmad'), res)
    // A portrait is not 1.91:1; claiming it is makes clients letterbox or drop it.
    expect(res.body).not.toContain('og:image:width')

    mockFetch({ member: { ...MEMBER, avatar: null } })
    const bare = makeResponse()
    await handler(request('type=team&slug=sara-ahmad'), bare)
    expect(bare.body).toContain('og:image:width" content="1200"')
    expect(bare.body).toContain('/assets/og-cover.jpg')
  })

  it('falls back to the site-wide tags when the record is gone', async () => {
    mockFetch({})
    const res = makeResponse()
    await handler(request('type=team&slug=deleted'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('NGP TechWorld — نبني مستقبلك الرقمي')
    expect(res.body).toContain('/assets/og-cover.jpg')
  })

  it('still serves the page when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/index.html')) return { ok: true, text: async () => SHELL }
      throw new Error('network down')
    }))
    const res = makeResponse()
    await handler(request('type=project&slug=anything'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app">')
  })

  it('escapes content so a quote in a title cannot break out of the attribute', async () => {
    mockFetch({ project: { ...PROJECT, name_ar: 'مشروع "خاص" <script>', short_ar: 'وصف & رموز' } })
    const res = makeResponse()
    await handler(request('type=project&slug=x'), res)

    expect(res.body).toContain('&quot;خاص&quot;')
    expect(res.body).toContain('&lt;script&gt;')
    expect(res.body).toContain('وصف &amp; رموز')
  })
})

describe('the fixed pages', () => {
  it('gives each one its own title, description and canonical', async () => {
    // They were all served the same index.html, so Google saw six identical documents and left
    // them in "discovered, not indexed" without ever crawling them.
    mockFetch({})
    const res = makeResponse()
    await handler(request('type=page&slug=about'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>من نحن | NGP TechWorld</title>')
    expect(res.body).toContain('rel="canonical" href="https://www.ngptechworld.com/about"')
    expect(res.body).toContain('property="og:url" content="https://www.ngptechworld.com/about"')
  })

  it('prefers the heading the dashboard actually publishes', async () => {
    mockFetch({ content: { texts: { contactTitle: { ar: 'لنبدأ الحديث', en: "Let's talk" }, contactSub: { ar: 'نعود إليك خلال 24 ساعة.', en: '' } } } })
    const res = makeResponse()
    await handler(request('type=page&slug=contact'), res)

    expect(res.body).toContain('<title>لنبدأ الحديث | NGP TechWorld</title>')
    expect(res.body).toContain('content="نعود إليك خلال 24 ساعة."')
  })

  it('falls back to its own wording when the dashboard has none', async () => {
    mockFetch({ content: { texts: { contactTitle: { ar: '   ', en: '' } } } })
    const res = makeResponse()
    await handler(request('type=page&slug=contact'), res)

    // Blank is not a title; a page with none is the problem this exists to fix.
    expect(res.body).toContain('<title>تواصل معنا | NGP TechWorld</title>')
  })

  it('still answers when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/index.html')) return { ok: true, text: async () => SHELL }
      throw new Error('network down')
    }))
    const res = makeResponse()
    await handler(request('type=page&slug=services'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>خدماتنا | NGP TechWorld</title>')
  })

  it('leaves the shell alone for a page it does not know', async () => {
    mockFetch({})
    const res = makeResponse()
    await handler(request('type=page&slug=nowhere'), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('NGP TechWorld — نبني مستقبلك الرقمي')
  })

  it('keeps the app booting — the page is still the SPA', async () => {
    mockFetch({})
    const res = makeResponse()
    await handler(request('type=page&slug=team'), res)

    expect(res.body).toContain('/assets/index-abc123.js')
    expect(res.body).toContain('<div id="app">')
  })
})

/** Every JSON-LD block in the page, parsed. */
const jsonLd = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))

describe('structured data', () => {
  it('describes a project as a SoftwareApplication made by NGP TechWorld', async () => {
    mockFetch({ project: { ...PROJECT, category: 'mobile', platforms: ['android', 'ios', 'api'] } })
    const res = makeResponse()
    await handler(request('type=project&slug=food-delivery-app'), res)

    const [data] = jsonLd(res.body)
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'تطبيق توصيل طلبات',
      alternateName: 'Food Delivery App',
      description: 'تطبيق توصيل مع تتبّع لحظي للطلبات.',
      image: 'https://api.ngptechworld.com/media/projects/food.jpg',
      url: 'https://www.ngptechworld.com/portfolio/food-delivery-app',
      applicationCategory: 'MobileApplication',
      // Only real operating systems: an API is not one.
      operatingSystem: 'Android, iOS',
      author: { '@type': 'Organization', name: 'NGP TechWorld', url: 'https://www.ngptechworld.com' },
    })
    // Inside the replaced block, so it is part of what crawlers read and the shell keeps booting.
    expect(res.body.indexOf('application/ld+json')).toBeLessThan(res.body.indexOf('<!--/og-->'))
    expect(res.body).toContain('/assets/index-abc123.js')
  })

  it('leaves out what the project does not have rather than sending empty values', async () => {
    mockFetch({ project: { ...PROJECT, cover_image: null, platforms: [], category: 'erp' } })
    const res = makeResponse()
    await handler(request('type=project&slug=food-delivery-app'), res)

    const [data] = jsonLd(res.body)
    expect(data.applicationCategory).toBe('BusinessApplication')
    expect(data).not.toHaveProperty('image')
    expect(data).not.toHaveProperty('operatingSystem')
  })

  it('describes a design project as a CreativeWork, which has no operating system', async () => {
    mockFetch({ project: { ...PROJECT, category: 'design', platforms: ['web'] } })
    const res = makeResponse()
    await handler(request('type=project&slug=food-delivery-app'), res)

    const [data] = jsonLd(res.body)
    expect(data['@type']).toBe('CreativeWork')
    expect(data).not.toHaveProperty('operatingSystem')
    expect(data).not.toHaveProperty('applicationCategory')
    expect(data.author).toEqual({ '@type': 'Organization', name: 'NGP TechWorld', url: 'https://www.ngptechworld.com' })
  })

  it('cannot be broken out of: a name that closes the script tag stays inside the JSON', async () => {
    const hostile = 'x</script><script>alert(1)</script><!--'
    mockFetch({ project: { ...PROJECT, name_ar: hostile, short_ar: 'a & b > c' } })
    const res = makeResponse()
    await handler(request('type=project&slug=x'), res)

    expect(res.body).not.toContain('</script><script>alert(1)')
    const [data] = jsonLd(res.body)
    expect(data.name).toBe(hostile)
    expect(data.description).toBe('a & b > c')
  })

  it('lists the published projects on /portfolio as an ItemList', async () => {
    mockFetch({ projects: [PROJECT, { slug: 'pos-system', name_ar: '', name_en: 'POS System' }] })
    const res = makeResponse()
    await handler(request('type=page&slug=portfolio'), res)

    expect(res.body).toContain('<title>معرض الأعمال | NGP TechWorld</title>')
    const [list] = jsonLd(res.body)
    expect(list).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      url: 'https://www.ngptechworld.com/portfolio',
      numberOfItems: 2,
      itemListElement: [
        { '@type': 'ListItem', position: 1, url: 'https://www.ngptechworld.com/portfolio/food-delivery-app', name: 'تطبيق توصيل طلبات' },
        { '@type': 'ListItem', position: 2, url: 'https://www.ngptechworld.com/portfolio/pos-system', name: 'POS System' },
      ],
    })
  })

  it('still describes /portfolio when the project list cannot be loaded', async () => {
    mockFetch({})
    const res = makeResponse()
    await handler(request('type=page&slug=portfolio'), res)

    expect(res.body).toContain('<title>معرض الأعمال | NGP TechWorld</title>')
    expect(jsonLd(res.body)).toEqual([])
  })

  it('adds no list to the other fixed pages', async () => {
    mockFetch({ projects: [PROJECT] })
    const res = makeResponse()
    await handler(request('type=page&slug=about'), res)

    expect(jsonLd(res.body)).toEqual([])
  })
})

describe('replacement patterns in content', () => {
  // String.prototype.replace expands $` $' $& $$ in a string replacement: a project called
  // "Shop $' end" pasted the rest of the shell — the app's script and <div id="app"> — into the head.
  const hostile = "Shop $' end $& and $` and $$"

  it('serves a project whose text contains $-patterns verbatim, with the shell intact', async () => {
    mockFetch({ project: { ...PROJECT, name_ar: hostile, name_en: `EN ${hostile}`, short_ar: `short ${hostile}` } })
    const res = makeResponse()
    await handler(request('type=project&slug=x'), res)

    expect(res.body.match(/<div id="app">/g)).toHaveLength(1)
    expect(res.body.match(/\/assets\/index-abc123\.js/g)).toHaveLength(1)
    // HTML-escaped (& → &amp;) but otherwise exactly as written.
    expect(res.body).toContain(`<title>${hostile.replace(/&/g, '&amp;')} | NGP TechWorld</title>`)
    const [data] = jsonLd(res.body)
    expect(data.name).toBe(hostile)
    expect(data.alternateName).toBe(`EN ${hostile}`)
    expect(data.description).toBe(`short ${hostile}`)
  })

  it('keeps /portfolio intact when one project name in the list contains $-patterns', async () => {
    mockFetch({ projects: [PROJECT, { slug: 'odd', name_ar: hostile, name_en: '' }] })
    const res = makeResponse()
    await handler(request('type=page&slug=portfolio'), res)

    expect(res.body.match(/<div id="app">/g)).toHaveLength(1)
    const [list] = jsonLd(res.body)
    expect(list.itemListElement[1].name).toBe(hostile)
  })
})
