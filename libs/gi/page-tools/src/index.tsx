import { Box } from '@mui/material'
import EXPCalc from './EXPCalc'
import ResinCounter from './ResinCounter'
import TeyvatTime from './TeyvatTime'

export default function PageTools() {
  return (
    <Box display="flex" flexDirection="column" gap={1}>
      <TeyvatTime />
      <ResinCounter />
      <EXPCalc />
    </Box>
  )
}
