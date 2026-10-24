import React, { createContext, useContext, useEffect, useState } from 'react';

import { getProfile, getUser } from '@/lib/electronMainSdk';
import { Profile } from '@first2apply/core';
import { User } from '@supabase/supabase-js';

import { useError } from './error';

// Create a context for the session manager
const SessionContext = createContext<{
  isLoading: boolean;
  user: User | null;
  profile: Profile | null;
  isLoggedIn: boolean;
  login: (user: User) => Promise<void>;
  logout: () => void;
  refreshProfile: () => void;
}>({
  isLoading: true,
  user: null,
  profile: null,
  isLoggedIn: false,
  login: async (user: User) => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

/**
 * Global hook used to access the session manager.
 */
export const useSession = () => {
  const sessionManager = useContext(SessionContext);
  if (sessionManager === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return sessionManager;
};

// Create a provider for the session
export const SessionProvider = ({ children }: React.PropsWithChildren) => {
  const { handleError } = useError();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Load the user on mount
  useEffect(() => {
    const asyncLoad = async () => {
      try {
        const currentUser = await getUser();
        await loadProfile(currentUser);
        setUser(currentUser);
        setIsLoading(false);
      } catch (error) {
        handleError({ error, title: 'Failed to load profile' });
      }
    };

    asyncLoad();
  }, []);

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setProfile(null);
      return;
    }

    const userProfile = await getProfile();
    setProfile(userProfile);
  };

  /**
   * Handle user logout.
   */
  const handleLogout = async () => {
    try {
      setUser(null);
      await loadProfile(null);
    } catch (error) {
      handleError({ error });
    }
  };

  /**
   * Refresh the user profile.
   */
  const refreshProfile = async () => {
    try {
      await loadProfile(user);
    } catch (error) {
      handleError({ error, title: 'Failed to load profile' });
    }
  };

  /**
   * Handle user login.
   */
  const handleLogin = async (user: User) => {
    try {
      await loadProfile(user);
      setUser(user);
    } catch (error) {
      handleError({ error });
    }
  };

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        user,
        profile,
        isLoggedIn: !!user,
        logout: handleLogout,
        login: handleLogin,
        refreshProfile,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
