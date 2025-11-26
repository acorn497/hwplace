import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalVariableProvider } from './contexts/GlobalVariableContext.tsx'
import { SocketProvider } from './contexts/SocketContext.tsx'
import { PixelProvider } from './contexts/PixelContext.tsx'

createRoot(document.getElementById('root')!).render(
  <SocketProvider>
    <GlobalVariableProvider>
      <PixelProvider>
        <App />
      </PixelProvider>
    </GlobalVariableProvider>
  </SocketProvider>
)
