import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PixelProvider } from './contexts/Pixel.context.tsx'
import { SocketProvider } from './contexts/Socket.context.tsx'
import { GlobalVariableProvider } from './contexts/GlobalVariable.context.tsx'
import { CanvasProvider } from './contexts/Canvas.context.tsx'

createRoot(document.getElementById('root')!).render(
    <GlobalVariableProvider>
        <SocketProvider>
            <CanvasProvider>
                <PixelProvider>
                    <App />
                </PixelProvider>
            </CanvasProvider>
        </SocketProvider>
    </GlobalVariableProvider>
)
