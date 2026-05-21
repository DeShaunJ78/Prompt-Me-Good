import { useEffect, useState } from "react";
import { ClerkProvider, SignIn, SignUp, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectBrainProvider, useProjectBrain } from "@/context/ProjectBrainContext";
import { TierProvider } from "@/context/TierContext";
import UpgradeModal from "@/components/upgrade/UpgradeModal";
import Header from "@/components/layout/Header";
import LeftSidebar from "@/components/layout/LeftSidebar";
import CenterPanel from "@/components/layout/CenterPanel";
import RightPanel from "@/components/layout/RightPanel";
import Landing from "@/pages/Landing";
import SavedProjects from "@/pages/SavedProjects";
import Pricing from "@/pages/Pricing";
import CheckoutFlow from "@/pages/CheckoutFlow";
import Preview from "@/pages/Preview";
import UsageDashboard from "@/pages/UsageDashboard";
import TopUpModal from "@/components/billing/TopUpModal";
import SmartUpgradeNudge from "@/components/billing/SmartUpgradeNudge";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import AdminBootstrapBanner from "@/components/admin/AdminBootstrapBanner";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk" as const,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#14B8A6",
    colorForeground: "#FFFFFF",
    colorMutedForeground: "#9CA3AF",
    colorDanger: "#F87171",
    colorBackground: "#0F1117",
    colorInput: "#1C1E28",
    colorInputForeground: "#FFFFFF",
    colorNeutral: "#1F2937",
    fontFamily: "system-ui, -apple-system, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#161821] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#1F2937]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-[#9CA3AF]",
    socialButtonsBlockButtonText: "text-[#E5E7EB]",
    formFieldLabel: "text-[#E5E7EB] text-sm",
    footerActionLink: "text-[#14B8A6]",
    footerActionText: "text-[#9CA3AF]",
    dividerText: "text-[#9CA3AF]",
    identityPreviewEditButton: "text-[#14B8A6]",
    formFieldSuccessText: "text-[#4ADE80]",
    alertText: "text-white",
    logoBox: "justify-center",
    logoImage: "h-8",
    socialButtonsBlockButton: "border border-[#1F2937] bg-[#1C1E28] text-[#E5E7EB]",
    formButtonPrimary: "bg-[#14B8A6] text-[#0F1117] font-semibold",
    formFieldInput: "bg-[#1C1E28] border-[#1F2937] text-white",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#1F2937]",
    alert: "border border-[#1F2937] bg-[#1C1E28]",
    otpCodeFieldInput: "bg-[#1C1E28] border-[#1F2937] text-white",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

const COCKPIT_TABS = [
  { id: "spec",    label: "Artifacts", icon: "📋" },
  { id: "build",   label: "Build",     icon: "🧠" },
  { id: "chat",    label: "Chat",      icon: "💬" },
] as const;
type CockpitTab = typeof COCKPIT_TABS[number]["id"];

function Cockpit() {
  const [mobileTab, setMobileTab] = useState<CockpitTab>("build");

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-canvas text-body">
      <Header />

      {/* ── Desktop: three-panel side by side ── */}
      <div className="hidden md:flex flex-row flex-1 overflow-hidden">
        <LeftSidebar />
        <CenterPanel />
        <RightPanel />
      </div>

      {/* ── Mobile: one panel at a time + bottom tab bar ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        {/* Active panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mobileTab === "spec"  && <LeftSidebar />}
          {mobileTab === "build" && <CenterPanel />}
          {mobileTab === "chat"  && <RightPanel />}
        </div>

        {/* Bottom tab bar */}
        <nav className="shrink-0 flex border-t border-panel bg-surface">
          {COCKPIT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-all ${
                mobileTab === tab.id
                  ? "text-primary"
                  : "text-subtle"
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
              {mobileTab === tab.id && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ProjectsGuard() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation("/sign-in");
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  return isSignedIn ? <SavedProjects /> : null;
}

function AppRouter() {
  const { currentPage } = useProjectBrain();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (currentPage === "cockpit" && location !== "/cockpit") setLocation("/cockpit");
  }, [currentPage]);

  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/projects" component={ProjectsGuard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/checkout/:tier" component={CheckoutFlow} />
      <Route path="/preview" component={Preview} />
      <Route path="/usage" component={UsageDashboard} />
      <Route path="/cockpit">
        {currentPage === "cockpit" ? <Cockpit /> : <Landing />}
      </Route>
      <Route component={Landing} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: { title: "Welcome back", subtitle: "Sign in to save and access your projects" },
        },
        signUp: {
          start: { title: "Create your account", subtitle: "Save projects and access them anywhere" },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TierProvider>
          <ProjectBrainProvider>
            <OnboardingFlow />
            <AppRouter />
            <UpgradeModal />
            <TopUpModal />
            <SmartUpgradeNudge />
            <AdminBootstrapBanner />
          </ProjectBrainProvider>
        </TierProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
