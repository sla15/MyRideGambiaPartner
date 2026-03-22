import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppNotification, ChatSession, ChatMessage } from '../types';
import { AlertModal } from '../components/AlertModal';
import { useAuth } from './AuthContext';
import { Keyboard } from '@capacitor/keyboard';
interface WalkthroughStep {
    id: string;
    targetId: string;
    title: string;
    content: string;
    action?: () => void;
    nextTab?: string;
}

interface UIContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
    currentTab: string;
    setCurrentTab: (tab: string) => void;
    notifications: AppNotification[];
    pushNotification: (title: string, body: string, type: AppNotification['type']) => void;
    removeNotification: (id: string) => void;
    activeChat: ChatSession | null;
    openChat: (session: ChatSession) => void;
    closeChat: () => void;
    chatMessages: Record<string, ChatMessage[]>;
    sendMessage: (sessionId: string, text: string) => void;
    showAlert: (title: string, message: string, onConfirm?: () => void, confirmText?: string, cancelText?: string, onCancel?: () => void) => void;
    
    // Walkthrough
    isWalkthroughOpen: boolean;
    walkthroughSteps: WalkthroughStep[];
    currentWalkthroughIndex: number;
    startWalkthrough: (steps: WalkthroughStep[]) => void;
    nextWalkthroughStep: () => void;
    skipWalkthrough: () => void;

    // Keyboard
    keyboardHeight: number;

}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const hasThemePreference = window.matchMedia('(prefers-color-scheme: dark)').matches ||
            window.matchMedia('(prefers-color-scheme: light)').matches;

        // Default to dark if no clear preference or if it matches dark
        if (!hasThemePreference) return true;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const [currentTab, setCurrentTab] = useState('home');
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
    const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm?: () => void; confirmText?: string; cancelText?: string; onCancel?: () => void }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: undefined,
        onCancel: undefined
    });

    // Walkthrough state
    const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
    const [walkthroughSteps, setWalkthroughSteps] = useState<WalkthroughStep[]>([]);
    const [currentWalkthroughIndex, setCurrentWalkthroughIndex] = useState(0);

    // Keyboard state
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const { user } = useAuth();

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            setChatMessages({});
            setActiveChat(null);
            setIsWalkthroughOpen(false);
        }
    }, [user]);

    useEffect(() => {
        // Sync dark mode class with state
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    useEffect(() => {
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

        // Use addEventListener for modern browsers/Capacitor
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        let showListener: any;
        let hideListener: any;

        const setupListeners = async () => {
            showListener = await Keyboard.addListener('keyboardWillShow', info => {
                setKeyboardHeight(info.keyboardHeight);
            });
            hideListener = await Keyboard.addListener('keyboardWillHide', () => {
                setKeyboardHeight(0);
            });
        };

        setupListeners();

        return () => {
            if (showListener) showListener.remove();
            if (hideListener) hideListener.remove();
        };
    }, []);


    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    const pushNotification = (title: string, body: string, type: AppNotification['type']) => {
        const newNotification: AppNotification = { id: Math.random().toString(36).substr(2, 9), title, body, type, timestamp: Date.now() };
        setNotifications(prev => [newNotification, ...prev]);
        setTimeout(() => removeNotification(newNotification.id), 5000);
    };

    const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
    const openChat = (session: ChatSession) => setActiveChat(session);
    const closeChat = () => setActiveChat(null);

    const sendMessage = (sessionId: string, text: string) => {
        const newMessage: ChatMessage = { id: Math.random().toString(36).substr(2, 9), text, sender: 'ME', timestamp: new Date() };
        setChatMessages(prev => ({ ...prev, [sessionId]: [...(prev[sessionId] || []), newMessage] }));
    };

    const showAlert = (title: string, message: string, onConfirm?: () => void, confirmText?: string, cancelText?: string, onCancel?: () => void) => {
        setAlertModal({ isOpen: true, title, message, onConfirm, confirmText, cancelText, onCancel });
    };

    // Walkthrough functions
    const startWalkthrough = (steps: WalkthroughStep[]) => {
        setWalkthroughSteps(steps);
        setCurrentWalkthroughIndex(0);
        setIsWalkthroughOpen(true);
        
        // Prep UI for first step
        if (steps[0]) {
            if (steps[0].action) steps[0].action();
            if (steps[0].nextTab) setCurrentTab(steps[0].nextTab);
        }
    };

    const nextWalkthroughStep = () => {
        if (currentWalkthroughIndex < walkthroughSteps.length - 1) {
            const nextIndex = currentWalkthroughIndex + 1;
            const nextStep = walkthroughSteps[nextIndex];
            
            // Execute preparation for NEXT step before switching index
            if (nextStep.action) nextStep.action();
            if (nextStep.nextTab) setCurrentTab(nextStep.nextTab);
            
            setCurrentWalkthroughIndex(nextIndex);
        } else {
            setIsWalkthroughOpen(false);
        }
    };

    const skipWalkthrough = () => {
        setIsWalkthroughOpen(false);
    };

    return (
        <UIContext.Provider value={{
            isDarkMode, toggleTheme, currentTab, setCurrentTab, notifications,
            pushNotification, removeNotification, activeChat, openChat, closeChat,
            chatMessages, sendMessage, showAlert,
            isWalkthroughOpen, walkthroughSteps, currentWalkthroughIndex,
            startWalkthrough, nextWalkthroughStep, skipWalkthrough,
            keyboardHeight
        }}>
            {children}
            <AlertModal
                isOpen={alertModal.isOpen}
                title={alertModal.title}
                message={alertModal.message}
                onConfirm={alertModal.onConfirm}
                confirmText={alertModal.confirmText}
                cancelText={alertModal.cancelText}
                onCancel={alertModal.onCancel}
                onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                isDarkMode={isDarkMode}
            />
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (context === undefined) throw new Error('useUI must be used within a UIProvider');
    return context;
};
