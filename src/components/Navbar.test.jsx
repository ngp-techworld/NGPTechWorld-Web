import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n/LanguageContext'
import Navbar from './Navbar'

const renderNav = () => render(<LanguageProvider><MemoryRouter><Navbar /></MemoryRouter></LanguageProvider>)
const menu = (container) => container.querySelector('[data-mobilemenu]')

beforeEach(() => localStorage.clear())

describe('the mobile menu', () => {
  test('Escape closes it and puts focus back on the menu button (QA X3)', () => {
    const { container } = renderNav()
    const burger = screen.getByRole('button', { name: 'Menu' })
    burger.focus()
    fireEvent.click(burger)
    expect(menu(container)).not.toBeNull()
    expect(burger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document.activeElement, { key: 'Escape' })

    expect(menu(container)).toBeNull()
    expect(burger).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(burger)
  })

  test('Escape from a link inside the open menu closes it too', () => {
    const { container } = renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const link = menu(container).querySelector('a')
    link.focus()

    fireEvent.keyDown(link, { key: 'Escape' })

    expect(menu(container)).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menu' }))
  })

  test('Escape does nothing while the menu is closed', () => {
    renderNav()
    const other = screen.getAllByRole('link')[0]
    other.focus()
    fireEvent.keyDown(other, { key: 'Escape' })
    expect(document.activeElement).toBe(other)
  })
})
