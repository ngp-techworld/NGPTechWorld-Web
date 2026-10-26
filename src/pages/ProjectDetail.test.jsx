import { fireEvent, render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LanguageProvider } from '../i18n/LanguageContext'
import { ui } from '../i18n/ui'
import { api } from '../lib/api'
import ProjectDetail from './ProjectDetail'

vi.mock('../lib/api', () => ({ api: { getProject: vi.fn() } }))

const t = ui.ar

const related = {
  id: 9, slug: 'eagle-pos', category: 'erp', client: null, year: null, status: 'completed',
  name_ar: 'نقطة بيع النسر', name_en: 'Eagle POS', short_ar: 'نظام نقاط بيع', short_en: 'Point of sale',
  cover_image: null, featured: false, industry: null, development_status: 'completed', platforms: ['windows'], technologies: [],
}

const full = {
  id: 7, slug: 'falcon-store', category: 'web', client: 'شركة الصقر', year: 2025, status: 'completed',
  name_ar: 'متجر الصقر', name_en: 'Falcon Store', short_ar: 'منصة طلبات أونلاين للمطاعم', short_en: 'Online ordering',
  description_ar: 'منصة متكاملة لاستقبال الطلبات وإدارتها.', description_en: 'A complete ordering platform.',
  cover_image: null, gallery: [], video_url: null, featured: true,
  industry: { key: 'retail', name_ar: 'التجزئة', name_en: 'Retail' },
  development_status: 'maintenance',
  business_problem_ar: 'كانت الطلبات تُستقبل عبر الهاتف وتضيع.', business_problem_en: 'Orders were taken by phone.',
  solution_ar: 'منصة طلبات أونلاين مع لوحة تحكم.', solution_en: 'An online ordering platform.',
  target_customers_ar: 'المطاعم والمقاهي', target_customers_en: 'Restaurants', target_users_ar: '', target_users_en: '',
  platforms: ['web', 'android'],
  highlights: [{ ar: 'طلب بنقرة واحدة', en: 'One-tap ordering' }],
  technical_highlights: [{ ar: 'تخزين مؤقت للقوائم', en: 'Menu caching' }],
  nonfunctional_highlights: [{ key: 'localization', title: { ar: 'دعم العربية', en: 'Arabic' }, description: { ar: 'واجهة من اليمين إلى اليسار', en: 'RTL' } }],
  public_demo_url: 'https://demo.example.com',
  modules: [{ key: 'orders', name_ar: 'الطلبات', name_en: 'Orders', description_ar: 'استقبال الطلبات ومتابعتها', description_en: 'Orders' }],
  features: [
    { key: 'checkout', module: 'orders', name_ar: 'الدفع السريع', name_en: 'Checkout', description_ar: 'إتمام الطلب بخطوة', description_en: 'One step' },
    { key: 'reports', module: null, name_ar: 'التقارير', name_en: 'Reports', description_ar: null, description_en: null },
  ],
  technologies: [
    { name: 'Laravel', slug: 'laravel', category: 'backend' },
    { name: 'React', slug: 'react', category: 'frontend' },
    { name: 'PostgreSQL', slug: 'postgresql', category: 'database' },
  ],
  screenshots: [],
  related: [related],
  team: [],
  links: [],
}

/** Everything optional left empty, the way a freshly published project arrives. */
const sparse = {
  ...full,
  client: null, year: null, industry: null, platforms: [], public_demo_url: null,
  description_ar: '', business_problem_ar: null, solution_ar: '  ', target_customers_ar: null,
  highlights: [], technical_highlights: [], nonfunctional_highlights: [],
  modules: [], features: [], technologies: [], screenshots: [], gallery: [], related: [],
}

const renderAt = (slug = 'falcon-store') =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[`/portfolio/${slug}`]}>
        <Routes>
          <Route path="/portfolio/:slug" element={<ProjectDetail />} />
          <Route path="/portfolio" element={<p>list page</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  )

const heading = (name, level = 2) => screen.queryByRole('heading', { level, name })
const sectionOf = (name) => screen.getByRole('heading', { level: 2, name }).closest('section')

beforeEach(() => {
  localStorage.clear()
  api.getProject.mockReset().mockResolvedValue(full)
})

describe('the hero', () => {
  test('names the project and lays out its facts, each linking back to a filtered portfolio', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })).toBeInTheDocument()
    expect(screen.getByText('منصة طلبات أونلاين للمطاعم')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.catLabels.web })).toHaveAttribute('href', '/portfolio?category=web')
    expect(screen.getByRole('link', { name: 'التجزئة' })).toHaveAttribute('href', '/portfolio?industry=retail')
    expect(screen.getByText(t.devStatus.maintenance)).toBeInTheDocument()
    expect(screen.getByText(t.platformLabels.android)).toBeInTheDocument()
    expect(screen.getByText(t.pfClient)).toBeInTheDocument()
    expect(screen.getByText('شركة الصقر')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  test('leaves out a missing client and year, with no empty label or separator in their place', async () => {
    api.getProject.mockResolvedValue({ ...full, client: null, year: null })
    renderAt()
    const title = await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })
    const hero = title.closest('header')

    expect(within(hero).queryByText(t.pfClient)).toBeNull()
    expect(within(hero).queryByText(t.pfYear)).toBeNull()
    expect(hero.textContent).not.toContain('·')
    expect(hero.textContent).not.toContain('null')
    // The facts that are there keep their own cells.
    expect(within(hero).getAllByRole('term').map((dt) => dt.textContent))
      .toEqual([t.pfIndustry, t.pfPlatforms, t.pfStatus, t.pfDemo])
  })
})

describe('sections', () => {
  test('shows the overview, problem and solution, features, modules, highlights and stack', async () => {
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })

    expect(within(sectionOf(t.dAbout)).getByText('منصة متكاملة لاستقبال الطلبات وإدارتها.')).toBeInTheDocument()
    expect(within(sectionOf(t.dAbout)).getByText('طلب بنقرة واحدة')).toBeInTheDocument()
    expect(within(sectionOf(t.dAbout)).getByText('المطاعم والمقاهي')).toBeInTheDocument()
    expect(heading(t.pfProblem)).toBeInTheDocument()
    expect(heading(t.pfSolution)).toBeInTheDocument()
    expect(within(sectionOf(t.pfModules)).getByText('استقبال الطلبات ومتابعتها')).toBeInTheDocument()
    expect(within(sectionOf(t.pfTechHighlights)).getByText('تخزين مؤقت للقوائم')).toBeInTheDocument()
    expect(within(sectionOf(t.pfQuality)).getByText('دعم العربية')).toBeInTheDocument()
  })

  test('groups the features under their module, and the rest under a general heading', async () => {
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })
    const features = sectionOf(t.pfFeatures)

    const orders = within(features).getByRole('heading', { level: 3, name: 'الطلبات' }).closest('.pf-group')
    expect(within(orders).getByText('الدفع السريع')).toBeInTheDocument()
    expect(within(orders).queryByText('التقارير')).toBeNull()
    const general = within(features).getByRole('heading', { level: 3, name: t.pfFeaturesOther }).closest('.pf-group')
    expect(within(general).getByText('التقارير')).toBeInTheDocument()
  })

  test('groups the technology stack by category, each technology linking to its filter', async () => {
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })
    const stack = sectionOf(t.pfStack)

    expect(within(stack).getAllByRole('term').map((dt) => dt.textContent))
      .toEqual([t.techCategories.frontend, t.techCategories.backend, t.techCategories.database])
    expect(within(stack).getByRole('link', { name: 'Laravel' })).toHaveAttribute('href', '/portfolio?tech=laravel')
  })

  test('hides every section whose content is empty', async () => {
    api.getProject.mockResolvedValue(sparse)
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })

    for (const name of [t.dAbout, t.pfProblem, t.pfSolution, t.pfFeatures, t.pfModules, t.pfTechHighlights,
      t.pfQuality, t.pfStack, t.dGallery, t.dVideo, t.dTeam, t.dLinks, t.pfDemoTitle, t.pfRelated]) {
      expect(heading(name), name).toBeNull()
    }
    expect(screen.queryByRole('link', { name: new RegExp(t.pfDemoBtn) })).toBeNull()
  })

  test('shows the problem alone when there is no solution text, and the reverse', async () => {
    api.getProject.mockResolvedValue({ ...full, solution_ar: '' })
    const { unmount } = renderAt()
    expect(await screen.findByRole('heading', { level: 2, name: t.pfProblem })).toBeInTheDocument()
    expect(heading(t.pfSolution)).toBeNull()
    unmount()

    api.getProject.mockResolvedValue({ ...full, business_problem_ar: null })
    renderAt()
    expect(await screen.findByRole('heading', { level: 2, name: t.pfSolution })).toBeInTheDocument()
    expect(heading(t.pfProblem)).toBeNull()
  })
})

describe('calls to action', () => {
  test('offers the live demo in a new tab when there is one', async () => {
    renderAt()
    const band = (await screen.findByRole('heading', { level: 2, name: t.pfDemoTitle })).closest('section')
    const demo = within(band).getByRole('link', { name: new RegExp(t.pfDemoBtn) })
    expect(demo).toHaveAttribute('href', 'https://demo.example.com/')
    expect(demo).toHaveAttribute('target', '_blank')
    expect(demo).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('lists related projects as cards linking to their own pages', async () => {
    renderAt()
    const section = (await screen.findByRole('heading', { level: 2, name: t.pfRelated })).closest('section')
    expect(within(section).getByRole('link', { name: 'نقطة بيع النسر' })).toHaveAttribute('href', '/portfolio/eagle-pos')
  })

  test('asks the visitor to get in touch about a similar project, naming this one in the link', async () => {
    renderAt()
    expect(await screen.findByRole('link', { name: t.pfContactBtn })).toHaveAttribute('href', '/contact?project=falcon-store')
  })
})

describe('loading and errors', () => {
  test('says the project does not exist on a 404, with a way back', async () => {
    api.getProject.mockRejectedValue(Object.assign(new Error('API 404'), { status: 404 }))
    renderAt('gone')
    expect(await screen.findByRole('heading', { level: 1, name: t.pfNotFound })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.navPortfolio })).toHaveAttribute('href', '/portfolio')
  })

  test('explains any other failure and tries again on request', async () => {
    api.getProject.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderAt()
    expect(await screen.findByText(t.loadError)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.pfRetry }))
    expect(await screen.findByRole('heading', { level: 1, name: 'متجر الصقر' })).toBeInTheDocument()
  })
})

describe('the screenshot gallery', () => {
  const shot = (n, platform, extra = {}) => ({
    url: `https://api.test/media/s${n}.png`, srcset: null, width: 1440, height: 900,
    title_ar: `لقطة ${n}`, title_en: `Shot ${n}`, description_ar: null, description_en: null,
    platform, language: 'ar', module: null, is_cover: false, ...extra,
  })

  test('uses the srcset variants for the thumbnails when they exist, and the plain url otherwise', async () => {
    api.getProject.mockResolvedValue({
      ...full,
      screenshots: [
        shot(1, 'desktop', { srcset: 'https://api.test/media/s1-480.webp 480w, https://api.test/media/s1-960.webp 960w' }),
        shot(2, 'desktop'),
      ],
    })
    renderAt()
    const gallery = (await screen.findByRole('heading', { level: 2, name: t.dGallery })).closest('section')
    const [first, second] = gallery.querySelectorAll('img')

    expect(first).toHaveAttribute('srcset', 'https://api.test/media/s1-480.webp 480w, https://api.test/media/s1-960.webp 960w')
    expect(first.getAttribute('sizes')).toBeTruthy()
    expect(second).toHaveAttribute('src', 'https://api.test/media/s2.png')
    expect(second).not.toHaveAttribute('srcset')
    expect(screen.queryByRole('group', { name: t.pfScreenSize })).toBeNull() // only one kind of screen
  })

  test('switches between desktop and mobile shots when the project has both', async () => {
    api.getProject.mockResolvedValue({ ...full, screenshots: [shot(1, 'desktop'), shot(2, 'mobile'), shot(3, 'mobile-web')] })
    renderAt()
    const group = await screen.findByRole('group', { name: t.pfScreenSize })
    const gallery = group.closest('section')
    const count = () => gallery.querySelector('.pf-section__count').textContent
    expect(screen.getByRole('button', { name: /لقطة 1$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /لقطة 2$/ })).toBeNull()
    expect(count()).toBe('1') // counts what the switch shows, not every screenshot

    fireEvent.click(within(group).getByRole('button', { name: t.pfMobile }))

    expect(within(group).getByRole('button', { name: t.pfMobile })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /لقطة 2$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /لقطة 3$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /لقطة 1$/ })).toBeNull()
    expect(count()).toBe('2')
  })

  test('names each thumbnail as something that opens, followed by its caption', async () => {
    api.getProject.mockResolvedValue({ ...full, screenshots: [shot(1, 'desktop'), shot(2, 'desktop', { title_ar: null })] })
    renderAt()
    expect(await screen.findByRole('button', { name: `${t.pfOpenShot(1)}: لقطة 1` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.pfOpenShot(2) })).toBeInTheDocument()
  })

  test('opens the lightbox on the screenshot clicked, captioned in the reading language', async () => {
    api.getProject.mockResolvedValue({ ...full, screenshots: [shot(1, 'desktop'), shot(2, 'desktop', { description_ar: 'تفاصيل الطلب' })] })
    renderAt()
    fireEvent.click(await screen.findByRole('button', { name: /لقطة 2$/ }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(t.pfCounter(2, 2))).toBeInTheDocument()
    expect(within(dialog).getByText('تفاصيل الطلب')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'لقطة 2' })).toBeInTheDocument()
  })

  test('falls back to the legacy gallery urls when there are no screenshots', async () => {
    api.getProject.mockResolvedValue({ ...full, screenshots: [], gallery: ['https://api.test/media/old.png'] })
    renderAt()
    const gallery = (await screen.findByRole('heading', { level: 2, name: t.dGallery })).closest('section')
    expect(gallery.querySelector('img')).toHaveAttribute('src', 'https://api.test/media/old.png')
    expect(within(gallery).getByRole('button', { name: t.pfOpenShot(1) })).toBeInTheDocument()
  })
})
