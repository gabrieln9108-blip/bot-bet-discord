import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, AlertTriangle, BarChart3, BriefcaseBusiness, Check,
  ClipboardCheck, FileText, LayoutDashboard, LockKeyhole, LogOut,
  Pencil, Plus, RotateCcw, Search, Settings, Sparkles, Target, Trash2,
  X, Zap, BookOpen, GraduationCap, Lightbulb, PlusCircle, Printer, UserRound, Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  getGetCurriculumQueryKey, getListApplicationsQueryKey, getListCurriculumsQueryKey,
  getListInterviewsQueryKey, getListJobAnalysesQueryKey, useCreateApplication,
   useCreateCurriculum, useCreateInterview, useCreateJobAnalysis, useDeleteApplication,
   useDeleteJobAnalysis,
  useDeleteCurriculum, useDuplicateCurriculum, useFinishInterview, useGetCurriculum,
  useGetDashboard, useListApplications, useListCurriculums, useListInterviews,
  useListJobAnalyses, useSendInterviewMessage, useUpdateApplication, useUpdateCurriculum,
} from '@workspace/api-client-react';
import type {
  Application, Curriculum, CurriculumData, Dashboard, Interview, JobAnalysis,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import ExpandedCurriculumEditor from '@/components/ExpandedCurriculum';
import InterviewSimulator from '@/components/InterviewSimulator';
import NotFound from '@/pages/not-found';
import {
  checkFirstAccess, completeFirstAccess, getAccessToken, getStoredUser, hasSupabaseAuth,
  hasBackendAuth, signIn, signOut, startCheckout,
} from '@/lib/auth';
import './index.css';

const queryClient = new QueryClient();

const navItems = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/plano', label: 'Meu plano', icon: Target },
  { href: '/curriculo', label: 'Currículos', icon: FileText },
  { href: '/entrevista', label: 'Entrevistas', icon: ClipboardCheck },
  { href: '/analisador-vagas', label: 'Analisador de vagas', icon: Search },
  { href: '/candidaturas', label: 'Candidaturas', icon: BriefcaseBusiness },
  { href: '/perfil', label: 'Meu perfil', icon: UserRound },
  { href: '/progresso', label: 'Meu progresso', icon: BarChart3 },
  { href: '/conquistas', label: 'Conquistas', icon: Trophy },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <span className="brand-mark" style={inverse ? { color: 'hsl(var(--primary-foreground))' } : undefined}>
    <span className="brand-symbol">P</span><span>primeiro emprego</span>
  </span>;
}

function useNotice() {
  const [notice, setNotice] = useState('');
  const show = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2800);
  };
  return { notice, show };
}

function Notice({ text }: { text: string }) {
  return text ? <div className="toast-note" role="status" aria-live="polite" data-testid="status-notice">{text}</div> : null;
}

function PublicHeader({ onStart }: { onStart?: () => void }) {
  return <header className="public-nav">
    <Link href="/" data-testid="link-home"><Logo /></Link>
    <nav className="public-nav-links" aria-label="Navegação principal">
      <a href="#como-funciona" data-testid="link-como-funciona">Como funciona</a>
      <a href="#recursos" data-testid="link-recursos">Recursos</a>
      <Link href="/login" className="button ghost login-button" data-testid="button-header-login"><UserRound size={15} /> Entrar na conta</Link>
      {onStart ? <button type="button" className="button primary" onClick={onStart} data-testid="button-header-comecar">Começar agora <ArrowRight size={15} /></button> : <Link href="/checkout" className="button primary" data-testid="link-comecar">Começar agora <ArrowRight size={15} /></Link>}
    </nav>
  </header>;
}

function PublicFooter() {
  return <footer className="public-footer">
    <span>© 2025 primeiro emprego. Feito para o primeiro passo.</span>
    <span><Link href="/politica-de-privacidade" data-testid="link-privacidade">Privacidade</Link> · <Link href="/termos-de-uso" data-testid="link-termos">Termos de uso</Link></span>
  </footer>;
}

function LandingPage() {
  const [showContext, setShowContext] = useState(false);
  const [contextSubmitted, setContextSubmitted] = useState(false);
  const [context, setContext] = useState({ situation: '', goal: '', education: '' });
  const startFlow = () => {
    setShowContext(true);
    window.setTimeout(() => document.getElementById('context-form')?.focus(), 50);
  };
  const submitContext = (event: FormEvent) => {
    event.preventDefault();
    setShowContext(false);
    setContextSubmitted(true);
    window.setTimeout(() => document.getElementById('offer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };
  return <main className="landing">
    <PublicHeader onStart={startFlow} />
    <section className="hero">
      <div className="fade-up">
        <span className="eyebrow">Seu começo, com direção</span>
        <h1 className="display-title">O primeiro passo não precisa ser solitário.</h1>
        <p className="hero-copy">Uma jornada simples para criar seu currículo, praticar entrevistas e organizar cada oportunidade — no seu ritmo, sem prometer atalhos.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
           <button type="button" className="button accent" onClick={startFlow} data-testid="button-hero-comecar">Quero começar <ArrowRight size={16} /></button>
          <a href="#como-funciona" className="button ghost" data-testid="link-hero-entender">Entender como funciona</a>
        </div>
        <p className="muted" style={{ marginTop: 16, fontSize: '.76rem' }}>Uma ferramenta prática para dar forma ao seu próximo passo.</p>
      </div>
      <div className="hero-art fade-up delay-2" aria-label="Ilustração de progresso">
        <div className="orbit">
          <div className="orbit-core">1º</div>
          <div className="orbit-card one"><strong>próximo passo</strong><br />revisar seu objetivo</div>
          <div className="orbit-card two"><strong>+ clareza</strong><br />a cada tentativa</div>
        </div>
      </div>
    </section>
    <div className="marquee" aria-hidden="true"><div className="marquee-track"><span>clareza para começar</span><span>•</span><span>prática que prepara</span><span>•</span><span>um passo de cada vez</span><span>•</span><span>clareza para começar</span><span>•</span><span>prática que prepara</span></div></div>
    <section id="como-funciona" className="landing-section">
      <div className="feature-row">
        <div><span className="eyebrow">Um caminho possível</span><h2 className="display-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', marginTop: 13 }}>Menos dúvida.<br />Mais movimento.</h2></div>
        <div className="feature-list">
          {[
            ['01', 'Monte sua base', 'Um currículo que fala sobre o que você já sabe — mesmo quando a experiência ainda está começando.'],
            ['02', 'Pratique sem julgamento', 'Simulações de entrevista com perguntas reais e feedback para você chegar mais preparado.'],
            ['03', 'Escolha com intenção', 'Entenda se uma vaga combina com o seu momento antes de investir tempo em uma candidatura.'],
          ].map(([number, title, copy]) => <div className="feature" key={number}><span className="feature-number">{number}</span><div><h3 style={{ fontWeight: 700, marginBottom: 5 }}>{title}</h3><p className="muted" style={{ lineHeight: 1.6, fontSize: '.88rem' }}>{copy}</p></div></div>)}
        </div>
      </div>
    </section>
    <section id="recursos" className="landing-section" style={{ paddingTop: 20 }}>
      <div className="card pad" style={{ background: 'hsl(var(--secondary))', border: 0 }}>
        <div className="section-head"><div><span className="eyebrow">Dentro da plataforma</span><h2 style={{ marginTop: 7 }}>Tudo que você precisa para sair do zero</h2></div><span className="pill yellow">feito para iniciantes</span></div>
        <div className="three-col">
          {[
            [FileText, 'Currículo vivo', 'Crie, salve e ajuste versões para diferentes oportunidades.'],
            [ClipboardCheck, 'Entrevista guiada', 'Uma pergunta por vez, com um retorno que ajuda de verdade.'],
            [Target, 'Leitura de vagas', 'Veja seus pontos fortes e o que pode desenvolver antes de aplicar.'],
          ].map(([Icon, title, copy]) => <div key={title as string} style={{ padding: '18px 0' }}><span className="empty-icon" style={{ marginBottom: 14 }}><Icon size={20} /></span><h3 style={{ marginBottom: 6 }}>{title as string}</h3><p className="muted" style={{ fontSize: '.83rem', lineHeight: 1.6 }}>{copy as string}</p></div>)}
        </div>
      </div>
    </section>
    <section id="offer" className={`pricing-band ${contextSubmitted ? 'offer-revealed' : 'offer-quiet'}`} aria-live="polite">
      {!contextSubmitted ? <div className="offer-teaser"><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Um caminho possível</span><h2 className="display-title" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)', margin: '14px 0' }}>Comece entendendo o seu momento.</h2><p style={{ color: 'hsl(var(--primary-foreground) / .7)', lineHeight: 1.6, maxWidth: 510 }}>Responda três perguntas rápidas e veja como o Primeiro Emprego pode acompanhar o seu próximo passo.</p><button type="button" className="button accent" style={{ marginTop: 22 }} onClick={startFlow} data-testid="button-offer-context">Quero começar <ArrowRight size={15} /></button></div> : <div className="offer-reveal-content"><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Para o seu próximo passo</span><h2 className="display-title" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.5rem)', margin: '14px 0' }}>Uma base para sair do zero.</h2><p style={{ color: 'hsl(var(--primary-foreground) / .7)', lineHeight: 1.6, maxWidth: 510 }}>Acesso completo às ferramentas de currículo, entrevista, análise de vagas e candidaturas. Uma compra única, sem mensalidade.</p></div><div className="offer-price-block"><div className="price" data-testid="text-offer-price">R$ 16,90</div><p style={{ color: 'hsl(var(--primary-foreground) / .7)', marginBottom: 20 }}>acesso completo, uma vez só</p><Link href="/checkout" className="button accent" data-testid="link-pricing-comecar">Quero dar o primeiro passo <ArrowRight size={15} /></Link></div></div>}
    </section>
    <section className="landing-section" style={{ paddingBottom: 100 }}>
      <p className="quote">“Você não precisa ter tudo resolvido para começar. Precisa apenas de um próximo passo que faça sentido.”</p>
    </section>
    <PublicFooter />
    {showContext && <div className="context-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowContext(false); }}><section className="context-dialog" role="dialog" aria-modal="true" aria-labelledby="context-title"><button type="button" className="dialog-close" onClick={() => setShowContext(false)} aria-label="Fechar formulário" data-testid="button-close-context"><X size={18} /></button><span className="eyebrow">Antes de começar</span><h2 id="context-title" className="display-title">Vamos partir do seu momento.</h2><p className="muted context-intro">Suas respostas ajudam a mostrar uma oferta que faça sentido para a sua fase. Leva menos de um minuto.</p><form id="context-form" onSubmit={submitContext} className="context-form" tabIndex={-1}><fieldset><legend>Em que ponto você está?</legend>{[['busca', 'Estou procurando minha primeira oportunidade'], ['entrevista', 'Tenho uma entrevista ou processo em andamento'], ['organizando', 'Quero organizar currículo e candidaturas']].map(([value, label]) => <label className={`context-choice ${context.situation === value ? 'selected' : ''}`} key={value}><input type="radio" name="situation" required value={value} checked={context.situation === value} onChange={event => setContext(current => ({ ...current, situation: event.target.value }))} />{label}</label>)}</fieldset><div><label className="label" htmlFor="context-goal">Qual seria uma ajuda valiosa agora?</label><select id="context-goal" className="select" required value={context.goal} onChange={event => setContext(current => ({ ...current, goal: event.target.value }))}><option value="">Escolha uma opção</option><option value="curriculo">Ter um currículo mais claro</option><option value="entrevista">Responder melhor em entrevistas</option><option value="vagas">Entender quais vagas combinam comigo</option></select></div><div><label className="label" htmlFor="context-education">Você está estudando?</label><select id="context-education" className="select" required value={context.education} onChange={event => setContext(current => ({ ...current, education: event.target.value }))}><option value="">Escolha uma opção</option><option value="sim">Sim, atualmente</option><option value="conclui">Concluí recentemente</option><option value="nao">Não neste momento</option></select></div><button type="submit" className="button primary" data-testid="button-submit-context">Ver a oferta para mim <ArrowRight size={15} /></button></form></section></div>}
  </main>;
}

function AuthPage({ mode }: { mode: 'login' | 'cadastro' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [purchaseVerified, setPurchaseVerified] = useState(false);
  const [emailValidated, setEmailValidated] = useState(false);
  const [creatingPassword, setCreatingPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const { notice, show } = useNotice();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    try {
      if (mode === 'login' && !emailValidated) {
        const result = await checkFirstAccess(email);
        if (!result.eligible) {
          show('Não encontramos um acesso para este e-mail. Confira o endereço ou faça sua compra primeiro.');
          return;
        }
        setEmailValidated(true);
        setCreatingPassword(Boolean(result.firstAccess));
        show('E-mail confirmado. Agora, vamos proteger seu acesso.');
      } else if (mode === 'login' && creatingPassword) {
        await completeFirstAccess(email, password, name);
        show('Senha criada. Vamos começar.');
        window.setTimeout(() => setLocation('/dashboard'), 350);
      } else if (mode === 'login') {
        await signIn(email, password);
        show(hasSupabaseAuth ? 'Acesso confirmado. Vamos continuar.' : 'Acesso pronto para continuar.');
        window.setTimeout(() => setLocation('/dashboard'), 350);
      } else if (!purchaseVerified) {
        const result = await checkFirstAccess(email);
        if (!result.eligible) {
          show('Não encontramos uma compra aprovada para este e-mail.');
          return;
        }
        setPurchaseVerified(true);
        show('Compra localizada. Agora escolha sua senha.');
      } else {
        await completeFirstAccess(email, password, name);
        show('Acesso criado. Vamos começar.');
        window.setTimeout(() => setLocation('/dashboard'), 350);
      }
    } catch (error) {
      show(error instanceof Error ? error.message : 'Não foi possível concluir o acesso.');
    } finally {
      setWorking(false);
    }
  };
  const resetEmail = () => {
    setEmailValidated(false);
    setCreatingPassword(false);
    setPassword('');
    setName('');
  };
  return <main className="auth-page">
    <aside className="auth-aside"><Link href="/" data-testid="link-auth-logo"><Logo inverse /></Link><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Primeiro emprego</span><h1 className="display-title">{mode === 'login' ? 'Bom ter você de volta.' : 'Seu começo merece espaço.'}</h1></div><p style={{ color: 'hsl(var(--primary-foreground) / .62)', fontSize: '.8rem' }}>Um passo claro de cada vez.</p></aside>
    <section className="auth-panel"><div className="auth-form">
      <Link href="/" className="muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '.8rem' }} data-testid="link-auth-voltar"><ArrowLeft size={14} /> voltar para início</Link>
       <span className="eyebrow" style={{ display: 'block', marginTop: 48 }}>{mode === 'login' ? emailValidated ? 'E-mail confirmado' : 'Acessar conta' : 'Primeiro acesso'}</span>
       <h1>{mode === 'login' ? !emailValidated ? 'Vamos encontrar seu espaço.' : creatingPassword ? 'Crie uma senha para voltar quando quiser.' : 'Que bom ter você por aqui.' : purchaseVerified ? 'Escolha sua senha.' : 'Vamos confirmar sua compra.'}</h1>
       <p className="muted" style={{ fontSize: '.9rem' }}>{mode === 'login' ? !emailValidated ? 'Comece com seu e-mail. Depois mostramos o próximo passo de forma segura.' : creatingPassword ? 'Ainda não criou uma senha? Tudo bem. Escolha uma com pelo menos 8 caracteres.' : 'Digite a senha que você já usa para entrar na sua jornada.' : purchaseVerified ? 'Use pelo menos 8 caracteres. Você não precisa compartilhar sua senha com ninguém.' : 'Informe o e-mail usado na compra para liberar a criação do seu acesso.'}</p>
      <form onSubmit={submit}>
         <div><label className="label" htmlFor="email">Seu e-mail</label><input id="email" className="input" type="email" required disabled={mode === 'login' && emailValidated} value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" data-testid="input-email" /></div>
          {mode === 'login' && emailValidated && creatingPassword && <div><label className="label" htmlFor="nome-login">Como podemos chamar você?</label><input id="nome-login" className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" data-testid="input-login-name" /></div>}
          {mode === 'cadastro' && purchaseVerified && <div><label className="label" htmlFor="nome">Como podemos chamar você?</label><input id="nome" className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" data-testid="input-nome" /></div>}
          {((mode === 'login' && emailValidated) || purchaseVerified) && <div><label className="label" htmlFor="senha">{creatingPassword ? 'Crie sua senha' : 'Senha'}</label><input id="senha" className="input" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" data-testid="input-senha" /></div>}
          <button className="button primary" type="submit" disabled={working} aria-busy={working} data-testid="button-auth-submit">{working ? 'Aguarde...' : mode === 'login' ? !emailValidated ? 'Continuar com meu e-mail' : creatingPassword ? 'Criar senha e entrar' : 'Entrar na minha conta' : purchaseVerified ? 'Criar meu acesso' : 'Verificar compra'} <ArrowRight size={15} /></button>
      </form>
        {mode === 'login' && emailValidated && <div className="auth-step-links"><button type="button" className="text-button" onClick={() => setCreatingPassword(value => !value)} data-testid="button-toggle-password-mode">{creatingPassword ? 'Já tenho uma senha' : 'É seu primeiro acesso? Crie uma senha'}</button><button type="button" className="text-button" onClick={resetEmail} data-testid="button-change-email">Usar outro e-mail</button></div>}
        <p className="muted" style={{ textAlign: 'center', fontSize: '.8rem', marginTop: 24 }}>{mode === 'login' ? <>Ainda não tem acesso? <Link href="/cadastro" style={{ color: 'hsl(var(--primary))', fontWeight: 700 }} data-testid="link-cadastro">Começar por aqui</Link></> : <>Já tem acesso? <Link href="/login" style={{ color: 'hsl(var(--primary))', fontWeight: 700 }} data-testid="link-login">Entrar</Link></>}</p>
    </div></section><Notice text={notice} />
  </main>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState(() => getStoredUser());
  const current = navItems.find(item => location.startsWith(item.href));
  useEffect(() => {
    if ((hasSupabaseAuth || hasBackendAuth) && !getAccessToken()) setLocation('/login');
  }, [setLocation]);
  const displayName = user?.name || user?.email?.split('@')[0] || 'você';
  const initials = displayName.slice(0, 1).toUpperCase();
  const logout = async () => {
    await signOut();
    setUser(null);
    setLocation('/login');
  };
  return <div className="app-shell">
   <aside className="app-sidebar"><Link href="/dashboard" data-testid="link-sidebar-logo"><Logo inverse /></Link><nav className="sidebar-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${current?.href === href ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={17} /><span>{label}</span></Link>)}</nav><div className="sidebar-footer"><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="avatar">{initials}</span><div><strong style={{ fontSize: '.8rem', display: 'block' }}>{displayName}</strong><span style={{ fontSize: '.68rem', color: 'hsl(var(--sidebar-foreground) / .55)' }}>começo em andamento</span></div><button className="button ghost" style={{ marginLeft: 'auto', padding: 7, color: 'inherit', borderColor: 'transparent' }} onClick={() => setLocation('/configuracoes')} data-testid="button-sidebar-settings"><Settings size={15} /></button></div></div></aside>
    <main className="app-main"><header className="topbar"><div><span className="eyebrow">{current?.label ?? 'Sua jornada'}</span><div style={{ fontFamily: 'var(--app-font-serif)', fontWeight: 700, fontSize: '1.1rem', marginTop: 2 }}>{current?.href === '/dashboard' ? `Olá, ${displayName}.` : current?.label}</div></div><div><button className="avatar" style={{ width: 31, height: 31, fontSize: '.8rem', border: 0, cursor: 'pointer' }} onClick={logout} title="Sair">{initials}</button></div></header>{children}</main>
  </div>;
}

function LoadingCards() { return <div className="page-wrap"><div className="skeleton" style={{ width: 250, height: 34, marginBottom: 20 }} /><div className="stat-grid"><div className="skeleton" style={{ height: 132 }} /><div className="skeleton" style={{ height: 132 }} /><div className="skeleton" style={{ height: 132 }} /><div className="skeleton" style={{ height: 132 }} /></div></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="empty-state"><span className="empty-icon"><RotateCcw size={20} /></span><h3>Não conseguimos carregar esta parte</h3><p className="muted" style={{ margin: '7px 0 18px', fontSize: '.85rem' }}>Tente novamente em alguns instantes.</p><button className="button primary" onClick={onRetry} data-testid="button-retry">Tentar novamente</button></div>; }
function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) { return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h1 className="display-title" style={{ fontSize: 'clamp(2.3rem, 5vw, 4.2rem)', marginTop: 8 }}>{title}</h1>{copy && <p style={{ maxWidth: 580 }}>{copy}</p>}</div>{action}</div>; }

function DashboardPage() {
  const dashboardQuery = useGetDashboard();
  const applicationsQuery = useListApplications();
  const interviewsQuery = useListInterviews();
  const analysesQuery = useListJobAnalyses();
  const curriculumsQuery = useListCurriculums();
  const dashboard = dashboardQuery.data as Dashboard | undefined;
  if (dashboardQuery.isLoading) return <LoadingCards />;
  if (dashboardQuery.isError || !dashboard) return <div className="page-wrap"><ErrorState onRetry={() => dashboardQuery.refetch()} /></div>;
  const checklistDone = dashboard.checklist.filter(item => item.completed).length;
  const apps = Object.entries(dashboard.applicationSummary ?? {});
  const applications = applicationsQuery.data ?? [];
  const interviews = interviewsQuery.data ?? [];
  const analyses = analysesQuery.data ?? [];
  const preparationData = dashboard.checklist.map((item, index) => ({
    etapa: `${index + 1}`,
    concluido: item.completed ? 100 : 0,
  }));
  const activityData = [
    { name: 'Currículos', total: curriculumsQuery.data?.length ?? 0, color: '#d4b528' },
    { name: 'Entrevistas', total: interviews.filter(item => item.status === 'completed').length, color: '#557a70' },
    { name: 'Vagas', total: analyses.length, color: '#c66f45' },
    { name: 'Candidaturas', total: applications.length, color: '#24443d' },
  ];
  const applicationTotal = applications.length;
  const positiveApplications = applications.filter(item => item.status === 'aprovado' || item.status === 'segunda_etapa' || item.status === 'entrevista').length;
  const conversion = applicationTotal ? Math.round((positiveApplications / applicationTotal) * 100) : 0;
  const insight = applicationTotal === 0
    ? 'Seu próximo ganho de clareza vem de registrar a primeira candidatura.'
    : conversion >= 50
      ? 'Você já tem conversas avançando. Priorize acompanhamentos e prepare exemplos concretos.'
      : 'Registre cada movimento e use a análise de vagas para escolher melhor onde investir energia.';
  return <div className="page-wrap fade-up">
    <PageHeader eyebrow="Seu painel" title={`Olá, ${dashboard.userName}.`} copy="Você não precisa fazer tudo hoje. Escolha um próximo passo e deixe o resto para depois." action={<Link href={dashboard.nextStep.href} className="button accent" data-testid="link-next-step"><Zap size={15} /> {dashboard.nextStep.title}</Link>} />
    <div className="card pad" style={{ marginBottom: 18, background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-end', marginBottom: 18 }}><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Seu ritmo</span><div style={{ fontFamily: 'var(--app-font-serif)', fontSize: '2.6rem', letterSpacing: '-.06em', marginTop: 5 }}>{dashboard.progress}%</div></div><p style={{ maxWidth: 300, color: 'hsl(var(--primary-foreground) / .68)', fontSize: '.84rem', lineHeight: 1.5 }}>Você já está construindo algo importante: consistência.</p></div><div className="progress-track" style={{ background: 'hsl(var(--primary-foreground) / .16)' }}><div className="progress-fill" style={{ width: `${dashboard.progress}%` }} /></div></div>
    <div className="stat-grid" style={{ marginBottom: 18 }}><div className="card stat-card"><span className="eyebrow">Checklist</span><div className="stat-value">{checklistDone}<small style={{ fontSize: '1rem', color: 'hsl(var(--muted-foreground))' }}>/{dashboard.checklist.length}</small></div><span className="muted" style={{ fontSize: '.76rem' }}>etapas concluídas</span></div><div className="card stat-card"><span className="eyebrow">Candidaturas</span><div className="stat-value">{Object.values(dashboard.applicationSummary ?? {}).reduce((sum, value) => sum + value, 0)}</div><span className="muted" style={{ fontSize: '.76rem' }}>movimentos registrados</span></div><div className="card stat-card"><span className="eyebrow">Conquistas</span><div className="stat-value">{dashboard.achievements.filter(item => item.unlocked).length}</div><span className="muted" style={{ fontSize: '.76rem' }}>desbloqueadas</span></div><div className="card stat-card"><span className="eyebrow">Próximo foco</span><div className="stat-value"><Target size={27} /></div><span className="muted" style={{ fontSize: '.76rem' }}>um passo por vez</span></div></div>
    <div className="dashboard-chart-grid">
      <div className="card pad"><div className="section-head"><div><span className="eyebrow">Leitura do momento</span><h2 style={{ marginTop: 6 }}>Seu preparo em perspectiva</h2><p>Uma visão rápida do que já saiu do papel.</p></div><span className="pill green">{checklistDone}/{dashboard.checklist.length} concluídas</span></div><div className="chart-frame"><ResponsiveContainer width="100%" height={220}><AreaChart data={preparationData} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d4b528" stopOpacity={0.65} /><stop offset="100%" stopColor="#d4b528" stopOpacity={0.06} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="etapa" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={value => `${value}%`} /><Tooltip formatter={(value: number) => [`${value}%`, 'Concluído']} labelFormatter={label => `Etapa ${label}`} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} /><Area type="monotone" dataKey="concluido" stroke="#b29612" strokeWidth={3} fill="url(#progressFill)" /></AreaChart></ResponsiveContainer></div></div>
      <div className="card pad"><div className="section-head"><div><span className="eyebrow">Movimentos reais</span><h2 style={{ marginTop: 6 }}>O que já começou</h2><p>Sem números inventados: só seus registros.</p></div></div><div className="chart-frame"><ResponsiveContainer width="100%" height={220}><BarChart data={activityData} layout="vertical" margin={{ top: 5, right: 10, left: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={75} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: 'hsl(var(--muted) / .55)' }} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} /><Bar dataKey="total" radius={[0, 6, 6, 0]}>{activityData.map(item => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div></div>
    </div>
    <div className="dashboard-insight card pad"><div className="insight-mark"><Sparkles size={18} /></div><div><span className="eyebrow">Análise do seu momento</span><p>{insight}</p></div><Link href={dashboard.nextStep.href} className="text-button">Ver próximo passo <ArrowRight size={13} /></Link></div>
    <div className="dashboard-grid"><div className="card pad"><div className="section-head"><div><h2>Seu checklist</h2><p>Pequenas ações, uma base mais forte.</p></div><span className="pill green">{checklistDone} feitas</span></div>{dashboard.checklist.map((item, index) => <div className="check-item" key={`${item.label}-${index}`} data-testid={`item-checklist-${index}`}><span className={`check-dot ${item.completed ? 'done' : ''}`}>{item.completed && <Check size={13} strokeWidth={3} />}</span><span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'hsl(var(--muted-foreground))' : undefined }}>{item.label}</span></div>)}</div><div style={{ display: 'grid', gap: 18 }}><div className="card pad"><div className="section-head"><div><h2>Seu próximo passo</h2><p>{dashboard.nextStep.description}</p></div></div><Link href={dashboard.nextStep.href} className="button primary" data-testid="link-dashboard-next">{dashboard.nextStep.title} <ArrowRight size={15} /></Link></div><div className="card pad"><div className="section-head"><div><h2>Atividade recente</h2></div></div>{dashboard.recentActivity.length ? dashboard.recentActivity.slice(0, 4).map((activity, index) => <div className="activity-item" key={`${activity.label}-${index}`}><span className="activity-dot" /><div><p style={{ fontSize: '.83rem', fontWeight: 600 }}>{activity.label}</p><span className="muted" style={{ fontSize: '.7rem' }}>{activity.time}</span></div></div>) : <p className="muted" style={{ fontSize: '.82rem' }}>Suas próximas ações aparecerão aqui.</p>}</div></div></div>
     <div className="two-col" style={{ marginTop: 18 }}><div className="card pad"><div className="section-head"><div><h2>Mapa de candidaturas</h2><p>Uma visão sem pressão do que está acontecendo.</p></div><span className="pill yellow">{conversion}% em conversa</span></div>{apps.length ? apps.map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '.84rem' }}><span>{label}</span><strong>{value}</strong></div>) : <p className="muted" style={{ fontSize: '.83rem' }}>Adicione sua primeira candidatura para acompanhar seu movimento.</p>}</div><div className="card pad"><div className="section-head"><div><h2>Conquistas</h2><p>Reconheça seu próprio avanço.</p></div></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{dashboard.achievements.map((achievement, index) => <span className={`pill ${achievement.unlocked ? 'yellow' : ''}`} style={{ opacity: achievement.unlocked ? 1 : .48 }} key={`${achievement.label}-${index}`} data-testid={`achievement-${index}`}>{achievement.label}</span>)}</div></div></div>
  </div>;
}

function DashboardModulePage({ kind }: { kind: 'plan' | 'profile' | 'progress' | 'achievements' }) {
  const dashboardQuery = useGetDashboard();
  const curriculumsQuery = useListCurriculums();
  const dashboard = dashboardQuery.data as Dashboard | undefined;
  if (dashboardQuery.isLoading || (kind === 'profile' && curriculumsQuery.isLoading)) return <LoadingCards />;
  if (dashboardQuery.isError || !dashboard) return <div className="page-wrap"><ErrorState onRetry={() => dashboardQuery.refetch()} /></div>;
  const titles = {
    plan: ['Seu plano', 'Uma sequência simples para transformar preparação em movimento.'],
    profile: ['Meu perfil', 'As informações que alimentam seu currículo e suas comparações de vagas.'],
    progress: ['Meu progresso', 'Veja o que já foi feito e escolha um próximo passo possível.'],
    achievements: ['Conquistas', 'Marcos discretos para reconhecer sua consistência.'],
  } as const;
  const [title, copy] = titles[kind];
  const curriculum = curriculumsQuery.data?.[0];
  const summaryEntries = Object.entries(dashboard.applicationSummary ?? {}).filter(([, value]) => value > 0);
  return <div className="page-wrap fade-up">
    <PageHeader eyebrow="Sua jornada" title={title} copy={copy} />
    {kind === 'plan' && <div className="dashboard-module-grid"><div className="card pad"><div className="section-head"><div><h2>Checklist da busca</h2><p>Ações reais, sem tarefas inventadas.</p></div><span className="pill green">{dashboard.checklist.filter(item => item.completed).length}/{dashboard.checklist.length}</span></div>{dashboard.checklist.map((item, index) => <div className="check-item" key={`${item.label}-${index}`}><span className={`check-dot ${item.completed ? 'done' : ''}`}>{item.completed && <Check size={13} />}</span><span>{item.label}</span></div>)}</div><div className="card pad"><span className="eyebrow">Próximo passo</span><h2 style={{ margin: '9px 0' }}>{dashboard.nextStep.title}</h2><p className="muted" style={{ lineHeight: 1.6, marginBottom: 18 }}>{dashboard.nextStep.description}</p><Link href={dashboard.nextStep.href} className="button primary">{dashboard.nextStep.title} <ArrowRight size={15} /></Link></div></div>}
    {kind === 'profile' && <div className="two-col"><div className="card pad"><span className="eyebrow">Dados usados pela plataforma</span><h2 style={{ margin: '9px 0 18px' }}>{curriculum?.data.personal.name || dashboard.userName}</h2>{curriculum ? <div className="profile-facts"><span><strong>Objetivo</strong>{curriculum.objective || 'Ainda não definido'}</span><span><strong>Cidade</strong>{curriculum.data.personal.city || 'Ainda não informado'}</span><span><strong>E-mail</strong>{curriculum.data.personal.email || 'Ainda não informado'}</span><span><strong>Habilidades</strong>{curriculum.data.skills.length ? curriculum.data.skills.join(', ') : 'Ainda não informadas'}</span></div> : <p className="muted">Crie um currículo para começar a organizar seus dados.</p>}</div><div className="card pad"><h2>Privacidade por padrão</h2><p className="muted" style={{ lineHeight: 1.6, marginTop: 8 }}>A plataforma usa somente as informações que você escolhe preencher. Não é necessário informar CPF, RG ou outros documentos para preparar seu currículo.</p><Link href="/curriculo" className="button ghost" style={{ marginTop: 18 }}>Editar currículo <ArrowRight size={15} /></Link></div></div>}
    {kind === 'progress' && <><div className="card pad progress-module"><div><span className="eyebrow">Progresso geral</span><strong>{dashboard.progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${dashboard.progress}%` }} /></div><p className="muted">O percentual considera as etapas concluídas no seu plano, não uma previsão de resultado.</p></div><div className="stat-grid" style={{ marginTop: 18 }}><div className="card stat-card"><span className="eyebrow">Currículos</span><div className="stat-value">{curriculum ? 1 : 0}</div></div><div className="card stat-card"><span className="eyebrow">Entrevistas</span><div className="stat-value">{dashboard.checklist.find(item => item.label === 'Treinar entrevista')?.completed ? '✓' : 0}</div></div><div className="card stat-card"><span className="eyebrow">Vagas analisadas</span><div className="stat-value">{dashboard.checklist.find(item => item.label === 'Analisar vagas')?.completed ? '✓' : 0}</div></div><div className="card stat-card"><span className="eyebrow">Candidaturas</span><div className="stat-value">{summaryEntries.reduce((total, [, value]) => total + value, 0)}</div></div></div></>}
    {kind === 'achievements' && <div className="card pad"><div className="achievement-list dashboard-achievements">{dashboard.achievements.map((achievement, index) => <div className={`achievement-card ${achievement.unlocked ? 'unlocked' : ''}`} key={`${achievement.label}-${index}`}><span className="achievement-icon"><Trophy size={18} /></span><div><strong>{achievement.label}</strong><p>{achievement.unlocked ? 'Concluída com uma ação real.' : 'Continue no seu ritmo para chegar aqui.'}</p></div></div>)}</div></div>}
  </div>;
}

const emptyCurriculumData = (): CurriculumData => ({ personal: { name: '', city: '', phone: '', email: '' }, education: [], courses: [], skills: [], experiences: [], profile: '' });

const objectiveOptions = ['Atendimento', 'Administrativo', 'Comércio', 'Logística', 'Tecnologia', 'Jovem Aprendiz', 'Estágio', 'Outro'];
const skillSuggestions = ['Comunicação', 'Organização', 'Atendimento', 'Informática', 'Pacote Office', 'Trabalho em equipe', 'Pontualidade', 'Responsabilidade', 'Aprendizado rápido', 'Criatividade'];
const experienceTypes = ['Trabalho informal', 'Projeto escolar', 'Voluntariado', 'Atividade extracurricular', 'Negócio familiar', 'Projeto pessoal'];

function CurriculumPreview({ name, objective, template, data }: { name: string; objective: string; template: Curriculum['template']; data: CurriculumData }) {
  const profile = data.profile.trim();
  const visibleSkills = data.skills.filter(Boolean);
  return <div className={`resume-preview resume-${template}`} data-testid="curriculum-preview">
    <div className="resume-heading">
      <h2>{data.personal.name || 'Seu nome completo'}</h2>
      <p>{[data.personal.city, data.personal.phone, data.personal.email].filter(Boolean).join(' · ') || 'Cidade · telefone · e-mail'}</p>
      {objective && <strong>{objective}</strong>}
    </div>
    {profile && <section><h3>Perfil profissional</h3><p>{profile}</p></section>}
    {data.education.length > 0 && <section><h3>Escolaridade</h3>{data.education.map((item, index) => <div className="resume-entry" key={`education-${index}`}><strong>{item.level || 'Escolaridade'}</strong><span>{[item.status, item.institution].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {data.courses.length > 0 && <section><h3>Cursos</h3>{data.courses.map((item, index) => <div className="resume-entry" key={`course-${index}`}><strong>{item.name || 'Curso'}</strong><span>{[item.institution, item.year].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {visibleSkills.length > 0 && <section><h3>Habilidades</h3><p className="resume-skills">{visibleSkills.join('  ·  ')}</p></section>}
    {data.experiences.length > 0 && <section><h3>Experiências e projetos</h3>{data.experiences.map((item, index) => <div className="resume-entry" key={`experience-${index}`}><strong>{item.type || 'Experiência'}</strong><span>{item.description}</span></div>)}</section>}
    {!profile && !data.education.length && !data.courses.length && !visibleSkills.length && !data.experiences.length && <p className="muted resume-empty">Preencha as etapas ao lado para visualizar seu currículo.</p>}
    <small className="resume-version">{name || 'Meu currículo'}</small>
  </div>;
}

function CurriculumCard({ item, onDelete, onDuplicate }: { item: Curriculum; onDelete: () => void; onDuplicate: () => void }) {
  const [, setLocation] = useLocation();
  return <div className="card pad" data-testid={`card-curriculum-${item.id}`}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><span className="pill green">{item.status === 'pronto' ? 'pronto para enviar' : 'em rascunho'}</span><h3 style={{ margin: '14px 0 5px', fontSize: '1.1rem' }}>{item.name}</h3><p className="muted" style={{ fontSize: '.8rem' }}>{item.objective || 'Sem objetivo definido'}</p></div><button className="button ghost" style={{ padding: 8, alignSelf: 'flex-start' }} onClick={() => setLocation(`/curriculo/${item.id}`)} data-testid={`button-edit-curriculum-${item.id}`}><Pencil size={15} /></button></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, paddingTop: 14, borderTop: '1px solid hsl(var(--border))' }}><span className="muted" style={{ fontSize: '.7rem' }}>Atualizado em {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</span><div style={{ display: 'flex', gap: 8 }}><button className="button ghost" style={{ padding: '7px 9px', fontSize: '.72rem' }} onClick={onDuplicate} data-testid={`button-duplicate-curriculum-${item.id}`}><Plus size={13} /> duplicar</button><button className="button danger" style={{ padding: '7px 9px', fontSize: '.72rem' }} onClick={onDelete} data-testid={`button-delete-curriculum-${item.id}`}><Trash2 size={13} /></button></div></div></div>;
}

function CurriculoPage() {
  const query = useListCurriculums();
  const client = useQueryClient();
  const del = useDeleteCurriculum();
  const duplicate = useDuplicateCurriculum();
  const [, setLocation] = useLocation();
  const { notice, show } = useNotice();
  const list = query.data ?? [];
  if (query.isLoading) return <LoadingCards />;
  if (query.isError) return <div className="page-wrap"><ErrorState onRetry={() => query.refetch()} /></div>;
  return <div className="page-wrap fade-up"><PageHeader eyebrow="Sua base" title="Currículos que falam por você." copy="Crie uma versão honesta, clara e pronta para cada oportunidade." action={<button className="button accent" onClick={() => setLocation('/curriculo/novo')} data-testid="button-new-curriculum"><Plus size={16} /> Novo currículo</button>} />{list.length === 0 ? <div className="empty-state"><span className="empty-icon"><FileText size={21} /></span><h3>Seu primeiro currículo começa aqui</h3><p className="muted" style={{ maxWidth: 360, margin: '7px 0 18px', fontSize: '.84rem' }}>Você não precisa ter uma longa experiência. Vamos organizar o que já faz parte da sua história.</p><button className="button primary" onClick={() => setLocation('/curriculo/novo')} data-testid="button-empty-curriculum">Criar meu currículo</button></div> : <div className="three-col">{list.map(item => <CurriculumCard key={item.id} item={item} onDelete={() => { if (window.confirm('Excluir este currículo?')) del.mutate({ id: item.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListCurriculumsQueryKey() }); show('Currículo excluído.'); } }); }} onDuplicate={() => duplicate.mutate({ id: item.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListCurriculumsQueryKey() }); show('Uma cópia foi criada.'); } })} />)}</div>}<Notice text={notice} /></div>;
}

function CurriculumEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'novo';
  const existing = useGetCurriculum(params.id ?? '', { query: { enabled: !isNew, queryKey: getGetCurriculumQueryKey(params.id ?? '') } });
  const create = useCreateCurriculum();
  const update = useUpdateCurriculum();
  const [, setLocation] = useLocation();
  const { notice, show } = useNotice();
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
   const [template, setTemplate] = useState<Curriculum['template']>('moderno');
  const [data, setData] = useState<CurriculumData>(emptyCurriculumData());
  const [step, setStep] = useState(1);
  useEffect(() => { if (existing.data) { setName(existing.data.name); setObjective(existing.data.objective); setTemplate(existing.data.template); setData(existing.data.data); } }, [existing.data]);
  const updatePersonal = (field: keyof CurriculumData['personal'], value: string) => setData(prev => ({ ...prev, personal: { ...prev.personal, [field]: value } }));
  const updateEducation = (index: number, field: string, value: string) => setData(prev => ({ ...prev, education: prev.education.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateCourse = (index: number, field: string, value: string) => setData(prev => ({ ...prev, courses: prev.courses.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateExperience = (index: number, field: string, value: string) => setData(prev => ({ ...prev, experiences: prev.experiences.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const toggleSkill = (skill: string) => setData(prev => ({ ...prev, skills: prev.skills.includes(skill) ? prev.skills.filter(item => item !== skill) : [...prev.skills, skill] }));
  const suggestProfile = () => {
    const focus = objective || 'uma oportunidade de início de carreira';
    const selectedSkills = data.skills.slice(0, 3).join(', ');
    setData(prev => ({ ...prev, profile: `Busco ${focus.toLowerCase()} para colocar em prática meus conhecimentos e continuar aprendendo. Tenho interesse em desenvolver ${selectedSkills || 'minhas habilidades'} e contribuir com responsabilidade, organização e vontade de aprender.` }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = { name: name.trim() || 'Meu currículo', objective, template, data, status: 'pronto' as const };
    if (isNew) create.mutate({ data: input }, { onSuccess: item => { show('Currículo salvo.'); window.setTimeout(() => setLocation(`/curriculo/${item.id}`), 500); } });
    else update.mutate({ id: params.id ?? '', data: input }, { onSuccess: () => show('Alterações salvas.') });
  };
  if (!isNew && existing.isLoading) return <LoadingCards />;
  const stepTitles = ['Base', 'Formação', 'Diferenciais', 'Revisão'];
  const canContinue = step === 1 ? Boolean(name.trim() && data.personal.name.trim() && objective.trim()) : true;
  return <div className="page-wrap fade-up">
    <button className="button ghost" style={{ marginBottom: 25 }} onClick={() => setLocation('/curriculo')} data-testid="button-back-curriculums"><ArrowLeft size={15} /> meus currículos</button>
    <PageHeader eyebrow={isNew ? 'Novo currículo' : 'Editando currículo'} title={isNew ? 'Conte sua história.' : name} copy="Preencha apenas o que fizer sentido. Você pode voltar e ajustar quando quiser." />
    <div className="wizard-progress" aria-label="Etapas do currículo">{stepTitles.map((title, index) => <button key={title} type="button" className={`wizard-step ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`} onClick={() => index + 1 <= step || canContinue ? setStep(index + 1) : undefined}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{title}</button>)}</div>
    <form onSubmit={submit} className="two-col curriculum-editor-grid" style={{ alignItems: 'start' }}>
      <div className="card pad curriculum-form-card">
        {step === 1 && <div className="form-stack"><div><span className="eyebrow">Etapa 1 de 4</span><h2>Comece pelo essencial</h2><p className="muted form-help">Esses dados ajudam a empresa a entender quem está se apresentando.</p></div><div><label className="label" htmlFor="curriculum-name">Nome desta versão</label><input id="curriculum-name" className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Currículo para atendimento" data-testid="input-curriculum-name" /></div><div><label className="label" htmlFor="personal-name">Nome completo</label><input id="personal-name" className="input" required value={data.personal.name} onChange={e => updatePersonal('name', e.target.value)} placeholder="Como você quer aparecer no currículo" data-testid="input-personal-name" /></div><div className="form-row"><div><label className="label" htmlFor="city">Cidade e estado</label><input id="city" className="input" value={data.personal.city} onChange={e => updatePersonal('city', e.target.value)} placeholder="Ex.: Fortaleza, CE" data-testid="input-city" /></div><div><label className="label" htmlFor="phone">Telefone</label><input id="phone" className="input" value={data.personal.phone} onChange={e => updatePersonal('phone', e.target.value)} placeholder="(00) 00000-0000" data-testid="input-phone" /></div></div><div><label className="label" htmlFor="personal-email">E-mail</label><input id="personal-email" className="input" type="email" value={data.personal.email} onChange={e => updatePersonal('email', e.target.value)} placeholder="voce@email.com" data-testid="input-personal-email" /></div><div><label className="label" htmlFor="objective">Que tipo de oportunidade você procura?</label><select id="objective" className="select" required value={objective} onChange={e => setObjective(e.target.value)} data-testid="select-curriculum-objective"><option value="">Escolha uma opção</option>{objectiveOptions.map(option => <option key={option}>{option}</option>)}</select></div></div>}
        {step === 2 && <div className="form-stack"><div><span className="eyebrow">Etapa 2 de 4</span><h2>Sua formação conta</h2><p className="muted form-help">Escolha o que representa sua escolaridade hoje. Não precisa estar concluído.</p></div><div className="repeatable-list">{data.education.map((item, index) => <div className="repeatable-item" key={`education-${index}`}><div className="repeatable-title"><strong>Escolaridade {index + 1}</strong>{data.education.length > 1 && <button type="button" className="text-button" onClick={() => setData(prev => ({ ...prev, education: prev.education.filter((_, itemIndex) => itemIndex !== index) }))}>remover</button>}</div><div className="form-row"><div><label className="label" htmlFor={`education-level-${index}`}>Nível</label><select id={`education-level-${index}`} className="select" value={item.level} onChange={e => updateEducation(index, 'level', e.target.value)}><option value="">Escolha</option><option>Ensino fundamental</option><option>Ensino médio</option><option>Técnico</option><option>Superior</option></select></div><div><label className="label" htmlFor={`education-status-${index}`}>Situação</label><select id={`education-status-${index}`} className="select" value={item.status} onChange={e => updateEducation(index, 'status', e.target.value)}><option value="">Escolha</option><option>Em andamento</option><option>Concluído</option></select></div></div><div><label className="label" htmlFor={`education-institution-${index}`}>Instituição (opcional)</label><input id={`education-institution-${index}`} className="input" value={item.institution ?? ''} onChange={e => updateEducation(index, 'institution', e.target.value)} placeholder="Nome da escola ou instituição" /></div></div>)}</div><button type="button" className="button ghost" onClick={() => setData(prev => ({ ...prev, education: [...prev.education, { level: '', status: '', institution: '' }] }))}><PlusCircle size={15} /> adicionar escolaridade</button><div className="section-divider"><BookOpen size={17} /><div><strong>Cursos livres</strong><p className="muted">Inclua cursos que realmente fez, mesmo que ainda não tenha certificado.</p></div></div>{data.courses.map((item, index) => <div className="repeatable-item" key={`course-${index}`}><div className="repeatable-title"><strong>Curso {index + 1}</strong><button type="button" className="text-button" onClick={() => setData(prev => ({ ...prev, courses: prev.courses.filter((_, itemIndex) => itemIndex !== index) }))}>remover</button></div><div className="form-row"><div><label className="label" htmlFor={`course-name-${index}`}>Nome do curso</label><input id={`course-name-${index}`} className="input" value={item.name} onChange={e => updateCourse(index, 'name', e.target.value)} /></div><div><label className="label" htmlFor={`course-year-${index}`}>Ano</label><input id={`course-year-${index}`} className="input" value={item.year} onChange={e => updateCourse(index, 'year', e.target.value)} placeholder="2026" /></div></div><div><label className="label" htmlFor={`course-institution-${index}`}>Instituição</label><input id={`course-institution-${index}`} className="input" value={item.institution} onChange={e => updateCourse(index, 'institution', e.target.value)} /></div></div>)}<button type="button" className="button ghost" onClick={() => setData(prev => ({ ...prev, courses: [...prev.courses, { name: '', institution: '', year: '' }] }))}><PlusCircle size={15} /> adicionar curso</button></div>}
        {step === 3 && <div className="form-stack"><div><span className="eyebrow">Etapa 3 de 4</span><h2>Mostre seus diferenciais</h2><p className="muted form-help">Selecione apenas habilidades que combinam de verdade com você. Experiência não é obrigatória.</p></div><div><label className="label">Habilidades</label><div className="suggestion-chips">{skillSuggestions.map(skill => <button type="button" key={skill} className={`suggestion-chip ${data.skills.includes(skill) ? 'selected' : ''}`} onClick={() => toggleSkill(skill)}>{data.skills.includes(skill) && <Check size={13} />}{skill}</button>)}</div><label className="label" htmlFor="skills-custom" style={{ marginTop: 13 }}>Adicionar outra habilidade</label><input id="skills-custom" className="input" value={data.skills.filter(skill => !skillSuggestions.includes(skill)).join(', ')} onChange={e => setData(prev => ({ ...prev, skills: [...prev.skills.filter(skill => skillSuggestions.includes(skill)), ...e.target.value.split(',').map(item => item.trim()).filter(Boolean)] }))} placeholder="Separe por vírgulas" /></div><div><div className="field-label-row"><label className="label" htmlFor="profile">Perfil profissional</label><button type="button" className="text-button help-action" onClick={suggestProfile}><Lightbulb size={14} /> não sei o que escrever</button></div><textarea id="profile" className="textarea" value={data.profile} onChange={e => setData(prev => ({ ...prev, profile: e.target.value }))} placeholder="Escreva 2 ou 3 linhas sobre seus interesses, pontos fortes e o que busca." data-testid="input-curriculum-profile" /></div><div className="section-divider"><BriefcaseBusiness size={17} /><div><strong>Experiências opcionais</strong><p className="muted">Adicione somente experiências que realmente aconteceram — vale projeto escolar, voluntariado ou negócio familiar.</p></div></div>{data.experiences.map((item, index) => <div className="repeatable-item" key={`experience-${index}`}><div className="repeatable-title"><strong>Experiência {index + 1}</strong><button type="button" className="text-button" onClick={() => setData(prev => ({ ...prev, experiences: prev.experiences.filter((_, itemIndex) => itemIndex !== index) }))}>remover</button></div><div><label className="label" htmlFor={`experience-type-${index}`}>Tipo</label><select id={`experience-type-${index}`} className="select" value={item.type} onChange={e => updateExperience(index, 'type', e.target.value)}><option value="">Escolha uma opção</option>{experienceTypes.map(type => <option key={type}>{type}</option>)}</select></div><div><label className="label" htmlFor={`experience-description-${index}`}>O que você fez?</label><textarea id={`experience-description-${index}`} className="textarea" value={item.description} onChange={e => updateExperience(index, 'description', e.target.value)} placeholder="Descreva sua participação de forma simples e verdadeira." /></div></div>)}<button type="button" className="button ghost" onClick={() => setData(prev => ({ ...prev, experiences: [...prev.experiences, { type: '', description: '' }] }))}><PlusCircle size={15} /> adicionar experiência</button></div>}
        {step === 4 && <div className="form-stack"><div><span className="eyebrow">Etapa 4 de 4</span><h2>Revise antes de salvar</h2><p className="muted form-help">Seu currículo é uma apresentação, não uma promessa. Confira tudo e escolha o modelo que combina com você.</p></div><div><label className="label">Modelo visual</label><div className="template-options">{(['moderno', 'classico', 'minimalista'] as const).map(option => <button type="button" key={option} className={`template-option ${template === option ? 'selected' : ''}`} onClick={() => setTemplate(option)}><span className={`template-mini template-mini-${option}`} /><span><strong>{option[0].toUpperCase() + option.slice(1)}</strong><small>{option === 'moderno' ? 'destaques sutis' : option === 'classico' ? 'tradicional e direto' : 'limpo e espaçoso'}</small></span>{template === option && <Check size={15} />}</button>)}</div></div><div className="review-notice"><Check size={17} /><span><strong>Pronto para revisar</strong><br />Você pode voltar a qualquer etapa antes de salvar.</span></div></div>}
        <div className="wizard-actions">{step > 1 && <button type="button" className="button ghost" onClick={() => setStep(value => value - 1)}><ArrowLeft size={15} /> voltar</button>}{step < 4 ? <button type="button" className="button primary" disabled={!canContinue} onClick={() => setStep(value => value + 1)} data-testid="button-next-curriculum-step">continuar <ArrowRight size={15} /></button> : <button className="button accent" type="submit" disabled={create.isPending || update.isPending} data-testid="button-save-curriculum">{create.isPending || update.isPending ? 'Salvando...' : 'Salvar currículo'} <Check size={15} /></button>}</div>
      </div>
      <div className="curriculum-preview-column"><div className="preview-toolbar"><div><span className="eyebrow">Visualização</span><strong>Assim ele aparecerá para uma empresa</strong></div><button type="button" className="button ghost" onClick={() => window.print()}><Printer size={15} /> imprimir / PDF</button></div><CurriculumPreview name={name} objective={objective} template={template} data={data} /><p className="muted preview-tip"><GraduationCap size={14} /> Não incluí foto, CPF ou gráficos: para o primeiro emprego, clareza vale mais.</p></div>
    </form>
    <Notice text={notice} />
  </div>;
}

function EntrevistaPage() {
  const listQuery = useListInterviews();
  const create = useCreateInterview();
  const send = useSendInterviewMessage();
  const finish = useFinishInterview();
  const client = useQueryClient();
  const [active, setActive] = useState<Interview | null>(null);
  const [role, setRole] = useState('');
  const [type, setType] = useState('primeiro emprego');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<any>(null);
  const { notice, show } = useNotice();
  const history = listQuery.data ?? [];
  const start = (event: FormEvent) => { event.preventDefault(); create.mutate({ data: { role, type } }, { onSuccess: item => { setActive(item); setResult(null); client.invalidateQueries({ queryKey: getListInterviewsQueryKey() }); } }); };
  const next = (event: FormEvent) => { event.preventDefault(); if (!active) return; send.mutate({ id: active.id, data: { answer } }, { onSuccess: message => { setAnswer(''); if (message.completed) finish.mutate({ id: active.id }, { onSuccess: data => { setResult(data); setActive(null); client.invalidateQueries({ queryKey: getListInterviewsQueryKey() }); } }); else setActive(prev => prev ? { ...prev, question: message.question ?? '', questionNumber: message.questionNumber } : prev); } }); };
  return <div className="page-wrap fade-up"><PageHeader eyebrow="Treino sem pressão" title="Entrevista, uma pergunta por vez." copy="Pratique o raciocínio e encontre suas palavras antes da conversa real." />{active ? <div className="card pad" style={{ maxWidth: 760, margin: '0 auto' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 27 }}><span className="pill yellow">{active.role}</span><span className="muted" style={{ fontSize: '.75rem' }}>pergunta {active.questionNumber} de {active.totalQuestions}</span></div><div className="progress-track" style={{ marginBottom: 34 }}><div className="progress-fill" style={{ width: `${(active.questionNumber / active.totalQuestions) * 100}%` }} /></div><h2 className="display-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.3rem)', marginBottom: 25 }}>{active.question}</h2><form onSubmit={next}><textarea className="textarea" required minLength={2} maxLength={2000} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Escreva do seu jeito. Não existe resposta perfeita." data-testid="input-interview-answer" /><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}><button type="button" className="button ghost" onClick={() => setActive(null)} data-testid="button-exit-interview">Sair da prática</button><button className="button primary" type="submit" disabled={send.isPending || finish.isPending} data-testid="button-send-answer">{send.isPending ? 'Enviando...' : 'Continuar'} <ArrowRight size={15} /></button></div></form></div> : result ? <div className="card pad" style={{ maxWidth: 760, margin: '0 auto' }}><span className="eyebrow">Prática concluída</span><h2 className="display-title" style={{ fontSize: '3.5rem', margin: '10px 0' }}>{result.classification === 'muito-bom' ? 'Muito bom.' : result.classification === 'bom' ? 'Bom caminho.' : 'Vamos praticar mais.'}</h2><p className="muted" style={{ marginBottom: 25 }}>O feedback existe para orientar sua próxima tentativa, não para definir você.</p><div className="three-col">{[['Você foi bem', result.didWell], ['Para desenvolver', result.improve], ['Pratique', result.practice]].map(([title, items]) => <div key={title as string}><h3 style={{ marginBottom: 10 }}>{title as string}</h3>{(items as string[]).map((item, i) => <p key={i} className="muted" style={{ fontSize: '.8rem', lineHeight: 1.55, marginBottom: 8 }}>• {item}</p>)}</div>)}</div><button className="button accent" style={{ marginTop: 25 }} onClick={() => setResult(null)} data-testid="button-new-interview">Praticar novamente <RotateCcw size={15} /></button></div> : <div className="two-col"><form className="card pad" onSubmit={start} style={{ display: 'grid', gap: 17, alignSelf: 'start' }}><span className="eyebrow">Nova simulação</span><h2 style={{ marginTop: -6 }}>Prepare uma conversa real</h2><div><label className="label" htmlFor="role">Para qual função?</label><input id="role" className="input" required value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: atendente de loja" data-testid="input-interview-role" /></div><div><label className="label" htmlFor="interview-type">Contexto</label><select id="interview-type" className="select" value={type} onChange={e => setType(e.target.value)} data-testid="select-interview-type"><option>primeiro emprego</option><option>estágio</option><option>jovem aprendiz</option></select></div><button className="button primary" type="submit" disabled={create.isPending} data-testid="button-start-interview">{create.isPending ? 'Preparando...' : 'Começar prática'} <ArrowRight size={15} /></button></form><div className="card pad"><div className="section-head"><div><h2>Suas práticas</h2><p>O progresso aparece quando você se permite tentar.</p></div></div>{history.length ? history.slice(0, 5).map(item => <div key={item.id} className="activity-item"><span className="activity-dot" /><div><p style={{ fontSize: '.84rem', fontWeight: 600 }}>{item.role}</p><span className="muted" style={{ fontSize: '.72rem' }}>{item.status === 'completed' ? 'Concluída' : 'Em andamento'} · {new Date(item.startedAt).toLocaleDateString('pt-BR')}</span></div></div>) : <div className="empty-state" style={{ padding: '34px 12px' }}><span className="empty-icon"><ClipboardCheck size={19} /></span><p className="muted" style={{ fontSize: '.8rem' }}>Sua primeira prática estará aqui.</p></div>}</div></div>}<Notice text={notice} /></div>;
}

function AnalisadorPage() {
  const create = useCreateJobAnalysis();
  const remove = useDeleteJobAnalysis();
  const historyQuery = useListJobAnalyses();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const client = useQueryClient();
  const { notice, show } = useNotice();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!company.trim() && !role.trim() && !description.trim()) {
      show('Informe pelo menos o cargo, a empresa ou a descrição da vaga.');
      return;
    }
    create.mutate({ data: { company: company.trim() || undefined, role: role.trim() || undefined, description: description.trim() || undefined } }, {
      onSuccess: data => { setAnalysis(data); setDescription(''); show('Análise salva no seu histórico.'); client.invalidateQueries({ queryKey: getListJobAnalysesQueryKey() }); },
      onError: () => show('Não foi possível analisar agora. Tente novamente em instantes.'),
    });
  };
  const scoreRows = analysis ? [
    ['Escolaridade', analysis.scoreBreakdown.education],
    ['Experiência', analysis.scoreBreakdown.experience],
    ['Habilidades', analysis.scoreBreakdown.skills],
    ['Conhecimentos', analysis.scoreBreakdown.knowledge],
    ['Requisitos obrigatórios', analysis.scoreBreakdown.mandatory],
  ] as const : [];
  const list = (items: string[], symbol = '•') => items.length
    ? items.map((item, index) => <p key={`${item}-${index}`} style={{ fontSize: '.8rem', lineHeight: 1.5, margin: '0 0 8px' }}>{symbol} {item}</p>)
    : <p className="muted" style={{ fontSize: '.8rem' }}>Nada identificado nesta análise.</p>;
  return <div className="page-wrap fade-up">
    <PageHeader eyebrow="Escolha com intenção" title="Entenda se a vaga combina com você." copy="Compare os requisitos de uma oportunidade com o que já está no seu currículo. O índice orienta sua preparação — não prevê contratação." />
    <div className="two-col">
      <form className="card pad" onSubmit={submit} style={{ display: 'grid', gap: 16, alignSelf: 'start' }}>
        <div><span className="eyebrow">Nova análise</span><h2 style={{ margin: '7px 0 5px' }}>Comece pelo que você sabe</h2><p className="muted" style={{ fontSize: '.8rem', lineHeight: 1.55 }}>Cargo e empresa já ajudam. A descrição deixa a comparação mais completa.</p></div>
        <div><label className="label" htmlFor="job-company">Empresa <span className="muted">(opcional)</span></label><input id="job-company" className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex.: Mercado Central" data-testid="input-job-company" /></div>
        <div><label className="label" htmlFor="job-role">Cargo <span className="muted">(opcional)</span></label><input id="job-role" className="input" value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: assistente de atendimento" data-testid="input-job-role" /></div>
        <div><label className="label" htmlFor="job-description">Descrição da vaga <span className="muted">(opcional)</span></label><textarea id="job-description" className="textarea" style={{ minHeight: 230 }} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Cole aqui os requisitos, responsabilidades e benefícios..." data-testid="input-job-description" /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><span className="muted" style={{ fontSize: '.7rem' }}>{description.length}/10.000 caracteres</span><button className="button accent" type="submit" disabled={create.isPending} data-testid="button-analyze-job">{create.isPending ? 'Analisando...' : 'Analisar vaga'} <Sparkles size={15} /></button></div>
        <p className="muted" style={{ fontSize: '.7rem', lineHeight: 1.5 }}>Usamos apenas informações disponíveis no seu currículo e nas suas práticas. Quando faltarem dados, isso aparece como limitação — não como ausência de habilidade.</p>
      </form>
      {analysis ? <div className="card pad" data-testid="card-job-analysis">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}><div><span className="eyebrow">Compatibilidade com a vaga</span><h2 style={{ margin: '7px 0 3px' }}>{analysis.role}</h2><p className="muted" style={{ fontSize: '.8rem' }}>{analysis.company}{analysis.location ? ` · ${analysis.location}` : ''}</p></div><div style={{ textAlign: 'right' }}><strong style={{ display: 'block', fontFamily: 'var(--app-font-serif)', fontSize: '2.2rem', letterSpacing: '-.06em' }}>{analysis.fit}/100</strong><span className="pill yellow">{analysis.compatibilityLabel}</span></div></div>
        <div className="progress-track" style={{ margin: '20px 0 14px' }}><div className="progress-fill" style={{ width: `${analysis.fit}%` }} /></div>
        {analysis.compatibilityLabel === 'Descrição inválida' && <div className="analysis-warning" data-testid="job-description-rejected"><AlertTriangle size={18} /><div><strong>Descrição reprovada</strong><p style={{ marginTop: 5, fontSize: '.8rem', lineHeight: 1.5 }}>A nota ficou em 0 porque o texto não parece uma descrição de vaga. Revise o conteúdo e tente novamente com a oportunidade real.</p></div></div>}
        <p className="muted" style={{ fontSize: '.74rem', lineHeight: 1.55 }}>Este índice compara seu perfil com os requisitos informados na vaga. Ele não prevê a decisão da empresa.</p>
        {(analysis.salary || analysis.education || analysis.experience) && <div className="analysis-facts">{analysis.salary && <span><strong>Salário</strong>{analysis.salary}</span>}{analysis.education && <span><strong>Escolaridade</strong>{analysis.education}</span>}{analysis.experience && <span><strong>Experiência</strong>{analysis.experience}</span>}</div>}
        <p style={{ lineHeight: 1.65, fontSize: '.88rem', marginTop: 20 }}>{analysis.summary}</p>
        <div className="analysis-score-grid">{scoreRows.map(([label, value]) => <div key={label}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', marginBottom: 5 }}><span>{label}</span><strong>{value}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${value}%` }} /></div></div>)}</div>
        <div className="analysis-columns" style={{ marginTop: 26 }}><div><h3 style={{ marginBottom: 10 }}>Você atende</h3>{list(analysis.strengths, '✓')}</div><div><h3 style={{ marginBottom: 10 }}>Pode melhorar</h3>{list(analysis.partial, '!')}</div><div><h3 style={{ marginBottom: 10 }}>Não identificado</h3>{list(analysis.notFound, '?')}</div></div>
        {analysis.recommendations.length > 0 && <div className="analysis-callout"><strong>Antes de se candidatar, você pode melhorar estes pontos:</strong><div style={{ marginTop: 10 }}>{list(analysis.recommendations, '→')}</div></div>}
        {analysis.attentionSignals.length > 0 && <div className="analysis-warning"><AlertTriangle size={18} /><div><strong>Vale verificar esta informação antes de prosseguir.</strong>{list(analysis.attentionSignals, '•')}</div></div>}
        {analysis.limitations.length > 0 && <div className="analysis-limitations"><strong>Limites desta leitura</strong>{list(analysis.limitations, 'ℹ')}</div>}
      </div> : <div className="card pad"><div className="empty-state" style={{ border: 0, padding: '42px 15px' }}><span className="empty-icon"><BarChart3 size={20} /></span><h3>Uma análise sem julgamento</h3><p className="muted" style={{ fontSize: '.82rem', maxWidth: 260, marginTop: 7 }}>O objetivo é ajudar você a escolher melhor e se preparar com honestidade.</p></div></div>}
    </div>
    <section style={{ marginTop: 48 }}><div className="section-head"><div><span className="eyebrow">Seu histórico</span><h2 style={{ marginTop: 6 }}>Análises salvas</h2></div><span className="pill green">{historyQuery.data?.length ?? 0} salvas</span></div>
      {historyQuery.data?.length ? <div className="three-col">{historyQuery.data.slice(0, 9).map(item => <div className="card pad" key={item.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span className="pill yellow">{item.fit}/100</span><button className="button danger" style={{ padding: 7 }} aria-label={`Excluir análise de ${item.role}`} onClick={() => { if (window.confirm('Excluir esta análise?')) remove.mutate({ id: item.id }, { onSuccess: () => { if (analysis?.id === item.id) setAnalysis(null); client.invalidateQueries({ queryKey: getListJobAnalysesQueryKey() }); show('Análise excluída.'); } }); }}><Trash2 size={13} /></button></div><button className="history-analysis" onClick={() => setAnalysis(item)}><h3 style={{ margin: '13px 0 5px', textAlign: 'left' }}>{item.role}</h3><p className="muted" style={{ fontSize: '.75rem', textAlign: 'left' }}>{item.company}</p><span className="text-button">reabrir análise <ArrowRight size={13} /></span></button></div>)}</div> : <p className="muted" style={{ fontSize: '.84rem' }}>As vagas analisadas por você aparecerão aqui.</p>}
    </section><Notice text={notice} /></div>;
}

const statusLabels: Record<Application['status'], string> = {
  quero_me_candidatar: 'Quero me candidatar',
  enviada: 'Candidatura enviada',
  aguardando: 'Aguardando resposta',
  entrevista: 'Entrevista',
  segunda_etapa: 'Segunda etapa',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  encerrada: 'Encerrada',
};

const kanbanGroups = [
  { label: 'Planejamento', statuses: ['quero_me_candidatar', 'enviada'] as Application['status'][] },
  { label: 'Aguardando', statuses: ['aguardando'] as Application['status'][] },
  { label: 'Conversas', statuses: ['entrevista', 'segunda_etapa'] as Application['status'][] },
  { label: 'Resultado', statuses: ['aprovado', 'rejeitado', 'encerrada'] as Application['status'][] },
];

function localDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString('pt-BR') : value;
}

function CandidaturasPage() {
  const query = useListApplications();
  const curriculumsQuery = useListCurriculums();
  const interviewsQuery = useListInterviews();
  const analysesQuery = useListJobAnalyses();
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const del = useDeleteApplication();
  const client = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().slice(0, 10));
  const [jobUrl, setJobUrl] = useState('');
  const [salary, setSalary] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState<Application['status']>('quero_me_candidatar');
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | Application['status']>('todos');
  const [companyFilter, setCompanyFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const { notice, show } = useNotice();
  const list = query.data ?? [];
  const openForm = (item?: Application) => {
    setEditing(item ?? null);
    setCompany(item?.company ?? '');
    setRole(item?.role ?? '');
    setLocation(item?.location ?? '');
    setAppliedAt(item?.appliedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setJobUrl(item?.jobUrl ?? '');
    setSalary(item?.salary ?? '');
    setFollowUpDate(item?.followUpDate ?? '');
    setStatus(item?.status ?? 'quero_me_candidatar');
    setNotes(item?.notes ?? '');
    setFormOpen(true);
    window.setTimeout(() => document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const data = { company: company.trim(), role: role.trim(), location: location.trim(), status, appliedAt, jobUrl: jobUrl.trim(), salary: salary.trim(), notes: notes.trim(), followUpDate };
    const onSuccess = () => { closeForm(); client.invalidateQueries({ queryKey: getListApplicationsQueryKey() }); show(editing ? 'Candidatura atualizada.' : 'Candidatura adicionada.'); };
    editing ? update.mutate({ id: editing.id, data }, { onSuccess }) : create.mutate({ data }, { onSuccess });
  };
  const filtered = list.filter(item =>
    (statusFilter === 'todos' || item.status === statusFilter) &&
    (!companyFilter || item.company.toLocaleLowerCase().includes(companyFilter.toLocaleLowerCase())) &&
    (!roleFilter || item.role.toLocaleLowerCase().includes(roleFilter.toLocaleLowerCase())) &&
    (!dateFilter || item.appliedAt.slice(0, 10) === dateFilter),
  );
  const interviews = list.filter(item => item.status === 'entrevista' || item.status === 'segunda_etapa').length;
  const approved = list.filter(item => item.status === 'aprovado').length;
  const closed = list.filter(item => item.status === 'rejeitado' || item.status === 'encerrada').length;
  const followUps = list.filter(item => item.followUpDate && item.followUpDate >= new Date().toISOString().slice(0, 10) && item.followUpDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const completedInterviews = (interviewsQuery.data ?? []).some(item => item.status === 'completed');
  const plan = [
    { label: 'Completar perfil', completed: (curriculumsQuery.data ?? []).some(item => Boolean(item.data.personal.name)) },
    { label: 'Criar currículo', completed: (curriculumsQuery.data ?? []).length > 0 },
    { label: 'Treinar entrevista', completed: completedInterviews },
    { label: 'Analisar primeira vaga', completed: (analysesQuery.data ?? []).length > 0 },
    { label: 'Enviar primeira candidatura', completed: list.some(item => item.status !== 'quero_me_candidatar') },
    { label: 'Fazer acompanhamento', completed: list.some(item => Boolean(item.followUpDate)) },
  ];
  const planProgress = Math.round(plan.filter(item => item.completed).length / plan.length * 100);
  const achievementLabels = [
    ['Primeiro currículo', (curriculumsQuery.data ?? []).length > 0],
    ['Primeira entrevista', completedInterviews],
    ['Primeira análise', (analysesQuery.data ?? []).length > 0],
    ['Primeira candidatura', list.length > 0],
    ['5 candidaturas', list.length >= 5],
    ['10 candidaturas', list.length >= 10],
  ] as const;
  return <div className="page-wrap fade-up">
    <PageHeader eyebrow="Movimento real" title="Suas candidaturas, no seu ritmo." copy="Registrar também é avançar. Organize cada oportunidade sem perder de vista o próximo passo." action={<button className="button accent" onClick={() => openForm()} data-testid="button-new-application"><Plus size={16} /> Adicionar candidatura</button>} />
    <div className="stat-grid application-stats" style={{ marginBottom: 18 }}>
      {[
        ['Total', list.length, 'registros'],
        ['Aguardando resposta', list.filter(item => item.status === 'aguardando').length, 'para acompanhar'],
        ['Entrevistas', interviews, 'em conversa'],
        ['Aprovadas', approved, 'boas notícias'],
        ['Encerradas', closed, 'finalizadas'],
      ].map(([label, value, hint]) => <div className="card stat-card" key={label as string}><span className="eyebrow">{label as string}</span><div className="stat-value">{value as number}</div><span className="muted" style={{ fontSize: '.76rem' }}>{hint as string}</span></div>)}
    </div>
    {followUps.length > 0 && <div className="analysis-callout follow-up-banner"><strong>Você tem {followUps.length} acompanhamento{followUps.length > 1 ? 's' : ''} próximo{followUps.length > 1 ? 's' : ''}.</strong><span className="muted"> Verifique {followUps.slice(0, 2).map(item => `${item.company} em ${localDate(item.followUpDate)}`).join(' e ')}.</span></div>}
    <div className="two-col application-top-grid" style={{ marginTop: 18, alignItems: 'start' }}>
      <div className="card pad"><div className="section-head"><div><span className="eyebrow">Meu plano</span><h2 style={{ marginTop: 6 }}>Um passo de cada vez</h2><p>O progresso acompanha o que você realmente fez.</p></div><span className="pill yellow">{planProgress}%</span></div><div className="progress-track" style={{ marginBottom: 12 }}><div className="progress-fill" style={{ width: `${planProgress}%` }} /></div>{plan.map(item => <div className="check-item" key={item.label}><span className={`check-dot ${item.completed ? 'done' : ''}`}>{item.completed && <Check size={13} strokeWidth={3} />}</span><span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'hsl(var(--muted-foreground))' : undefined }}>{item.label}</span></div>)}</div>
      <div className="card pad"><div className="section-head"><div><span className="eyebrow">Conquistas</span><h2 style={{ marginTop: 6 }}>Seu avanço</h2><p>Sem competição: só sinais de continuidade.</p></div></div><div className="achievement-list">{achievementLabels.map(([label, unlocked]) => <span className={`pill ${unlocked ? 'yellow' : ''}`} style={{ opacity: unlocked ? 1 : .48 }} key={label}>{unlocked ? '✓ ' : ''}{label}</span>)}</div></div>
    </div>
    {formOpen && <div id="application-form" className="card pad application-form-card" style={{ marginTop: 20 }}><div className="section-head"><div><span className="eyebrow">{editing ? 'Editar registro' : 'Nova candidatura'}</span><h2 style={{ marginTop: 6 }}>{editing ? 'Ajustar candidatura' : 'Guarde os detalhes da oportunidade'}</h2></div><button type="button" className="button ghost" style={{ padding: 8 }} onClick={closeForm} data-testid="button-close-application-form"><X size={16} /></button></div><form onSubmit={submit} style={{ display: 'grid', gap: 16 }}><div className="form-row"><div><label className="label" htmlFor="company">Empresa</label><input id="company" className="input" required value={company} onChange={e => setCompany(e.target.value)} data-testid="input-application-company" /></div><div><label className="label" htmlFor="application-role">Cargo</label><input id="application-role" className="input" required value={role} onChange={e => setRole(e.target.value)} data-testid="input-application-role" /></div></div><div className="form-row"><div><label className="label" htmlFor="application-location">Localização</label><input id="application-location" className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex.: Fortaleza, CE" /></div><div><label className="label" htmlFor="application-date">Data da candidatura</label><input id="application-date" className="input" type="date" required value={appliedAt} onChange={e => setAppliedAt(e.target.value)} /></div></div><div className="form-row"><div><label className="label" htmlFor="application-status">Status</label><select id="application-status" className="select" value={status} onChange={e => setStatus(e.target.value as Application['status'])} data-testid="select-application-status">{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label className="label" htmlFor="application-follow-up">Próximo acompanhamento <span className="muted">(opcional)</span></label><input id="application-follow-up" className="input" type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} /></div></div><div className="form-row"><div><label className="label" htmlFor="application-url">Link da vaga <span className="muted">(opcional)</span></label><input id="application-url" className="input" type="url" value={jobUrl} onChange={e => setJobUrl(e.target.value)} placeholder="https://..." /></div><div><label className="label" htmlFor="application-salary">Salário ou bolsa <span className="muted">(opcional)</span></label><input id="application-salary" className="input" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Ex.: R$ 1.500" /></div></div><div><label className="label" htmlFor="application-notes">Observações</label><textarea id="application-notes" className="textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Próximo contato, horário, detalhes importantes..." /></div><div><button className="button primary" type="submit" disabled={create.isPending || update.isPending} data-testid="button-save-application">{create.isPending || update.isPending ? 'Salvando...' : 'Salvar candidatura'} <Check size={15} /></button></div></form></div>}
     {query.isLoading ? <LoadingCards /> : query.isError ? <ErrorState onRetry={() => query.refetch()} /> : <><div className="card pad application-filters"><div className="section-head"><div><span className="eyebrow">Organização</span><h2 style={{ marginTop: 6 }}>Todas as oportunidades</h2></div><span className="muted" style={{ fontSize: '.76rem' }}>{filtered.length} de {list.length}</span></div><div className="filter-grid"><select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filtrar por status"><option value="todos">Todos os status</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input className="input" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} placeholder="Filtrar empresa" aria-label="Filtrar empresa" /><input className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} placeholder="Filtrar cargo" aria-label="Filtrar cargo" /><input className="input" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} aria-label="Filtrar por data" /></div></div>{filtered.length === 0 ? <div className="empty-state" style={{ marginTop: 18 }}><span className="empty-icon"><BriefcaseBusiness size={20} /></span><h3>{list.length ? 'Nenhuma candidatura combina com os filtros' : 'Ainda não há candidaturas registradas.'}</h3><p className="muted" style={{ margin: '7px 0 18px', fontSize: '.83rem' }}>{list.length ? 'Tente ajustar os filtros para encontrar um registro.' : 'Quando você começar a se candidatar, poderá organizar tudo aqui.'}</p>{!list.length && <button className="button primary" onClick={() => openForm()} data-testid="button-empty-application">+ Adicionar candidatura</button>}</div> : <div className="kanban-grid" style={{ marginTop: 18 }}>{kanbanGroups.map(group => <section className="kanban-column" key={group.label}><div className="kanban-column-head"><div><span className="eyebrow">{group.label}</span><strong>{filtered.filter(item => group.statuses.includes(item.status)).length}</strong></div></div>{filtered.filter(item => group.statuses.includes(item.status)).map(item => <article className="kanban-card" key={item.id} data-testid={`card-application-${item.id}`}><div className="kanban-card-top"><span className={`pill ${item.status === 'aprovado' ? 'green' : item.status === 'rejeitado' || item.status === 'encerrada' ? 'red' : 'yellow'}`}>{statusLabels[item.status]}</span><button className="text-button" onClick={() => openForm(item)} aria-label={`Editar candidatura de ${item.company}`}><Pencil size={13} /></button></div><h3>{item.company}</h3><p>{item.role}</p>{item.location && <span className="muted application-meta">{item.location}</span>}<span className="muted application-meta">{localDate(item.appliedAt)}</span>{item.followUpDate && <span className="application-follow-up">Acompanhar em {localDate(item.followUpDate)}</span>}{item.jobUrl && <a className="text-button" href={item.jobUrl} target="_blank" rel="noreferrer">abrir vaga <ArrowRight size={12} /></a>}<div className="kanban-card-actions"><select className="select" value={item.status} onChange={e => update.mutate({ id: item.id, data: { status: e.target.value as Application['status'] } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListApplicationsQueryKey() }); show('Status atualizado.'); } })} aria-label={`Status de ${item.company}`}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button className="button danger" style={{ padding: 8 }} onClick={() => { if (window.confirm('Excluir esta candidatura?')) del.mutate({ id: item.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListApplicationsQueryKey() }); show('Candidatura excluída.'); } }); }} aria-label={`Excluir candidatura de ${item.company}`}><Trash2 size={14} /></button></div></article>)}</section>)}</div>}</>}<Notice text={notice} /></div>;
}

function ConfigPage() {
  const [, setLocation] = useLocation();
  const { notice, show } = useNotice();
  const storedUser = getStoredUser();
  const [name, setName] = useState(storedUser?.name ?? '');
  const [email, setEmail] = useState(storedUser?.email ?? '');
  const [notifications, setNotifications] = useState(true);
  return <div className="page-wrap fade-up"><PageHeader eyebrow="Seu espaço" title="Configurações que cabem em você." copy="Ajuste sua conta e o jeito como você quer acompanhar sua jornada." /><div className="two-col"><div className="card pad"><span className="eyebrow">Perfil</span><h2 style={{ margin: '7px 0 20px' }}>Como podemos encontrar você</h2><form onSubmit={e => { e.preventDefault(); show('Preferências salvas.'); }} style={{ display: 'grid', gap: 16 }}><div><label className="label" htmlFor="settings-name">Nome</label><input id="settings-name" className="input" value={name} onChange={e => setName(e.target.value)} data-testid="input-settings-name" /></div><div><label className="label" htmlFor="settings-email">E-mail</label><input id="settings-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-settings-email" /></div><button className="button primary" type="submit" data-testid="button-save-settings">Salvar alterações</button></form></div><div style={{ display: 'grid', gap: 18 }}><div className="card pad"><span className="eyebrow">Preferências</span><h2 style={{ margin: '7px 0 20px' }}>Como acompanhar</h2><button type="button" onClick={() => { setNotifications(v => !v); show(notifications ? 'Lembretes pausados.' : 'Lembretes ativados.'); }} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} data-testid="button-toggle-notifications"><span><strong style={{ display: 'block', fontSize: '.88rem' }}>Lembretes de jornada</strong><span className="muted" style={{ fontSize: '.75rem' }}>Receba um empurrão quando fizer sentido.</span></span><span className={`pill ${notifications ? 'yellow' : ''}`}>{notifications ? 'Ativados' : 'Pausados'}</span></button></div><div className="card pad"><span className="eyebrow">Conta</span><h2 style={{ margin: '7px 0 12px' }}>Precisa sair?</h2><button className="button ghost" onClick={async () => { await signOut(); setLocation('/login'); }} data-testid="button-logout"><LogOut size={15} /> Sair da conta</button></div></div></div><Notice text={notice} /></div>;
}

function CheckoutPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const { notice, show } = useNotice();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    try {
      const checkoutUrl = await startCheckout(name, email);
      window.location.assign(checkoutUrl);
    } catch (error) {
      show(error instanceof Error ? error.message : 'Não foi possível abrir o checkout.');
    } finally {
      setWorking(false);
    }
  };
  return <main className="auth-page"><aside className="auth-aside"><Link href="/" data-testid="link-checkout-logo"><Logo inverse /></Link><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Seu próximo capítulo</span><h1 className="display-title">Um investimento pequeno. Um começo mais claro.</h1></div><p style={{ color: 'hsl(var(--primary-foreground) / .62)', fontSize: '.8rem' }}>Pagamento seguro e acesso sem mensalidade.</p></aside><section className="auth-panel"><div className="auth-form"><span className="eyebrow">Pré-checkout</span><h1>Continue para o pagamento.</h1><p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65, marginTop: 12 }}>Preencha seus dados. Na próxima etapa, você concluirá o pagamento em um ambiente seguro. Nenhum dado de cartão é coletado aqui.</p><div className="card pad" style={{ margin: '24px 0 18px' }}><div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 17, borderBottom: '1px solid hsl(var(--border))' }}><div><strong>Primeiro Emprego</strong><p className="muted" style={{ fontSize: '.77rem', marginTop: 5 }}>Pagamento único</p></div><strong data-testid="text-checkout-price">R$ 16,90</strong></div><div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 17 }}><span className="muted" style={{ fontSize: '.8rem' }}>Total</span><strong>R$ 16,90</strong></div></div><form onSubmit={submit} style={{ display: 'grid', gap: 15 }}><div><label className="label" htmlFor="checkout-name">Nome</label><input id="checkout-name" className="input" required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" data-testid="input-checkout-name" /></div><div><label className="label" htmlFor="checkout-email">E-mail</label><input id="checkout-email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" data-testid="input-checkout-email" /></div><button className="button accent" style={{ width: '100%' }} disabled={working} aria-busy={working} data-testid="button-finish-purchase">{working ? 'Abrindo ambiente seguro...' : 'Continuar para pagamento'} <ArrowRight size={16} /></button></form><p className="muted" style={{ textAlign: 'center', fontSize: '.7rem', marginTop: 15 }}>Você verá todas as condições antes de confirmar. <Link href="/termos-de-uso" style={{ textDecoration: 'underline' }} data-testid="link-checkout-terms">Termos de uso</Link>.</p></div></section><Notice text={notice} /></main>;
}

function FirstAccessPage() {
  return <main className="auth-page"><aside className="auth-aside"><Link href="/" data-testid="link-first-access-logo"><Logo inverse /></Link><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Quase lá</span><h1 className="display-title">Seu espaço está esperando por você.</h1></div><p style={{ color: 'hsl(var(--primary-foreground) / .62)', fontSize: '.8rem' }}>Mais clareza, sem pressa.</p></aside><section className="auth-panel"><div className="auth-form"><span className="eyebrow">Primeiro acesso</span><h1>Vamos confirmar seu acesso.</h1><p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65, marginTop: 12 }}>Conclua sua compra para liberar seu espaço e começar pelo passo que fizer mais sentido.</p><div className="card pad" style={{ margin: '28px 0', background: 'hsl(var(--secondary))' }}><div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span className="empty-icon" style={{ width: 38, height: 38, borderRadius: 11, flex: 'none' }}><LockKeyhole size={17} /></span><div><strong>Uma compra, sem mensalidade</strong><p className="muted" style={{ fontSize: '.78rem', lineHeight: 1.55, marginTop: 5 }}>O acesso é único e transparente. Não prometemos emprego — oferecemos ferramentas para você se preparar melhor.</p></div></div></div><Link href="/checkout" className="button accent" style={{ width: '100%' }} data-testid="link-go-checkout">Continuar para compra <ArrowRight size={15} /></Link><Link href="/login" className="button ghost" style={{ width: '100%', marginTop: 10 }} data-testid="link-back-login">Voltar para entrar</Link></div></section></main>;
}

function PaymentPendingPage() {
  return <main className="auth-page"><aside className="auth-aside"><Link href="/" data-testid="link-payment-pending-logo"><Logo inverse /></Link><div><span className="eyebrow" style={{ color: 'hsl(var(--accent))' }}>Quase lá</span><h1 className="display-title">Seu próximo passo está pronto.</h1></div><p style={{ color: 'hsl(var(--primary-foreground) / .62)', fontSize: '.8rem' }}>Volte em instantes para continuar.</p></aside><section className="auth-panel"><div className="auth-form"><span className="eyebrow">Pagamento</span><h1>Estamos preparando a etapa final.</h1><p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65, marginTop: 12 }}>O ambiente de pagamento ainda não está conectado nesta prévia. Assim que ele estiver configurado, este botão abrirá a etapa segura para você concluir a compra.</p><div className="card pad" style={{ margin: '28px 0', background: 'hsl(var(--secondary))' }}><div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><span className="empty-icon" style={{ width: 38, height: 38, borderRadius: 11, flex: 'none' }}><LockKeyhole size={17} /></span><div><strong>Seus dados foram recebidos</strong><p className="muted" style={{ fontSize: '.78rem', lineHeight: 1.55, marginTop: 5 }}>Nenhum dado de cartão é coletado nesta etapa.</p></div></div></div><Link href="/checkout" className="button accent" style={{ width: '100%' }} data-testid="link-back-payment">Voltar aos dados</Link><Link href="/" className="button ghost" style={{ width: '100%', marginTop: 10 }} data-testid="link-payment-home">Voltar ao início</Link></div></section></main>;
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  return <><PublicHeader /><main className="page-wrap legal"><Link href="/" className="muted" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '.8rem' }} data-testid="link-legal-back"><ArrowLeft size={14} /> início</Link><span className="eyebrow" style={{ display: 'block', marginTop: 45 }}>{isPrivacy ? 'Transparência' : 'Combinados claros'}</span><h1>{isPrivacy ? 'Política de privacidade' : 'Termos de uso'}</h1><p>Última atualização: 14 de maio de 2025</p>{isPrivacy ? <><h2>1. O que coletamos</h2><p>Coletamos os dados necessários para criar sua conta e oferecer os recursos da plataforma, como nome, e-mail, informações do currículo e registros de preparação. Não coletamos dados além do que você escolhe compartilhar.</p><h2>2. Como usamos seus dados</h2><p>Usamos essas informações para apresentar seu progresso, salvar seus materiais e personalizar sua experiência. Não vendemos seus dados nem usamos suas informações para prometer oportunidades de trabalho.</p><h2>3. Seus direitos</h2><p>Você pode solicitar acesso, correção ou exclusão dos seus dados. Para falar com a gente, use o canal de suporte indicado na sua conta.</p><h2>4. Segurança</h2><p>Adotamos medidas técnicas e organizacionais para proteger as informações armazenadas. Nenhuma transmissão é completamente livre de riscos, mas tratamos seus dados com cuidado e responsabilidade.</p></> : <><h2>1. Sobre o serviço</h2><p>O Primeiro Emprego oferece ferramentas de organização, prática e leitura de oportunidades para pessoas no início da carreira. A plataforma não garante emprego, entrevistas ou qualquer resultado profissional.</p><h2>2. Acesso e compra</h2><p>O acesso é disponibilizado mediante a compra única apresentada no checkout. O valor e as condições ficam sempre visíveis antes da confirmação.</p><h2>3. Uso responsável</h2><p>Você é responsável pelas informações que adiciona à plataforma e por revisar seus currículos, respostas e candidaturas antes de utilizá-los fora daqui.</p><h2>4. Alterações</h2><p>Podemos atualizar estes termos para refletir melhorias no serviço. Quando houver mudanças relevantes, comunicaremos de forma clara dentro da plataforma.</p></>}<PublicFooter /></main></>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
      <Route path="/" component={LandingPage} /><Route path="/login"><AuthPage mode="login" /></Route><Route path="/cadastro"><AuthPage mode="cadastro" /></Route><Route path="/primeiro-acesso"><AuthPage mode="cadastro" /></Route><Route path="/checkout" component={CheckoutPage} /><Route path="/checkout/pagamento-pendente" component={PaymentPendingPage} /><Route path="/politica-de-privacidade"><LegalPage kind="privacy" /></Route><Route path="/termos-de-uso"><LegalPage kind="terms" /></Route>
     <Route path="/dashboard"><AppShell><DashboardPage /></AppShell></Route><Route path="/plano"><AppShell><DashboardModulePage kind="plan" /></AppShell></Route><Route path="/curriculo/novo"><AppShell><ExpandedCurriculumEditor /></AppShell></Route><Route path="/curriculo/:id"><AppShell><ExpandedCurriculumEditor /></AppShell></Route><Route path="/curriculo"><AppShell><CurriculoPage /></AppShell></Route><Route path="/entrevista"><AppShell><InterviewSimulator /></AppShell></Route><Route path="/analisador-vagas"><AppShell><AnalisadorPage /></AppShell></Route><Route path="/candidaturas"><AppShell><CandidaturasPage /></AppShell></Route><Route path="/perfil"><AppShell><DashboardModulePage kind="profile" /></AppShell></Route><Route path="/progresso"><AppShell><DashboardModulePage kind="progress" /></AppShell></Route><Route path="/conquistas"><AppShell><DashboardModulePage kind="achievements" /></AppShell></Route><Route path="/configuracoes"><AppShell><ConfigPage /></AppShell></Route><Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}