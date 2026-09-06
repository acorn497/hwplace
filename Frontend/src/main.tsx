import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PixelProvider } from './contexts/Pixel.context.tsx'
import { SocketProvider } from './contexts/Socket.context.tsx'
import { GlobalVariableProvider } from './contexts/GlobalVariable.context.tsx'
import { CanvasProvider } from './contexts/Canvas.context.tsx'
import { AuthProvider } from './contexts/Auth.context.tsx'
import { NotificationProvider } from './contexts/Notification.context.tsx'
import { ChatProvider } from './contexts/Chat.context.tsx'
import { ThemeProvider } from './contexts/Theme.context.tsx'

createRoot(document.getElementById('root')!).render(
    <ThemeProvider>
        <NotificationProvider>
            <GlobalVariableProvider>
                <SocketProvider>
                    <AuthProvider>
                        <ChatProvider>
                            <CanvasProvider>
                                <PixelProvider>
                                    <App />
                                </PixelProvider>
                            </CanvasProvider>
                        </ChatProvider>
                    </AuthProvider>
                </SocketProvider>
            </GlobalVariableProvider>
        </NotificationProvider>
    </ThemeProvider>
)
