import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Messages } from './pages/Messages';
import { Wallet } from './pages/Wallet';
import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { supabase } from './lib/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  walletAddress: null,
  logout: () => {},
});

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        
        // Check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        const storedAddress = localStorage.getItem('walletAddress');
        const storedAuth = localStorage.getItem('isAuthenticated');
        
        console.log('Auth check results:', { 
          hasSession: !!session, 
          storedAddress, 
          storedAuth,
          sessionUser: session?.user?.id 
        });
        
        if (session && storedAuth === 'true' && storedAddress) {
          // Valid session and stored credentials
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          console.log('User authenticated with session and stored address:', storedAddress);
        } else if (storedAuth === 'true' && storedAddress) {
          // Has stored auth but no session - try to restore
          console.log('Has stored auth but no session, attempting to restore...');
          
          // Try to authenticate with stored address
          const email = `${storedAddress}@kraken.web3`;
          const password = `kraken_${storedAddress}_secure_2025`;
          
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (!signInError && data.session) {
            setIsAuthenticated(true);
            setWalletAddress(storedAddress);
            console.log('Successfully restored session for:', storedAddress);
          } else {
            console.log('Failed to restore session, clearing stored auth');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('walletAddress');
            setIsAuthenticated(false);
            setWalletAddress(null);
          }
        } else {
          // No valid authentication
          console.log('No valid authentication found');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('walletAddress');
          setIsAuthenticated(false);
          setWalletAddress(null);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('walletAddress');
        setIsAuthenticated(false);
        setWalletAddress(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_IN' && session) {
        const storedAddress = localStorage.getItem('walletAddress');
        if (storedAddress) {
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          console.log('Auth state: signed in with address:', storedAddress);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('Auth state: signed out');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('walletAddress');
        setIsAuthenticated(false);
        setWalletAddress(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    console.log('Logging out user');
    
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out from Supabase:', error);
    }
    
    // Clear local storage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('walletAddress');
    
    // Update state
    setIsAuthenticated(false);
    setWalletAddress(null);
  };

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, walletAddress, logout }}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Home />} />
            <Route path="messages" element={<Messages />} />
            <Route path="search" element={<Search />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App