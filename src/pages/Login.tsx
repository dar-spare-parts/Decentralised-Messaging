import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, Loader2, Anchor, Mail, Clock, CheckCircle, AlertTriangle, UserPlus, LogIn, ArrowLeft, CreditCard, FileText, Globe, User, Calendar, Hash, Phone } from 'lucide-react';
import { BrowserProvider } from 'ethers';
import { supabase } from '../lib/supabase';

interface IDVerificationData {
  panNumber: string;
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
}

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'connect' | 'options' | 'id-selection' | 'pan-verification' | 'creating' | 'success'>('connect');
  const [authMode, setAuthMode] = useState<'signup' | 'login' | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [idVerificationData, setIdVerificationData] = useState<IDVerificationData>({
    panNumber: '',
    fullName: '',
    dateOfBirth: '',
    phoneNumber: '',
    email: ''
  });
  const navigate = useNavigate();

  const createOrUpdateProfile = async (address: string, verificationData?: IDVerificationData) => {
    try {
      console.log('Creating/updating profile for address:', address);
      
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('address')
        .eq('address', address.toLowerCase())
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', fetchError);
        throw fetchError;
      }

      const profileData = {
        address: address.toLowerCase(),
        username: verificationData?.fullName || `User_${address.slice(2, 8)}`,
        bio: 'New Kraken user',
        avatar_url: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (!existingProfile) {
        // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(profileData);

        if (insertError) {
          console.error('Error creating profile:', insertError);
          throw insertError;
        }
        
        console.log('Profile created successfully for:', address);
      } else {
        console.log('Profile already exists for:', address);
      }

      // Store ID verification data if provided
      if (verificationData && authMode === 'signup') {
        await storeIdVerificationData(address, verificationData);
      }
    } catch (error) {
      console.error('Error in createOrUpdateProfile:', error);
      throw error;
    }
  };

  const storeIdVerificationData = async (address: string, verificationData: IDVerificationData) => {
    try {
      // Create a comprehensive verification record
      const verificationRecord = {
        walletAddress: address,
        idType: 'PAN',
        panNumber: verificationData.panNumber,
        fullName: verificationData.fullName,
        dateOfBirth: verificationData.dateOfBirth,
        phoneNumber: verificationData.phoneNumber,
        email: verificationData.email,
        verificationStatus: 'pending',
        submittedAt: new Date().toISOString(),
        verifiedAt: null,
        verifiedBy: null,
        notes: ''
      };

      console.log('Storing comprehensive ID verification data for manual verification:', verificationRecord);
      
      // In a real implementation, you would:
      // 1. Encrypt the sensitive data (PAN number, DOB, phone, email)
      // 2. Store in a secure table with proper access controls
      // 3. Trigger a manual verification workflow
      // 4. Send SMS/Email confirmation to provided contact details
      // 5. Create audit trail for compliance
      // 6. Set up automated reminders for verification team
      
      // For demonstration, storing in localStorage with encryption simulation
      localStorage.setItem(`id_verification_${address}`, JSON.stringify(verificationRecord));
      
      // Simulate sending confirmation messages
      console.log(`Verification confirmation would be sent to:`);
      console.log(`- Phone: ${verificationData.phoneNumber}`);
      console.log(`- Email: ${verificationData.email}`);
      
    } catch (error) {
      console.error('Error storing ID verification data:', error);
      throw error;
    }
  };

  const authenticateWithSupabase = async (address: string, mode: 'signup' | 'login'): Promise<boolean> => {
    try {
      console.log(`Authenticating with Supabase for address: ${address}, mode: ${mode}`);
      
      // Create a deterministic email and password from the wallet address
      const email = `${address.toLowerCase()}@kraken.web3`;
      const password = `kraken_${address.toLowerCase()}_secure_2025`;

      // First, try to sign out any existing session
      await supabase.auth.signOut();

      if (mode === 'signup') {
        console.log('Attempting to sign up new user...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              wallet_address: address.toLowerCase(),
              user_type: 'wallet'
            }
          }
        });

        if (signUpError) {
          if (signUpError.message?.includes('User already registered')) {
            throw new Error('This wallet address is already registered. Please use the Login option instead.');
          }
          throw signUpError;
        }

        if (!signUpData?.session) {
          throw new Error('Sign up failed - no session created');
        }

        console.log('Successfully signed up new user');
        return true;
      } else {
        console.log('Attempting to sign in existing user...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message?.includes('Invalid login credentials')) {
            throw new Error('This wallet address is not registered. Please use the Sign Up option instead.');
          }
          throw signInError;
        }

        if (!signInData?.session) {
          throw new Error('Sign in failed - no session created');
        }

        console.log('Successfully signed in existing user');
        return true;
      }
    } catch (error) {
      console.error('Supabase authentication error:', error);
      throw error;
    }
  };

  const connectMetamask = async () => {
    setError('');
    setLoading(true);

    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      console.log('Requesting MetaMask account access...');
      
      // Request account access
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please make sure MetaMask is unlocked and has at least one account.');
      }

      const address = accounts[0];
      console.log('Connected to MetaMask with address:', address);
      setWalletAddress(address);

      // Show options for sign up or login
      setStep('options');
      setLoading(false);

    } catch (err: any) {
      console.error('MetaMask connection error:', err);
      
      // Handle specific MetaMask errors
      if (err.code === 4001) {
        setError('Connection rejected. Please approve the connection request in MetaMask.');
      } else if (err.code === -32002) {
        setError('Connection request pending. Please check MetaMask and approve the pending request.');
      } else if (err.message?.includes('MetaMask is not installed')) {
        setError('MetaMask is not installed. Please install MetaMask browser extension to continue.');
      } else {
        setError(err.message || 'Failed to connect to MetaMask. Please try again.');
      }
      
      setStep('connect');
      setLoading(false);
    }
  };

  const handleAuthChoice = async (mode: 'signup' | 'login') => {
    setAuthMode(mode);
    setError('');
    
    if (mode === 'signup') {
      // For signup, go to ID selection
      setStep('id-selection');
    } else {
      // For login, proceed directly to authentication
      await proceedWithAuthentication(mode);
    }
  };

  const handleIdSelection = (idType: string) => {
    if (idType === 'pan') {
      setStep('pan-verification');
    } else {
      // For passport and other, show coming soon message
      setError('This verification method is coming soon. Please use PAN Card for now.');
    }
  };

  const validatePanNumber = (pan: string): boolean => {
    // PAN format: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  const validateDateOfBirth = (dob: string): boolean => {
    const date = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    return age >= 18 && age <= 100; // Reasonable age range
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // Indian phone number format: 10 digits starting with 6-9
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handlePanVerification = async () => {
    // Validate inputs
    if (!idVerificationData.panNumber || !idVerificationData.fullName || !idVerificationData.dateOfBirth || !idVerificationData.phoneNumber || !idVerificationData.email) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!validatePanNumber(idVerificationData.panNumber)) {
      setError('Please enter a valid PAN number (e.g., ABCDE1234F).');
      return;
    }

    if (!validateDateOfBirth(idVerificationData.dateOfBirth)) {
      setError('Please enter a valid date of birth. You must be at least 18 years old.');
      return;
    }

    if (idVerificationData.fullName.trim().length < 2) {
      setError('Please enter your full name as it appears on your PAN card.');
      return;
    }

    if (!validatePhoneNumber(idVerificationData.phoneNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!validateEmail(idVerificationData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Proceed with authentication including ID verification
    await proceedWithAuthentication('signup');
  };

  const proceedWithAuthentication = async (mode: 'signup' | 'login') => {
    setLoading(true);
    setStep('creating');
    setError('');

    try {
      if (!walletAddress) {
        throw new Error('No wallet connected. Please connect your wallet first.');
      }

      // Clear any existing authentication data
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('isAuthenticated');

      // Authenticate with Supabase
      const authSuccess = await authenticateWithSupabase(walletAddress, mode);
      
      if (!authSuccess) {
        throw new Error('Authentication failed');
      }
      
      // Create or update profile (with ID verification data for signup)
      await createOrUpdateProfile(
        walletAddress, 
        mode === 'signup' ? idVerificationData : undefined
      );

      // Store wallet address and authentication status
      localStorage.setItem('walletAddress', walletAddress.toLowerCase());
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('Authentication and profile setup successful');
      
      // Show success state briefly
      setStep('success');
      
      // Navigate to the main app after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (err: any) {
      console.error('Authentication error:', err);
      
      // Clear any partial authentication data
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('isAuthenticated');
      
      setError(err.message || 'Authentication failed. Please try again.');
      setStep(mode === 'signup' ? 'pan-verification' : 'options');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    switch (step) {
      case 'options':
        setStep('connect');
        setAuthMode(null);
        break;
      case 'id-selection':
        setStep('options');
        break;
      case 'pan-verification':
        setStep('id-selection');
        break;
      default:
        setStep('connect');
        setAuthMode(null);
    }
    setError('');
  };

  const getButtonContent = () => {
    switch (step) {
      case 'connect':
        return loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <WalletIcon className="w-5 h-5" />
            <span>Connect with MetaMask</span>
          </>
        );
      case 'creating':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{authMode === 'signup' ? 'Creating your account...' : 'Signing you in...'}</span>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="w-5 h-5" />
            <span>Connected successfully!</span>
          </>
        );
      default:
        return null;
    }
  };

  const getButtonColor = () => {
    switch (step) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Anchor className="w-12 h-12 text-zinc-100" />
            </div>
            <h1 className="text-5xl font-bold text-zinc-100 mb-2">Kraken</h1>
            <p className="text-zinc-400 mb-2">Secure Decentralized Messaging</p>
            <p className="text-sm text-zinc-500">Web3-Powered Communication</p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-500 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {step === 'connect' && (
              <>
                <button
                  onClick={connectMetamask}
                  disabled={loading}
                  className={`w-full text-white py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2 ${getButtonColor()}`}
                >
                  {getButtonContent()}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
                  </div>
                </div>

                <button
                  disabled
                  className="w-full bg-zinc-800/50 text-zinc-500 py-3 px-4 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2 group relative"
                >
                  <Mail className="w-5 h-5" />
                  <span>Email Login</span>
                  <Clock className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Coming Soon
                  </span>
                </button>
              </>
            )}

            {step === 'options' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">Choose an Option</h2>
                  <p className="text-sm text-zinc-400">
                    Are you a new user or do you already have an account?
                  </p>
                </div>

                <button
                  onClick={() => handleAuthChoice('signup')}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Sign Up (New User)</span>
                </button>

                <button
                  onClick={() => handleAuthChoice('login')}
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Login (Existing User)</span>
                </button>

                <button
                  onClick={goBack}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              </div>
            )}

            {step === 'id-selection' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">Select Government ID</h2>
                  <p className="text-sm text-zinc-400">
                    Choose your government-issued ID for verification
                  </p>
                </div>

                <button
                  onClick={() => handleIdSelection('pan')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 px-4 rounded-lg transition-all transform hover:scale-105 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-6 h-6" />
                    <div className="text-left">
                      <div className="font-medium">PAN Card</div>
                      <div className="text-sm text-blue-200">Permanent Account Number (India)</div>
                    </div>
                  </div>
                  <div className="text-green-400 text-sm font-medium">Available</div>
                </button>

                <button
                  onClick={() => handleIdSelection('passport')}
                  disabled
                  className="w-full bg-zinc-800/50 text-zinc-400 py-4 px-4 rounded-lg cursor-not-allowed flex items-center justify-between group relative"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-6 h-6" />
                    <div className="text-left">
                      <div className="font-medium">Passport</div>
                      <div className="text-sm text-zinc-500">International Travel Document</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Coming Soon</span>
                  </div>
                </button>

                <button
                  onClick={() => handleIdSelection('other')}
                  disabled
                  className="w-full bg-zinc-800/50 text-zinc-400 py-4 px-4 rounded-lg cursor-not-allowed flex items-center justify-between group relative"
                >
                  <div className="flex items-center space-x-3">
                    <Globe className="w-6 h-6" />
                    <div className="text-left">
                      <div className="font-medium">Other IDs</div>
                      <div className="text-sm text-zinc-500">Driver's License, National ID, etc.</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Coming Soon</span>
                  </div>
                </button>

                <button
                  onClick={goBack}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              </div>
            )}

            {step === 'pan-verification' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <CreditCard className="w-8 h-8 text-blue-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-2">PAN Card Verification</h2>
                  <p className="text-sm text-zinc-400">
                    Enter your PAN card details and contact information
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      <Hash className="w-4 h-4 inline mr-2" />
                      PAN Number *
                    </label>
                    <input
                      type="text"
                      value={idVerificationData.panNumber}
                      onChange={(e) => setIdVerificationData(prev => ({
                        ...prev,
                        panNumber: e.target.value.toUpperCase()
                      }))}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Format: 5 letters + 4 digits + 1 letter</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      <User className="w-4 h-4 inline mr-2" />
                      Full Name (as on PAN Card) *
                    </label>
                    <input
                      type="text"
                      value={idVerificationData.fullName}
                      onChange={(e) => setIdVerificationData(prev => ({
                        ...prev,
                        fullName: e.target.value
                      }))}
                      placeholder="Enter your full name"
                      className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={idVerificationData.dateOfBirth}
                      onChange={(e) => setIdVerificationData(prev => ({
                        ...prev,
                        dateOfBirth: e.target.value
                      }))}
                      className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      <Phone className="w-4 h-4 inline mr-2" />
                      Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={idVerificationData.phoneNumber}
                      onChange={(e) => setIdVerificationData(prev => ({
                        ...prev,
                        phoneNumber: e.target.value.replace(/\D/g, '')
                      }))}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-zinc-500 mt-1">10-digit Indian mobile number</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={idVerificationData.email}
                      onChange={(e) => setIdVerificationData(prev => ({
                        ...prev,
                        email: e.target.value.toLowerCase()
                      }))}
                      placeholder="your.email@example.com"
                      className="w-full bg-zinc-800 rounded-lg py-3 px-4 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-zinc-500 mt-1">We'll send verification updates to this email</p>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-200">
                      <p className="font-medium mb-1">Verification Notice</p>
                      <p>Your PAN card details and contact information will be stored securely and verified manually by our team. You'll receive confirmation via SMS and email once verification is complete.</p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handlePanVerification}
                    disabled={loading}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Verify & Continue</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={goBack}
                    disabled={loading}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {(step === 'creating' || step === 'success') && (
              <button
                disabled
                className={`w-full text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 ${getButtonColor()}`}
              >
                {getButtonContent()}
              </button>
            )}
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-500">
              By connecting, you agree to our Terms of Service and Privacy Policy
            </p>
            <div className="flex justify-center space-x-4">
              <a href="#" className="text-zinc-400 hover:text-zinc-100 text-sm">Terms of Service</a>
              <a href="#" className="text-zinc-400 hover:text-zinc-100 text-sm">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center space-y-2">
          <p className="text-sm text-zinc-400">Created by Za.i.14</p>
          <p className="text-xs text-zinc-600">© 2025 Kraken. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}