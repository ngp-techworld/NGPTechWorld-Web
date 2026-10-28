import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { ui } from '../../i18n/ui'
import PortfolioCard from './PortfolioCard'

const t = ui.ar

const base = {
  id: 1, slug: 'falcon-store', category: 'web', industry: { key: 'retail', name_ar: 'التجزئة', name_en: 'Retail' },
  client: null, year: null, status: 'completed', development_status: 'completed',
  name_ar: 'متجر الصقر', name_en: 'Falcon Store', short_ar: 'منصة طلبات أونلاين', short_en: 'Online ordering',
  cover_image: null, platforms: ['web', 'android'],
  technologies: [
    { name: 'Laravel', slug: 'laravel', category: 'backend' },
    { name: 'React', slug: 'react', category: 'frontend' },
    { name: 'PostgreSQL', slug: 'postgresql', category: 'database' },
    { name: 'Docker', slug: 'docker', category: 'containerization' },
    { name: 'Redis', slug: 'redis', category: 'database' },
  ],
  highlight: { ar: 'طلب بنقرة واحدة', en: 'One-tap ordering' },
  public_demo_url: null, featured: false,
}

const renderCard = (project) =>
  render(<LanguageProvider><MemoryRouter><PortfolioCard project={project} /></MemoryRouter></LanguageProvider>)

beforeEach(() => localStorage.clear())

test('names the project and links it to its detail page', () => {
  renderCard(base)
  expect(screen.getByRole('link', { name: 'متجر الصقر' })).toHaveAttribute('href', '/portfolio/falcon-store')
  expect(screen.getByText('منصة طلبات أونلاين')).toBeInTheDocument()
  expect(screen.getByText(t.catLabels.web)).toBeInTheDocument()
})

test('shows the first highlight in the reading language', () => {
  renderCard(base)
  expect(screen.getByText('طلب بنقرة واحدة')).toBeInTheDocument()
})

test('shows four technology chips at most', () => {
  renderCard(base)
  const chips = screen.getByRole('list', { name: t.pfTechnology })
  expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Laravel', 'React', 'PostgreSQL', 'Docker'])
})

test('labels each platform icon', () => {
  renderCard(base)
  expect(screen.getByRole('img', { name: t.platformLabels.web })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: t.platformLabels.android })).toBeInTheDocument()
})

test('offers no demo button when the project has no public demo', () => {
  renderCard(base)
  expect(screen.queryByRole('link', { name: new RegExp(t.pfDemo) })).toBeNull()
})

test('offers the demo in a new tab, without handing it the opener, when there is one', () => {
  renderCard({ ...base, public_demo_url: 'https://demo.example.com' })
  const demo = screen.getByRole('link', { name: new RegExp(t.pfDemo) })
  expect(demo).toHaveAttribute('href', 'https://demo.example.com/')
  expect(demo).toHaveAttribute('target', '_blank')
  expect(demo).toHaveAttribute('rel', 'noopener noreferrer')
})

test('ignores a demo link that is not http(s)', () => {
  renderCard({ ...base, public_demo_url: 'javascript:alert(1)' })
  expect(screen.queryByRole('link', { name: new RegExp(t.pfDemo) })).toBeNull()
})

test('renders a related-project item, which has no highlight or demo fields', () => {
  const { highlight, public_demo_url, ...related } = base
  renderCard({ ...related, technologies: [] })
  expect(screen.getByRole('link', { name: 'متجر الصقر' })).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: t.pfTechnology })).toBeNull()
})

test('keeps a long technology name whole in the chip title, since the chip itself may cut it short', () => {
  const long = 'Microsoft.AspNetCore.Authentication.JwtBearer'
  renderCard({ ...base, technologies: [{ name: long, slug: 'jwt-bearer', category: 'authentication' }] })
  const chip = within(screen.getByRole('list', { name: t.pfTechnology })).getByRole('listitem')
  expect(chip).toHaveTextContent(long)
  expect(chip).toHaveAttribute('title', long)
})
