import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './store/AuthContext'
import { ensureFirebaseAuth } from './services/auth'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

void ensureFirebaseAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
