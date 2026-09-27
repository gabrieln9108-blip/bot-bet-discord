import {
  ArrowLeft, ArrowRight, Award, BookOpen, Check, CircleHelp, FileText,
  GraduationCap, Lightbulb, Link as LinkIcon, Plus, PlusCircle, Printer,
  Trash2, UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  getGetCurriculumQueryKey, useCreateCurriculum, useGetCurriculum,
  useUpdateCurriculum,
} from '@workspace/api-client-react';
import type { Curriculum, CurriculumData } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Template = Curriculum['template'];
type ExpandedData = CurriculumData & {
  targetRole?: string;
  professionalObjective?: string;
  projects?: Project[];
  languages?: Language[];
  digitalSkills?: string[];
  volunteering?: Volunteering[];
  activities?: string[];
  awards?: AwardItem[];
  links?: ProfessionalLink[];
  additionalInfo?: string;
};
type Project = { name: string; description: string; contribution: string; result: string };
type Language = { language: string; level: string };
type Volunteering = { organization: string; role: string; period: string; description: string };
type AwardItem = { name: string; institution: string; year: string; description: string };
type ProfessionalLink = { label: string; url: string };

const templateOptions: Array<{ value: Template; label: string; copy: string }> = [
  { value: 'minimalista', label: 'Minimalista', copy: 'limpo e espaçoso' },
  { value: 'classico', label: 'Clássico', copy: 'tradicional e direto' },
  { value: 'moderno', label: 'Moderno', copy: 'destaques sutis' },
  { value: 'profissional', label: 'Profissional', copy: 'equilibrado para processos seletivos' },
  { value: 'executivo', label: 'Executivo', copy: 'firme e organizado' },
  { value: 'elegante', label: 'Elegante', copy: 'sereno e refinado' },
  { value: 'compacto', label: 'Compacto', copy: 'mais conteúdo em menos espaço' },
  { value: 'clean', label: 'Clean', copy: 'leve e objetivo' },
  { value: 'contemporaneo', label: 'Contemporâneo', copy: 'atual sem exageros' },
  { value: 'formal', label: 'Formal', copy: 'sóbrio e tradicional' },
];
const objectiveOptions = [
  'Primeiro emprego', 'Jovem Aprendiz', 'Estágio', 'Atendimento', 'Administrativo',
  'Comércio', 'Logística', 'Tecnologia', 'Recepção', 'Vendas', 'Outro',
];
const skillSuggestions = [
  'Comunicação', 'Organização', 'Trabalho em equipe', 'Responsabilidade', 'Pontualidade',
  'Proatividade', 'Aprendizado rápido', 'Atendimento ao cliente', 'Informática',
  'Pacote Office', 'Excel', 'Word', 'PowerPoint', 'Digitação', 'Comunicação escrita',
  'Comunicação verbal', 'Resolução de problemas', 'Criatividade', 'Atenção aos detalhes',
  'Planejamento', 'Adaptabilidade', 'Relacionamento interpessoal', 'Liderança', 'Vendas',
  'Negociação', 'Redes sociais', 'Tecnologia', 'Controle de estoque', 'Operação de caixa',
  'Recepção',
];
const experienceTypes = [
  'Experiência profissional', 'Trabalho informal', 'Trabalho temporário', 'Voluntariado',
  'Projeto escolar', 'Projeto pessoal', 'Atividade extracurricular', 'Negócio familiar', 'Freelance',
];
const languageLevels = ['Básico', 'Intermediário', 'Avançado', 'Fluente'];

function emptyData(): ExpandedData {
  return {
    personal: { name: '', city: '', phone: '', email: '' },
    education: [], courses: [], skills: [], experiences: [], profile: '',
    targetRole: '', professionalObjective: '',
    projects: [], languages: [], digitalSkills: [], volunteering: [], activities: [],
    awards: [], links: [], additionalInfo: '',
  };
}

function normalizeData(value?: CurriculumData): ExpandedData {
  const blank = emptyData();
  return {
    ...blank, ...(value ?? {}),
    personal: { ...blank.personal, ...(value?.personal ?? {}) },
    education: value?.education ?? [],
    courses: value?.courses ?? [],
    skills: value?.skills ?? [],
    experiences: value?.experiences ?? [],
    targetRole: (value as ExpandedData | undefined)?.targetRole ?? '',
    professionalObjective: (value as ExpandedData | undefined)?.professionalObjective ?? '',
    projects: (value as ExpandedData | undefined)?.projects ?? [],
    languages: (value as ExpandedData | undefined)?.languages ?? [],
    digitalSkills: (value as ExpandedData | undefined)?.digitalSkills ?? [],
    volunteering: (value as ExpandedData | undefined)?.volunteering ?? [],
    activities: (value as ExpandedData | undefined)?.activities ?? [],
    awards: (value as ExpandedData | undefined)?.awards ?? [],
    links: (value as ExpandedData | undefined)?.links ?? [],
    additionalInfo: (value as ExpandedData | undefined)?.additionalInfo ?? '',
  };
}

type WritingAssistKind = 'objective' | 'profile' | 'experience' | 'project' | 'additional';
type WritingAssistContext = {
  objective?: string;
  skills?: string[];
  type?: string;
  role?: string;
  organization?: string;
  projectName?: string;
};

function getWritingSuggestions(kind: WritingAssistKind, context: WritingAssistContext): string[] {
  const objective = context.objective && context.objective !== 'Outro'
    ? context.objective.toLowerCase()
    : 'uma oportunidade de início de carreira';
  const skills = context.skills?.slice(0, 3).join(', ') || 'organização, comunicação e vontade de aprender';
  const role = context.role?.trim() || 'a função';
  const organization = context.organization?.trim() || 'a equipe';
  const projectName = context.projectName?.trim() || 'um projeto';

  if (kind === 'objective') {
    return [
      `Busco uma oportunidade em ${objective} para colocar meus conhecimentos em prática, aprender com a equipe e contribuir com responsabilidade.`,
      `Tenho interesse em atuar em ${objective}, desenvolvendo minhas habilidades e construindo uma trajetória profissional com dedicação.`,
      `Procuro uma oportunidade de início de carreira em ${objective}, na qual eu possa aprender, colaborar e crescer profissionalmente.`,
      `Quero iniciar minha trajetória em ${objective}, oferecendo comprometimento, disposição para aprender e atenção às atividades do dia a dia.`,
    ];
  }
  if (kind === 'profile') {
    return [
      `Estou em busca de uma oportunidade em ${objective}. Tenho interesse em desenvolver ${skills} e contribuir com responsabilidade e vontade de aprender.`,
      `Sou uma pessoa comprometida, organizada e aberta a aprender. Busco uma oportunidade para aplicar meus conhecimentos, colaborar com a equipe e evoluir profissionalmente.`,
      `Tenho interesse em começar minha trajetória profissional em ${objective}. Aprendo com rapidez, valorizo o trabalho em equipe e procuro realizar cada atividade com atenção.`,
      `Busco meu primeiro passo profissional com disposição para aprender e contribuir. Meus principais pontos de desenvolvimento são ${skills}.`,
    ];
  }
  if (kind === 'experience') {
    return [
      `Participei de atividades relacionadas a ${role}, apoiando a rotina da equipe e realizando as tarefas combinadas com responsabilidade.`,
      `Atuei em uma experiência de ${context.type?.toLowerCase() || 'aprendizado prático'}, desenvolvendo organização, comunicação e capacidade de trabalhar em equipe.`,
      `Colaborei com ${organization} em atividades de apoio, mantendo atenção aos detalhes, cumprimento de prazos e disposição para aprender novas tarefas.`,
      `A experiência como ${role} me ajudou a desenvolver responsabilidade, autonomia e uma compreensão prática das demandas profissionais.`,
    ];
  }
  if (kind === 'project') {
    return [
      `Participei de ${projectName}, contribuindo para o planejamento, a organização das tarefas e a realização das atividades do projeto.`,
      `Desenvolvi ${projectName} como uma oportunidade de aplicar conhecimentos, resolver problemas e aprender durante o processo.`,
      `Colaborei na execução de ${projectName}, trabalhando em equipe e acompanhando as etapas necessárias para chegar ao resultado definido.`,
      `${projectName} foi uma experiência prática em que desenvolvi organização, iniciativa e atenção aos detalhes.`,
    ];
  }
  return [
    'Tenho disponibilidade para aprender, colaborar com a equipe e assumir responsabilidades de forma comprometida.',
    'Busco continuar desenvolvendo minhas habilidades por meio de cursos, projetos e experiências práticas.',
    'Tenho interesse em oportunidades que permitam aprender novas atividades e contribuir com dedicação para os resultados da equipe.',
    'Estou disposto a receber orientações, evoluir com os desafios e construir uma trajetória profissional consistente.',
  ];
}

function WritingAssist({
  kind,
  context,
  onApply,
}: {
  kind: WritingAssistKind;
  context?: WritingAssistContext;
  onApply: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const createSuggestion = () => {
    setSuggestions(getWritingSuggestions(kind, context ?? {}));
    setSelectedIndex(null);
    setOpen(true);
  };
  return <div className="writing-assist">
    <button type="button" className="text-button help-action" onClick={createSuggestion}>
      <CircleHelp size={14} /> não sei o que escrever
    </button>
    {open && <div className="writing-assist-box">
      <div className="writing-assist-heading"><strong>Escolha uma resposta profissional</strong><span className="muted">Você pode adaptar a opção escolhida para a sua história.</span></div>
      <div className="writing-suggestion-list" role="radiogroup" aria-label="Sugestões de resposta">
        {suggestions.map((suggestion, index) => <button
          type="button"
          role="radio"
          aria-checked={selectedIndex === index}
          className={`writing-suggestion ${selectedIndex === index ? 'selected' : ''}`}
          key={suggestion}
          onClick={() => setSelectedIndex(index)}
        >
          <span className="writing-suggestion-index">{index + 1}</span>
          <span className="writing-suggestion-copy">{suggestion}</span>
          {selectedIndex === index && <Check size={15} />}
        </button>)}
      </div>
      <button type="button" className="button ghost" disabled={selectedIndex === null} onClick={() => {
        if (selectedIndex !== null) onApply(suggestions[selectedIndex]);
        setOpen(false);
      }}><Check size={14} /> Usar resposta escolhida</button>
      <span className="muted writing-assist-note">Use somente o que for verdadeiro para você.</span>
    </div>}
  </div>;
}

function SectionTitle({ eyebrow, title, copy, icon }: { eyebrow: string; title: string; copy: string; icon?: ReactNode }) {
  return <div><span className="eyebrow">{eyebrow}</span><h2>{icon}{title}</h2><p className="muted form-help">{copy}</p></div>;
}

function ResumePreview({ name, objective, template, data }: { name: string; objective: string; template: Template; data: ExpandedData }) {
  const education = data.education ?? [];
  const courses = data.courses ?? [];
  const experiences = data.experiences ?? [];
  const skills = data.skills?.filter(Boolean) ?? [];
  const projects = data.projects ?? [];
  const languages = data.languages ?? [];
  const digitalSkills = data.digitalSkills ?? [];
  const volunteering = data.volunteering ?? [];
  const activities = data.activities ?? [];
  const awards = data.awards ?? [];
  const links = data.links ?? [];
  const hasContent = data.profile || education.length || courses.length || skills.length || experiences.length || projects.length;
  return <div className={`resume-preview resume-${template}`} data-testid="curriculum-preview">
    <div className="resume-heading">
      <h2>{data.personal.name || 'Seu nome completo'}</h2>
      <p>{[data.personal.city, data.personal.phone, data.personal.email].filter(Boolean).join(' · ') || 'Cidade · telefone · e-mail'}</p>
      {[objective, data.targetRole].filter(Boolean).join(' · ') && <strong>{[objective, data.targetRole].filter(Boolean).join(' · ')}</strong>}
    </div>
    {data.professionalObjective && <section><h3>Objetivo profissional</h3><p>{data.professionalObjective}</p></section>}
    {data.profile && <section><h3>Resumo profissional</h3><p>{data.profile}</p></section>}
    {education.length > 0 && <section><h3>Formação acadêmica</h3>{education.map((item, index) => <div className="resume-entry" key={`education-${index}`}><strong>{item.level || 'Formação'}</strong><span>{[item.course, item.status, item.institution, item.completionYear].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {courses.length > 0 && <section><h3>Cursos e certificações</h3>{courses.map((item, index) => <div className="resume-entry" key={`course-${index}`}><strong>{item.name || 'Curso'}</strong><span>{[item.institution, item.hours && `${item.hours}h`, item.year, item.certificate ? 'certificado' : ''].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {skills.length > 0 && <section><h3>Habilidades</h3><p className="resume-skills">{skills.join('  ·  ')}</p></section>}
    {digitalSkills.length > 0 && <section><h3>Competências digitais</h3><p className="resume-skills">{digitalSkills.join('  ·  ')}</p></section>}
    {experiences.length > 0 && <section><h3>Experiências</h3>{experiences.map((item, index) => <div className="resume-entry resume-entry-block" key={`experience-${index}`}><strong>{item.role || item.type || 'Experiência'}{item.organization ? ` · ${item.organization}` : ''}</strong><span>{[item.period, item.description, item.responsibilities].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {projects.length > 0 && <section><h3>Projetos</h3>{projects.map((item, index) => <div className="resume-entry resume-entry-block" key={`project-${index}`}><strong>{item.name || 'Projeto'}</strong><span>{[item.description, item.contribution, item.result].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {languages.length > 0 && <section><h3>Idiomas</h3>{languages.map((item, index) => <div className="resume-entry" key={`language-${index}`}><strong>{item.language || 'Idioma'}</strong><span>{item.level}</span></div>)}</section>}
    {volunteering.length > 0 && <section><h3>Trabalhos voluntários</h3>{volunteering.map((item, index) => <div className="resume-entry resume-entry-block" key={`volunteering-${index}`}><strong>{item.role || 'Voluntariado'}{item.organization ? ` · ${item.organization}` : ''}</strong><span>{[item.period, item.description].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {activities.length > 0 && <section><h3>Atividades extracurriculares</h3><p>{activities.join(' · ')}</p></section>}
    {awards.length > 0 && <section><h3>Prêmios e conquistas</h3>{awards.map((item, index) => <div className="resume-entry" key={`award-${index}`}><strong>{item.name || 'Conquista'}</strong><span>{[item.institution, item.year, item.description].filter(Boolean).join(' · ')}</span></div>)}</section>}
    {links.length > 0 && <section><h3>Links profissionais</h3>{links.map((item, index) => <div className="resume-entry" key={`link-${index}`}><strong>{item.label || 'Link'}</strong><span>{item.url}</span></div>)}</section>}
    {data.additionalInfo && <section><h3>Informações adicionais</h3><p>{data.additionalInfo}</p></section>}
    {!hasContent && <p className="muted resume-empty">Preencha as etapas ao lado para visualizar seu currículo.</p>}
    <small className="resume-version">{name || 'Meu currículo'}</small>
  </div>;
}

function ReviewPanel({ data, objective }: { data: ExpandedData; objective: string }) {
  const good = [
    data.personal.name ? 'Dados pessoais preenchidos' : '',
    objective ? 'Objetivo profissional definido' : '',
    data.targetRole ? 'Área ou cargo desejado informado' : '',
    data.education.length ? 'Formação informada' : '',
    data.skills.length ? 'Habilidades relevantes adicionadas' : '',
    data.profile.length > 40 ? 'Resumo profissional claro' : '',
    data.projects?.length ? 'Projetos apresentados' : '',
  ].filter(Boolean);
  const improve = [
    data.professionalObjective && data.professionalObjective.length < 30 ? 'Explique um pouco melhor seu objetivo profissional.' : '',
    data.profile && data.profile.length < 40 ? 'Adicione mais detalhes ao resumo profissional.' : '',
    data.projects?.some(project => project.description.length < 20) ? 'Descreva melhor o que foi feito em um dos projetos.' : '',
    data.experiences.some(item => item.description.length < 20) ? 'Torne uma experiência mais específica.' : '',
  ].filter(Boolean);
  const missing = [
    !data.personal.city || !data.personal.email ? 'Complete cidade e e-mail se quiser exibi-los.' : '',
    !data.education.length ? 'Você ainda não adicionou formação.' : '',
    !data.courses.length ? 'Você ainda não adicionou cursos.' : '',
    !data.projects?.length ? 'Você ainda não adicionou projetos.' : '',
    !data.languages?.length ? 'Você ainda não adicionou idiomas.' : '',
  ].filter(Boolean);
  return <div className="curriculum-review">
    <div className="review-column good"><h3>✓ O que está bom</h3>{good.length ? good.map(item => <p key={item}>✓ {item}</p>) : <p className="muted">Preencha os campos para receber uma leitura.</p>}</div>
    <div className="review-column improve"><h3>O que pode melhorar</h3>{improve.length ? improve.map(item => <p key={item}>• {item}</p>) : <p className="muted">Nenhum alerta por enquanto.</p>}</div>
    <div className="review-column missing"><h3>ℹ O que está faltando</h3>{missing.length ? missing.map(item => <p key={item}>ℹ {item}</p>) : <p className="muted">Nenhuma seção está sem preenchimento.</p>}</div>
  </div>;
}

export default function ExpandedCurriculumEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id || params.id === 'novo';
  const existing = useGetCurriculum(params.id ?? '', { query: { enabled: !isNew, queryKey: getGetCurriculumQueryKey(params.id ?? '') } });
  const create = useCreateCurriculum();
  const update = useUpdateCurriculum();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const editorRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [template, setTemplate] = useState<Template>('moderno');
  const [data, setData] = useState<ExpandedData>(emptyData);
  const [step, setStep] = useState(1);
  const [skillSearch, setSkillSearch] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (existing.data) {
      setName(existing.data.name);
      setObjective(existing.data.objective);
      setTemplate(existing.data.template);
      setData(normalizeData(existing.data.data));
    }
  }, [existing.data]);
  useEffect(() => {
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };
  const updatePersonal = (field: keyof ExpandedData['personal'], value: string) => setData(previous => ({ ...previous, personal: { ...previous.personal, [field]: value } }));
  const updateEducation = (index: number, field: string, value: string) => setData(previous => ({ ...previous, education: previous.education.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateCourse = (index: number, field: string, value: string) => setData(previous => ({ ...previous, courses: previous.courses.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateExperience = (index: number, field: string, value: string) => setData(previous => ({ ...previous, experiences: previous.experiences.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateProject = (index: number, field: string, value: string) => setData(previous => ({ ...previous, projects: previous.projects?.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateLanguage = (index: number, field: string, value: string) => setData(previous => ({ ...previous, languages: previous.languages?.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateVolunteering = (index: number, field: string, value: string) => setData(previous => ({ ...previous, volunteering: previous.volunteering?.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateAward = (index: number, field: string, value: string) => setData(previous => ({ ...previous, awards: previous.awards?.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateLink = (index: number, field: string, value: string) => setData(previous => ({ ...previous, links: previous.links?.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const toggleSkill = (skill: string) => setData(previous => ({ ...previous, skills: previous.skills.includes(skill) ? previous.skills.filter(item => item !== skill) : [...previous.skills, skill] }));
  const addItem = (key: 'education' | 'courses' | 'experiences' | 'projects' | 'languages' | 'volunteering' | 'awards' | 'links') => {
    const blanks = {
      education: { level: '', status: '', institution: '', course: '', completionYear: '' },
      courses: { name: '', institution: '', year: '', hours: '', certificate: false },
      experiences: { type: '', description: '', organization: '', role: '', period: '', responsibilities: '' },
      projects: { name: '', description: '', contribution: '', result: '' },
      languages: { language: '', level: '' },
      volunteering: { organization: '', role: '', period: '', description: '' },
      awards: { name: '', institution: '', year: '', description: '' },
      links: { label: '', url: '' },
    };
    setData(previous => ({ ...previous, [key]: [...(previous[key] ?? []), blanks[key]] } as ExpandedData));
  };
  const removeItem = (key: keyof ExpandedData, index: number) => setData(previous => ({ ...previous, [key]: (previous[key] as unknown[]).filter((_, itemIndex) => itemIndex !== index) } as ExpandedData));
  const filteredSkills = useMemo(() => skillSuggestions.filter(skill => skill.toLocaleLowerCase().includes(skillSearch.toLocaleLowerCase())), [skillSearch]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = { name: name.trim() || 'Meu currículo', objective, template, data, status: 'pronto' as const };
    const onSuccess = (item?: Curriculum) => {
      client.invalidateQueries({ queryKey: getGetCurriculumQueryKey(params.id ?? '') });
      flash(isNew ? 'Currículo salvo.' : 'Alterações salvas.');
      if (isNew && item) window.setTimeout(() => setLocation(`/curriculo/${item.id}`), 500);
    };
    if (isNew) create.mutate({ data: input }, { onSuccess });
    else update.mutate({ id: params.id ?? '', data: input }, { onSuccess });
  };
  if (!isNew && existing.isLoading) return <div className="page-wrap"><div className="skeleton" style={{ height: 400 }} /></div>;
  const stepTitles = ['Base', 'Formação', 'Habilidades', 'Projetos', 'Revisão'];
  const canContinue = step === 1 ? Boolean(name.trim() && data.personal.name.trim() && objective.trim()) : true;
  const nextStep = () => { if (!canContinue) return; setStep(value => Math.min(5, value + 1)); };
  return <div className="page-wrap fade-up" ref={editorRef}>
    <button className="button ghost" style={{ marginBottom: 25 }} onClick={() => setLocation('/curriculo')}><ArrowLeft size={15} /> meus currículos</button>
    <div className="section-head"><div><span className="eyebrow">{isNew ? 'Novo currículo' : 'Editando currículo'}</span><h1 className="display-title" style={{ fontSize: 'clamp(2.3rem, 5vw, 4.2rem)', marginTop: 8 }}>{isNew ? 'Conte sua história.' : name}</h1><p>Preencha apenas o que fizer sentido. Você pode voltar e ajustar quando quiser.</p></div></div>
    <div className="wizard-progress" aria-label="Etapas do currículo">{stepTitles.map((title, index) => <button key={title} type="button" className={`wizard-step ${step === index + 1 ? 'active' : ''} ${step > index + 1 ? 'done' : ''}`} onClick={() => index + 1 <= step || canContinue ? setStep(index + 1) : undefined}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{title}</button>)}</div>
    <form onSubmit={submit} className="two-col curriculum-editor-grid" style={{ alignItems: 'start' }}>
      <div className="card pad curriculum-form-card">
        {step === 1 && <div className="form-stack">
          <SectionTitle eyebrow="Etapa 1 de 5" title="Comece pelo essencial" copy="Esses dados ajudam a empresa a entender quem está se apresentando." icon={<UserRound size={18} />} />
          <div><label className="label" htmlFor="expanded-curriculum-name">Nome desta versão</label><input id="expanded-curriculum-name" className="input" required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Currículo para atendimento" /></div>
          <div><label className="label" htmlFor="expanded-personal-name">Nome completo</label><input id="expanded-personal-name" className="input" required value={data.personal.name} onChange={event => updatePersonal('name', event.target.value)} placeholder="Como você quer aparecer no currículo" /></div>
          <div className="form-row"><div><label className="label">Cidade e estado</label><input className="input" value={data.personal.city} onChange={event => updatePersonal('city', event.target.value)} placeholder="Ex.: Fortaleza, CE" /></div><div><label className="label">Telefone</label><input className="input" value={data.personal.phone} onChange={event => updatePersonal('phone', event.target.value)} placeholder="(00) 00000-0000" /></div></div>
          <div><label className="label">E-mail</label><input className="input" type="email" value={data.personal.email} onChange={event => updatePersonal('email', event.target.value)} placeholder="voce@email.com" /></div>
          <div><label className="label">Que tipo de oportunidade você procura?</label><select className="select" required value={objectiveOptions.includes(objective) ? objective : objective ? 'Outro' : ''} onChange={event => setObjective(event.target.value === 'Outro' ? 'Outro' : event.target.value)}><option value="">Escolha uma opção</option>{objectiveOptions.map(option => <option key={option}>{option}</option>)}</select>{(objective === 'Outro' || !objectiveOptions.includes(objective)) && <input className="input" style={{ marginTop: 9 }} value={objective === 'Outro' ? '' : objective} onChange={event => setObjective(event.target.value)} placeholder="Escreva seu objetivo" />}</div>
          <div><label className="label" htmlFor="target-role">Área ou cargo desejado <span className="muted">(opcional)</span></label><input id="target-role" className="input" value={data.targetRole ?? ''} onChange={event => setData(previous => ({ ...previous, targetRole: event.target.value }))} placeholder="Ex.: auxiliar administrativo, atendente ou jovem aprendiz" /></div>
           <div><div className="field-label-row"><label className="label" htmlFor="professional-objective">Objetivo profissional</label><WritingAssist kind="objective" context={{ objective }} onApply={value => setData(previous => ({ ...previous, professionalObjective: value }))} /></div><textarea id="professional-objective" className="textarea" value={data.professionalObjective ?? ''} onChange={event => setData(previous => ({ ...previous, professionalObjective: event.target.value }))} placeholder="Escreva aqui seu objetivo profissional: o que você busca e como quer contribuir." /></div>
           <div><div className="field-label-row"><label className="label">Resumo profissional</label><WritingAssist kind="profile" context={{ objective, skills: data.skills }} onApply={value => setData(previous => ({ ...previous, profile: value }))} /></div><p className="muted field-hint">Fale brevemente sobre o que você busca, seus pontos fortes e o que já aprendeu.</p><textarea className="textarea" value={data.profile} onChange={event => setData(previous => ({ ...previous, profile: event.target.value }))} placeholder="Escreva 2 ou 3 linhas sobre seus interesses e pontos fortes." /></div>
        </div>}
        {step === 2 && <div className="form-stack">
          <SectionTitle eyebrow="Etapa 2 de 5" title="Formação e cursos" copy="Inclua o que já começou ou concluiu. Certificado não é obrigatório." icon={<GraduationCap size={18} />} />
          <div className="section-divider"><BookOpen size={17} /><div><strong>Formação acadêmica</strong><p className="muted">Você pode adicionar mais de uma formação.</p></div></div>
          {data.education.map((item, index) => <div className="repeatable-item" key={`education-${index}`}><div className="repeatable-title"><strong>Formação {index + 1}</strong><button type="button" className="text-button" onClick={() => removeItem('education', index)}><Trash2 size={13} /> remover</button></div><div className="form-row"><div><label className="label">Nível</label><select className="select" value={item.level} onChange={event => updateEducation(index, 'level', event.target.value)}><option value="">Escolha</option><option>Ensino fundamental</option><option>Ensino médio</option><option>Ensino técnico</option><option>Graduação</option><option>Curso profissionalizante</option></select></div><div><label className="label">Status</label><select className="select" value={item.status} onChange={event => updateEducation(index, 'status', event.target.value)}><option value="">Escolha</option><option>Em andamento</option><option>Concluído</option></select></div></div><div className="form-row"><div><label className="label">Instituição</label><input className="input" value={item.institution ?? ''} onChange={event => updateEducation(index, 'institution', event.target.value)} /></div><div><label className="label">Curso ou área</label><input className="input" value={item.course ?? ''} onChange={event => updateEducation(index, 'course', event.target.value)} /></div></div><div><label className="label">Ano de conclusão ou previsão</label><input className="input" value={item.completionYear ?? ''} onChange={event => updateEducation(index, 'completionYear', event.target.value)} placeholder="Ex.: 2027" /></div></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('education')}><PlusCircle size={15} /> adicionar formação</button>
          <div className="section-divider"><BookOpen size={17} /><div><strong>Cursos e certificações</strong><p className="muted">Registre cursos reais, mesmo que ainda não tenha certificado.</p></div></div>
          {data.courses.map((item, index) => <div className="repeatable-item" key={`course-${index}`}><div className="repeatable-title"><strong>Curso {index + 1}</strong><button type="button" className="text-button" onClick={() => removeItem('courses', index)}><Trash2 size={13} /> remover</button></div><div className="form-row"><div><label className="label">Nome do curso</label><input className="input" value={item.name} onChange={event => updateCourse(index, 'name', event.target.value)} /></div><div><label className="label">Instituição</label><input className="input" value={item.institution} onChange={event => updateCourse(index, 'institution', event.target.value)} /></div></div><div className="form-row"><div><label className="label">Carga horária (se souber)</label><input className="input" value={item.hours ?? ''} onChange={event => updateCourse(index, 'hours', event.target.value)} /></div><div><label className="label">Ano</label><input className="input" value={item.year} onChange={event => updateCourse(index, 'year', event.target.value)} /></div></div><label className="checkbox-line"><input type="checkbox" checked={Boolean(item.certificate)} onChange={event => updateCourse(index, 'certificate', event.target.checked as unknown as string)} /> Possuo certificado</label></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('courses')}><PlusCircle size={15} /> adicionar curso</button>
        </div>}
        {step === 3 && <div className="form-stack">
          <SectionTitle eyebrow="Etapa 3 de 5" title="Habilidades e experiências" copy="Selecione somente aquilo que realmente combina com você. Experiência é opcional." icon={<Award size={18} />} />
          <div><label className="label">Pesquisar habilidades</label><input className="input" value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="Ex.: comunicação, Excel..." /><div className="suggestion-chips" style={{ marginTop: 10 }}>{filteredSkills.map(skill => <button type="button" key={skill} className={`suggestion-chip ${data.skills.includes(skill) ? 'selected' : ''}`} onClick={() => toggleSkill(skill)}>{data.skills.includes(skill) && <Check size={13} />}{skill}</button>)}</div><label className="label" style={{ marginTop: 13 }}>Adicionar habilidade personalizada</label><input className="input" value={data.skills.filter(skill => !skillSuggestions.includes(skill)).join(', ')} onChange={event => setData(previous => ({ ...previous, skills: [...previous.skills.filter(skill => skillSuggestions.includes(skill)), ...event.target.value.split(',').map(item => item.trim()).filter(Boolean)] }))} placeholder="Separe por vírgulas" /></div>
          <div className="section-divider"><Award size={17} /><div><strong>Experiências opcionais</strong><p className="muted">Trabalho informal, projeto escolar, voluntariado e negócio familiar também podem contar quando forem verdadeiros.</p></div></div>
           {data.experiences.map((item, index) => <div className="repeatable-item" key={`experience-${index}`}><div className="repeatable-title"><strong>Experiência {index + 1}</strong><button type="button" className="text-button" onClick={() => removeItem('experiences', index)}><Trash2 size={13} /> remover</button></div><div className="form-row"><div><label className="label">Tipo</label><select className="select" value={item.type} onChange={event => updateExperience(index, 'type', event.target.value)}><option value="">Escolha</option>{experienceTypes.map(type => <option key={type}>{type}</option>)}</select></div><div><label className="label">Cargo ou função</label><input className="input" value={item.role ?? ''} onChange={event => updateExperience(index, 'role', event.target.value)} /></div></div><div className="form-row"><div><label className="label">Empresa ou organização</label><input className="input" value={item.organization ?? ''} onChange={event => updateExperience(index, 'organization', event.target.value)} /></div><div><label className="label">Período</label><input className="input" value={item.period ?? ''} onChange={event => updateExperience(index, 'period', event.target.value)} placeholder="Ex.: 2025 – 2026" /></div></div><div><div className="field-label-row"><label className="label">Descrição das atividades</label><WritingAssist kind="experience" context={{ role: item.role, organization: item.organization, type: item.type }} onApply={value => updateExperience(index, 'description', value)} /></div><textarea className="textarea" value={item.description} onChange={event => updateExperience(index, 'description', event.target.value)} placeholder="Descreva o que você fez de forma simples e verdadeira." /></div><div><label className="label">Principais responsabilidades</label><textarea className="textarea" value={item.responsibilities ?? ''} onChange={event => updateExperience(index, 'responsibilities', event.target.value)} placeholder="Opcional: tarefas ou resultados que você lembra." /></div></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('experiences')}><PlusCircle size={15} /> adicionar experiência</button>
          <div className="section-divider"><BookOpen size={17} /><div><strong>Idiomas</strong><p className="muted">Escolha o nível que representa seu conhecimento hoje.</p></div></div>
          {data.languages?.map((item, index) => <div className="repeatable-item" key={`language-${index}`}><div className="form-row"><div><label className="label">Idioma</label><input className="input" value={item.language} onChange={event => updateLanguage(index, 'language', event.target.value)} placeholder="Ex.: Inglês" /></div><div><label className="label">Nível</label><select className="select" value={item.level} onChange={event => updateLanguage(index, 'level', event.target.value)}><option value="">Escolha</option>{languageLevels.map(level => <option key={level}>{level}</option>)}</select></div></div><button type="button" className="text-button" onClick={() => removeItem('languages', index)}><Trash2 size={13} /> remover</button></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('languages')}><PlusCircle size={15} /> adicionar idioma</button>
          <div><label className="label">Competências digitais</label><p className="muted field-hint">Ferramentas que você realmente sabe utilizar.</p><input className="input" value={data.digitalSkills?.join(', ') ?? ''} onChange={event => setData(previous => ({ ...previous, digitalSkills: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Ex.: Word, Canva, Google Docs" /></div>
        </div>}
        {step === 4 && <div className="form-stack">
          <SectionTitle eyebrow="Etapa 4 de 5" title="Projetos e outras experiências" copy="Essas seções ajudam a mostrar seu potencial sem inventar uma trajetória." icon={<FileText size={18} />} />
          <div className="section-divider"><FileText size={17} /><div><strong>Projetos</strong><p className="muted">Projeto escolar, pessoal, de tecnologia ou voluntário é bem-vindo.</p></div></div>
           {data.projects?.map((item, index) => <div className="repeatable-item" key={`project-${index}`}><div className="repeatable-title"><strong>Projeto {index + 1}</strong><button type="button" className="text-button" onClick={() => removeItem('projects', index)}><Trash2 size={13} /> remover</button></div><label className="label">Nome do projeto</label><input className="input" value={item.name} onChange={event => updateProject(index, 'name', event.target.value)} /><div><div className="field-label-row"><label className="label">Descrição</label><WritingAssist kind="project" context={{ projectName: item.name }} onApply={value => updateProject(index, 'description', value)} /></div><textarea className="textarea" value={item.description} onChange={event => updateProject(index, 'description', event.target.value)} /></div><label className="label">O que você fez</label><textarea className="textarea" value={item.contribution} onChange={event => updateProject(index, 'contribution', event.target.value)} /><label className="label">Resultado, quando houver</label><input className="input" value={item.result} onChange={event => updateProject(index, 'result', event.target.value)} /></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('projects')}><PlusCircle size={15} /> adicionar projeto</button>
          <div className="section-divider"><Award size={17} /><div><strong>Trabalhos voluntários</strong><p className="muted">Preencha apenas se tiver participado de verdade.</p></div></div>
          {data.volunteering?.map((item, index) => <div className="repeatable-item" key={`volunteering-${index}`}><div className="form-row"><div><label className="label">Organização</label><input className="input" value={item.organization} onChange={event => updateVolunteering(index, 'organization', event.target.value)} /></div><div><label className="label">Função</label><input className="input" value={item.role} onChange={event => updateVolunteering(index, 'role', event.target.value)} /></div></div><div className="form-row"><div><label className="label">Período</label><input className="input" value={item.period} onChange={event => updateVolunteering(index, 'period', event.target.value)} /></div><div><label className="label">Descrição</label><input className="input" value={item.description} onChange={event => updateVolunteering(index, 'description', event.target.value)} /></div></div><button type="button" className="text-button" onClick={() => removeItem('volunteering', index)}><Trash2 size={13} /> remover</button></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('volunteering')}><PlusCircle size={15} /> adicionar voluntariado</button>
          <div><label className="label">Atividades extracurriculares</label><input className="input" value={data.activities?.join(', ') ?? ''} onChange={event => setData(previous => ({ ...previous, activities: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} placeholder="Ex.: grupo escolar, evento, competição, atividade comunitária" /></div>
          <div className="section-divider"><Award size={17} /><div><strong>Prêmios e conquistas</strong><p className="muted">Somente informações verdadeiras.</p></div></div>
          {data.awards?.map((item, index) => <div className="repeatable-item" key={`award-${index}`}><div className="form-row"><div><label className="label">Nome</label><input className="input" value={item.name} onChange={event => updateAward(index, 'name', event.target.value)} /></div><div><label className="label">Instituição</label><input className="input" value={item.institution} onChange={event => updateAward(index, 'institution', event.target.value)} /></div></div><div className="form-row"><div><label className="label">Ano</label><input className="input" value={item.year} onChange={event => updateAward(index, 'year', event.target.value)} /></div><div><label className="label">Descrição</label><input className="input" value={item.description} onChange={event => updateAward(index, 'description', event.target.value)} /></div></div><button type="button" className="text-button" onClick={() => removeItem('awards', index)}><Trash2 size={13} /> remover</button></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('awards')}><PlusCircle size={15} /> adicionar conquista</button>
          <div className="section-divider"><LinkIcon size={17} /><div><strong>Portfólio e links profissionais</strong><p className="muted">Portfólio, LinkedIn, GitHub ou outro link relevante. Todos são opcionais.</p></div></div>
          {data.links?.map((item, index) => <div className="form-row" key={`link-${index}`}><input className="input" value={item.label} onChange={event => updateLink(index, 'label', event.target.value)} placeholder="Nome do link" /><div style={{ display: 'flex', gap: 7 }}><input className="input" value={item.url} onChange={event => updateLink(index, 'url', event.target.value)} placeholder="https://..." /><button type="button" className="button danger" onClick={() => removeItem('links', index)}><Trash2 size={13} /></button></div></div>)}
          <button type="button" className="button ghost" onClick={() => addItem('links')}><PlusCircle size={15} /> adicionar link</button>
           <div><div className="field-label-row"><label className="label">Informações adicionais</label><WritingAssist kind="additional" onApply={value => setData(previous => ({ ...previous, additionalInfo: value }))} /></div><textarea className="textarea" value={data.additionalInfo ?? ''} onChange={event => setData(previous => ({ ...previous, additionalInfo: event.target.value }))} placeholder="Inclua algo profissional relevante que não entrou nas outras seções." /></div>
        </div>}
        {step === 5 && <div className="form-stack">
          <SectionTitle eyebrow="Etapa 5 de 5" title="Revise antes de salvar" copy="O analisador aponta preenchimento e clareza. Ele não exige que você tenha experiências que não possui." icon={<Check size={18} />} />
          <div><label className="label">Modelo visual</label><div className="template-options">{templateOptions.map(option => <button type="button" key={option.value} className={`template-option ${template === option.value ? 'selected' : ''}`} onClick={() => setTemplate(option.value)}><span className={`template-mini template-mini-${option.value}`} /><span><strong>{option.label}</strong><small>{option.copy}</small></span>{template === option.value && <Check size={15} />}</button>)}</div></div>
          <div className="review-notice"><Check size={17} /><span><strong>Os dados são seus</strong><br />Revise tudo e mantenha somente informações reais antes de salvar.</span></div>
          <button type="button" className="button ghost" onClick={() => setShowReview(previous => !previous)}><Lightbulb size={15} /> {showReview ? 'Ocultar avaliação' : 'Avaliar meu currículo'}</button>
          {showReview && <ReviewPanel data={data} objective={objective} />}
        </div>}
        <div className="wizard-actions">{step > 1 && <button type="button" className="button ghost" onClick={() => setStep(value => value - 1)}><ArrowLeft size={15} /> voltar</button>}{step < 5 ? <button type="button" className="button primary" disabled={!canContinue} onClick={nextStep}>continuar <ArrowRight size={15} /></button> : <button className="button accent" type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Salvando...' : 'Salvar currículo'} <Check size={15} /></button>}</div>
      </div>
      <div className="curriculum-preview-column"><div className="preview-toolbar"><div><span className="eyebrow">Visualização</span><strong>Assim ele aparecerá para uma empresa</strong></div><button type="button" className="button ghost" onClick={() => window.print()}><Printer size={15} /> imprimir / PDF</button></div><ResumePreview name={name} objective={objective} template={template} data={data} /><p className="muted preview-tip"><GraduationCap size={14} /> Não incluí foto, CPF ou gráficos: para o primeiro emprego, clareza vale mais.</p></div>
    </form>
    {notice && <div className="toast-note">{notice}</div>}
  </div>;
}