import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GlobalVariableProvider } from './contexts/GlobalVariable.context.tsx'
import { SocketProvider } from './contexts/Socket.context.tsx'
import { PixelProvider } from './contexts/Pixel.context.tsx'

createRoot(document.getElementById('root')!).render(
  <SocketProvider>
    <GlobalVariableProvider>
      <PixelProvider>
        <App />
      </PixelProvider>
    </GlobalVariableProvider>
  </SocketProvider>
)
