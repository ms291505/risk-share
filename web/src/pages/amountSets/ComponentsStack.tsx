import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import type { ComponentsLayoutProps } from './ComponentsEditor'
import { GROUP_LABELS } from './labels'
import { TermRow } from './TermRow'

/** Components one block each, for widths where the table's columns don't fit: phones and narrow windows. */
export function ComponentsStack({ groupKey, paidBy, rows, addButton, totals }: ComponentsLayoutProps) {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Stack
        component="ul"
        aria-label={`${GROUP_LABELS[groupKey]} components`}
        spacing={2}
        sx={{ listStyle: 'none', p: 0, m: 0, width: '100%' }}
      >
        {rows.map((row) => (
          <Stack
            key={row.id}
            component="li"
            spacing={2}
            sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
          >
            {row.name}
            {row.amount}
            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              {row.paid && (
                <FormControlLabel control={row.paid} label={paidBy} sx={{ mr: 'auto', overflowWrap: 'anywhere' }} />
              )}
              <Box sx={{ ml: 'auto' }}>{row.remove}</Box>
            </Stack>
          </Stack>
        ))}
      </Stack>
      {addButton}
      <Stack component="dl" spacing={1} sx={{ m: 0, width: '100%' }}>
        {totals.map(({ term, value }) => (
          <TermRow key={term} term={term}>
            {value}
          </TermRow>
        ))}
      </Stack>
    </Stack>
  )
}
