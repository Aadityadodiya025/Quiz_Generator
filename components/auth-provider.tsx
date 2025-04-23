"use client"

import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { LoginModal } from '@/components/login-modal';

// Types
type AuthContextType = {
  isAuthenticated: boolean;
  loading: boolean;
  requireAuth: (callback?: () => void) => void;
  data?: {
    user?: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
    }
  };
  status: "loading" | "authenticated" | "unauthenticated";
  update: (data: any) => Promise<any>;
};

// Create context
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  loading: true,
  requireAuth: () => {},
  status: "loading",
  update: async () => {}
});

// Auth Provider Wrapper
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthStateProvider>{children}</AuthStateProvider>
    </SessionProvider>
  );
}

// Inner provider that accesses session
function AuthStateProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is authenticated
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  // Paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup'];

  useEffect(() => {
    // Once the session status is determined, update loading state
    if (status !== 'loading') {
      setLoading(false);
    }
  }, [status]);

  // Function to require authentication
  const requireAuth = (callback?: () => void) => {
    if (isAuthenticated) {
      // User is authenticated, proceed with callback if provided
      if (callback) callback();
      return;
    }

    // If not authenticated, show login modal
    setShowLoginModal(true);
  };

  // Context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    loading,
    requireAuth,
    data: session,
    status,
    update: async (data) => {
      // We would normally update the session here
      // This is a simplified placeholder
      console.log('Session update requested:', data);
      return Promise.resolve(data);
    }
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      
      {/* Login modal for auth prompts */}
      {showLoginModal && (
        <LoginModal 
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          redirectPath={pathname}
        />
      )}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);
