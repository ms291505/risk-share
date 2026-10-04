import Link from '@mui/material/Link'
import { Link as RouterLink } from 'react-router'
import { Page } from './Page'

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <Link component={RouterLink} to="/">
        Go to the start page
      </Link>
    </Page>
  )
}
