import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, SignIn, SignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import App from '../app';
import './secure-auth.css';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}
const clerkAppearance = {
  theme: shadcn,
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: { colorPrimary: '#6C4F6E', colorForeground: '#211B2B', colorMutedForeground: '#696576',
    colorBackground: '#F4F1F3', colorInput: '#FFFFFF', colorInputForeground: '#211B2B',
    colorDanger: '#B42318', colorNeutral: '#3A324A', fontFamily: 'Arial, sans-serif', borderRadius: '12px' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#F4F1F3] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!bg-transparent',
    headerTitle: 'text-[#211B2B]', headerSubtitle: 'text-[#696576]',
    formFieldLabel: 'text-[#211B2B]', socialButtonsBlockButtonText: 'text-[#211B2B]',
    footerActionLink: 'text-[#6C4F6E]', footerActionText: 'text-[#696576]',
    dividerText: 'text-[#696576]', identityPreviewEditButton: 'text-[#6C4F6E]', alertText: 'text-[#B42318]',
    logoImage: 'max-h-20 max-w-full', formFieldInput: 'bg-white text-[#211B2B] border-[#B6BAC2]',
    formButtonPrimary: 'bg-[#6C4F6E] text-white',
  },
};
function AuthenticationPage({ signup = false }) {
  return <main className="secure-auth-page"><a href="/" className="secure-auth-back">← Back to FindMyCareer</a>
    <div><p className="secure-auth-eyebrow">YOUR NEXT CHAPTER</p><h1>Your progress, securely yours.</h1>
      <p>Sign in to submit your certificates and receive an admin-reviewed career-path completion badge.</p></div>
    {signup ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl="/" /> :
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl="/" />}
  </main>;
}
function SecureApp() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const run = ++generation.current;
    setAccount(null); setError('');
    if (!isLoaded || !isSignedIn) return;
    const controller = new AbortController();
    (async () => {
      const response = await fetch('/api/me', { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your account could not be loaded.');
      if (generation.current === run) setAccount(data);
    })().catch(e => { if (e.name !== 'AbortError' && generation.current === run) setError(e.message); });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, user?.id, retry]);
  if (!isLoaded || (isSignedIn && !account && !error)) return <div role="status" className="secure-account-status">Loading your secure account…</div>;
  if (error) return <main className="secure-account-status"><h1>We couldn’t load your account</h1><p role="alert">{error}</p><button onClick={() => setRetry(v => v + 1)}>Try again</button><a href="/">Return home</a></main>;
  return <App key={user?.id || 'guest'} serverAccount={account} onAccountChange={setAccount} />;
}
function ProviderRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back to FindMyCareer', subtitle: 'Sign in to continue your next chapter' } }, signUp: { start: { title: 'Join FindMyCareer', subtitle: 'Keep your learning and certificates in one place' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <Switch>
      <Route path="/sign-in/*?"><AuthenticationPage /></Route>
      <Route path="/sign-up/*?"><AuthenticationPage signup /></Route>
      <Route><SecureApp /></Route>
    </Switch>
  </ClerkProvider>;
}
createRoot(document.getElementById('root')!).render(<WouterRouter base={basePath}><ProviderRoutes /></WouterRouter>);
