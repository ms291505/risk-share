import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useId, useState, type ReactNode } from 'react'

export interface ChartTable {
  columns: string[]
  rows: string[][]
}

interface ChartFrameProps {
  title: string
  /** Short text summary of what the chart shows (§13.3). */
  summary: ReactNode
  /** Accessible table view of the chart's data (§13.3). */
  table: ChartTable
  children: ReactNode
}

/**
 * Wraps every chart: a focusable figure described by its text summary, with a
 * data table toggle and an export menu (§11.4, §13.2–13.3).
 */
export function ChartFrame({ title, summary, table, children }: ChartFrameProps) {
  const id = useId()
  const [showTable, setShowTable] = useState(false)
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box
        component="figure"
        tabIndex={0}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-summary`}
        sx={{ m: 0, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 4 } }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
          <Typography id={`${id}-title`} variant="h6" component="figcaption" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
          <ExportMenu />
        </Stack>
        {children}
        <Typography id={`${id}-summary`} variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
          {summary}
        </Typography>
      </Box>
      <Button
        size="small"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
        aria-controls={`${id}-table`}
        sx={{ mt: 1 }}
      >
        {showTable ? 'Hide data table' : 'Show data table'}
      </Button>
      <Collapse in={showTable} unmountOnExit id={`${id}-table`}>
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table size="small" stickyHeader aria-label={`${title} data`}>
            <TableHead>
              <TableRow>
                {table.columns.map((c) => (
                  <TableCell key={c}>{c}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {table.rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  )
}

function ExportMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title="Export chart">
        <IconButton aria-label="Export chart" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
          <FileDownloadOutlined />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem disabled>Download PNG</MenuItem>
        <MenuItem disabled>Download SVG</MenuItem>
        <MenuItem disabled>Copy to clipboard</MenuItem>
      </Menu>
    </>
  )
}
