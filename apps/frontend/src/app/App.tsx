import {
  DBLocalStorage,
  SandboxStorage,
} from '@genshin-optimizer/common/database'
import { ScrollTop, useTitle } from '@genshin-optimizer/common/ui'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import '@genshin-optimizer/gi/i18n' // import to load translations
import { theme } from '@genshin-optimizer/gi/theme'
import { SillyContext, SnowContext, useSilly, useSnow } from '@genshin-optimizer/gi/ui'
import {
  Box,
  Container,
  CssBaseline,
  Skeleton,
  StyledEngineProvider,
  ThemeProvider,
} from '@mui/material'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './App.scss'
import ErrorBoundary from './ErrorBoundary'
import Footer from './Footer'
import Header from './Header'
import Snow from './Snow'

const loadPageHome = () => import('@genshin-optimizer/gi/page-home')
const loadPageArtifacts = () => import('@genshin-optimizer/gi/page-artifacts')
const loadPageSettings = () => import('@genshin-optimizer/gi/page-settings')
const loadPageWeapons = () => import('@genshin-optimizer/gi/page-weapons')
const loadPageArchive = () => import('@genshin-optimizer/gi/page-archive')
const loadPageDocumentation = () => import('@genshin-optimizer/gi/page-doc')
const loadPageCharacters = () => import('@genshin-optimizer/gi/page-characters')
const loadPageTeams = () => import('@genshin-optimizer/gi/page-teams')
const loadPageTeam = () => import('@genshin-optimizer/gi/page-team')
const loadPageTools = () => import('./Tools')

const PageHome = lazy(loadPageHome)
const PageArtifacts = lazy(loadPageArtifacts)
const PageSettings = lazy(loadPageSettings)
const PageWeapons = lazy(loadPageWeapons)
const PageArchive = lazy(loadPageArchive)
const PageDocumentation = lazy(loadPageDocumentation)
const PageCharacters = lazy(loadPageCharacters)
const PageTeams = lazy(loadPageTeams)
const PageTeam = lazy(loadPageTeam)
const PageTools = lazy(loadPageTools)

function App() {
  const dbIndex = parseInt(localStorage.getItem('dbIndex') || '1')
  const [databases, setDatabases] = useState(() => {
    return ([1, 2, 3, 4] as const).map((index) => {
      if (index === dbIndex) {
        return new ArtCharDatabase(index, new DBLocalStorage(localStorage))
      } else {
        const dbName = `extraDatabase_${index}`
        const eDB = localStorage.getItem(dbName)
        const dbObj = eDB ? JSON.parse(eDB) : {}
        const db = new ArtCharDatabase(index, new SandboxStorage(dbObj))
        db.toExtraLocalDB()
        return db
      }
    })
  })
  const setDatabase = useCallback(
    (index: number, db: ArtCharDatabase) => {
      const dbs = [...databases]
      dbs[index] = db
      setDatabases(dbs)
    },
    [databases, setDatabases]
  )

  const database = databases[dbIndex - 1]
  const dbContextObj = useMemo(
    () => ({ databases, setDatabases, database, setDatabase }),
    [databases, setDatabases, database, setDatabase]
  )
  const SillyContextObj = useSilly()
  const SnowContextObj = useSnow()
  return (
    <StyledEngineProvider injectFirst>
      {/* https://mui.com/guides/interoperability/#css-injection-order-2 */}
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <SillyContext.Provider value={SillyContextObj}>
          <SnowContext.Provider value={SnowContextObj}>
            <DatabaseContext.Provider value={dbContextObj}>
              <ErrorBoundary>
                <HashRouter basename="/">
                  <Content />
                  <ScrollTop />
                </HashRouter>
              </ErrorBoundary>
            </DatabaseContext.Provider>
          </SnowContext.Provider>
        </SillyContext.Provider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}
function Content() {
  useTitle()

  useEffect(() => {
    const preloadRoutes = () => {
      void loadPageArtifacts()
      void loadPageWeapons()
      void loadPageCharacters()
      void loadPageTeams()
      void loadPageArchive()
      void loadPageSettings()
    }

    if (typeof window === 'undefined') return
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadRoutes, { timeout: 1500 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timeout = window.setTimeout(preloadRoutes, 800)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      position="relative"
      sx={(theme) => ({
        background: `radial-gradient(ellipse at top, ${theme.palette.neutral700.main} 0%, ${theme.palette.neutral800.main} 100%)`,
      })}
    >
      <Header anchor="back-to-top-anchor" />
      <Container
        maxWidth="xl"
        sx={{ px: { xs: 0.5, sm: 1 }, flexGrow: 1, mx: 'auto', width: '100%' }}
      >
        <Suspense
          fallback={
            <Skeleton
              variant="rectangular"
              sx={{ width: '100%', height: 1000 }}
            />
          }
        >
          <Routes>
            <Route index element={<PageHome />} />
            <Route path="/artifacts" element={<PageArtifacts />} />
            <Route path="/weapons" element={<PageWeapons />} />
            <Route path="/characters/*" element={<PageCharacters />} />
            <Route path="/teams/*">
              <Route index element={<PageTeams />} />
              <Route path=":teamId/*" element={<PageTeam />} />
            </Route>
            <Route path="/archive/*" element={<PageArchive />} />
            <Route path="/setting" element={<PageSettings />} />
            <Route path="/tools/:toolId?" element={<PageTools />} />
            <Route path="/doc/*" element={<PageDocumentation />} />
          </Routes>
        </Suspense>
      </Container>

      {/* make sure footer is always at bottom */}
      <Box flexGrow={1} />
      <Snow />
      <Footer />
    </Box>
  )
}
export default App
