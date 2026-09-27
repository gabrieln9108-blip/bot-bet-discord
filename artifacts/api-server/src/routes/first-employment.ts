import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateApplicationBody,
  CreateApplicationResponse,
  CreateCurriculumBody,
  CreateCurriculumResponse,
  CreateInterviewBody,
  CreateInterviewResponse,
  CreateJobAnalysisBody,
  CreateJobAnalysisResponse,
  DeleteJobAnalysisParams,
  DeleteApplicationParams,
  DeleteCurriculumParams,
  DuplicateCurriculumParams,
  DuplicateCurriculumResponse,
  FinishInterviewParams,
  FinishInterviewResponse,
  GetCurriculumParams,
  GetCurriculumResponse,
  GetDashboardResponse,
  ListApplicationsResponse,
  ListCurriculumsResponse,
  ListInterviewsResponse,
  ListJobAnalysesResponse,
  SendInterviewMessageBody,
  SendInterviewMessageParams,
  SendInterviewMessageResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
  UpdateCurriculumBody,
  UpdateCurriculumParams,
  UpdateCurriculumResponse,
} from "@workspace/api-zod";
import type {
  Application,
  Curriculum,
  CurriculumData,
  Interview,
  InterviewResult,
  JobAnalysis,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import {
  antiAutomation,
  isSafePublicHttpUrl,
  rateLimit,
  rejectUnexpectedKeys,
} from "../middlewares/security";

const router: IRouter = Router();

// Preview state is intentionally empty: a new customer creates their own data.
type OwnedCurriculum = Curriculum & { ownerId: string };
type OwnedApplication = Application & { ownerId: string };
type OwnedInterview = Interview & { ownerId: string; answers: string[]; questions: string[] };
type OwnedJobAnalysis = JobAnalysis & { ownerId: string };

const curriculums: OwnedCurriculum[] = [];
const applications: OwnedApplication[] = [];
const interviews: OwnedInterview[] = [];
const jobAnalyses: OwnedJobAnalysis[] = [];

const interviewQuestions = [
  "Conte um pouco sobre você e o que está buscando para o início da sua carreira.",
  "Por que você se interessou por esta oportunidade?",
  "Qual é uma habilidade sua que pode ajudar no dia a dia desta função?",
  "Conte uma situação em que você precisou aprender algo novo.",
  "Como você costuma se organizar para cumprir uma tarefa ou compromisso?",
  "Quais são seus principais pontos fortes?",
  "Qual ponto você gostaria de desenvolver melhor?",
  "Conte sobre uma atividade escolar da qual você se orgulha.",
  "Fale sobre uma situação em que você trabalhou em equipe.",
  "Como você demonstra responsabilidade no dia a dia?",
  "O que você faz para cumprir horários e ser pontual?",
  "Conte um problema que você ajudou a resolver.",
  "Como atenderia uma pessoa que chegasse com uma dúvida?",
  "Como você costuma lidar com pessoas diferentes de você?",
  "O que faria se recebesse várias tarefas ao mesmo tempo?",
  "Como reagiria a um conflito com um colega?",
  "Como você aprende uma tarefa que ainda não conhece?",
  "O que motiva você a buscar seu primeiro emprego?",
  "Qual é a sua disponibilidade para trabalhar ou aprender?",
  "Que experiência da escola, da família ou da comunidade ajudou você a amadurecer?",
  "Como você se prepararia para o primeiro dia de trabalho?",
  "O que faria se cometesse um erro em uma tarefa?",
  "Como você recebe uma orientação ou crítica?",
  "Conte uma situação em que precisou cumprir uma responsabilidade sem alguém lembrar.",
  "Como você explicaria uma informação para alguém que não entendeu?",
  "O que significa, para você, oferecer um bom atendimento?",
  "Como você se comportaria em um dia de muito movimento?",
  "O que faria se não soubesse responder uma pergunta de um cliente?",
  "Como você se organiza para não esquecer compromissos?",
  "Conte uma situação em que precisou ter paciência.",
  "Como você contribuiria em uma equipe?",
  "O que você espera aprender nesta oportunidade?",
  "Por que deveríamos considerar alguém em início de carreira para esta função?",
  "Que tipo de ambiente ajuda você a trabalhar bem?",
  "Conte uma ocasião em que você tomou iniciativa.",
  "Como você lida com uma tarefa repetitiva?",
  "O que faria se percebesse que não conseguiria cumprir um prazo?",
  "Como você se apresentaria para uma nova equipe?",
  "Qual foi um aprendizado importante que você teve fora da sala de aula?",
  "Como você cuidaria de uma informação importante da empresa?",
  "Como agiria se discordasse de uma decisão da equipe?",
  "Que atitude demonstra profissionalismo, mesmo sem experiência?",
  "Como você se prepararia para uma entrevista presencial?",
  "Como você se prepararia para uma entrevista por vídeo?",
  "O que você faria para entender melhor as necessidades de um cliente?",
  "Conte uma situação hipotética em que precisaria escolher entre rapidez e atenção.",
  "Como você reagiria ao receber uma tarefa nova no primeiro dia?",
  "Qual foi uma meta que você conseguiu cumprir?",
  "Como você demonstra vontade de aprender?",
  "O que espera conquistar nos próximos dois anos?",
  "Como seus estudos podem ajudar nesta oportunidade?",
  "Que qualidade as pessoas próximas costumam reconhecer em você?",
  "O que você faria para melhorar depois de uma resposta que não saiu como esperava?",
  "Como você manteria a calma diante de uma cobrança?",
  "Conte sobre uma vez em que precisou pedir ajuda.",
  "Como você verifica se realizou uma tarefa corretamente?",
  "Qual seria sua primeira atitude ao receber uma tarefa pouco clara?",
  "Como você equilibraria estudos, trabalho e outros compromissos?",
  "O que você gostaria que o entrevistador soubesse sobre você?",
];

const now = () => new Date().toISOString();
const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+().\-\s]{7,30}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const JOB_ANALYSIS_DAILY_LIMIT = Number(process.env.JOB_ANALYSIS_DAILY_LIMIT ?? 10);
const JOB_ANALYSIS_HOURLY_LIMIT = Number(process.env.JOB_ANALYSIS_HOURLY_LIMIT ?? 4);
const GLOBAL_JOB_ANALYSIS_LIMIT = Number(process.env.GLOBAL_JOB_ANALYSIS_LIMIT ?? 1000);
const analysisUsage = { day: "", dayCount: 0, hour: 0, hourStartedAt: 0, total: 0 };

router.use(requireAuth);

const userRateKey = (req: Request, action: string): string =>
  `${req.ip}:${req.auth?.userId ?? "unknown"}:${action}`;

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const lower = (value: string) => value.toLocaleLowerCase("pt-BR");
const unique = (items: string[]) => [...new Set(items.map(clean).filter(Boolean))];
const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(lower(term)));
const clampScore = (value: number) => Math.max(0, Math.min(10, Math.round(value)));
const wordsOf = (value: string) => lower(value).match(/[\p{L}\p{N}]{2,}/gu) ?? [];
const meaningfulWords = (value: string) => wordsOf(value)
  .filter((word) => word.length >= 4 && !["para", "como", "com", "dos", "das", "uma", "que", "você", "seu", "sua"].includes(word));

function evaluateInterview(interview: OwnedInterview): InterviewResult {
  const answers = interview.answers.map((answer) => clean(answer));
  const answerWords = answers.map(wordsOf);
  const totalWords = answerWords.reduce((total, words) => total + words.length, 0);
  const averageWords = totalWords / Math.max(answers.length, 1);
  const substantive = answerWords.filter((words) => words.length >= 18).length;
  const shortAnswers = answerWords.filter((words) => words.length < 12).length;
  const examples = answers.filter((answer) => hasAny(lower(answer), [
    "exemplo", "situação", "quando", "participei", "fiz", "ajudei", "organizei", "resolvi",
    "aprendi", "projeto", "atividade", "experiência",
  ])).length;
  const actionAnswers = answers.filter((answer) => hasAny(lower(answer), [
    "fiz", "faço", "ajudei", "organizei", "resolvi", "aprendi", "planejei", "participei",
    "contribuí", "busco", "pretendo", "vou",
  ])).length;
  const professionalAnswers = answers.filter((answer) => hasAny(lower(answer), [
    "responsabilidade", "organização", "equipe", "aprender", "cliente", "prazo", "horário",
    "comunicação", "orientação", "resultado", "atendimento",
  ])).length;
  const fillerAnswers = answers.filter((answer) => hasAny(lower(answer), [
    "tipo", "assim", "né", "sei lá", "acho que", "talvez", "basicamente",
  ])).length;
  const answerCoverage = answers.filter((answer, index) => {
    const questionTerms = meaningfulWords(interview.questions[index] ?? "").slice(0, 6);
    const answerTerms = new Set(meaningfulWords(answer));
    return questionTerms.some((term) => answerTerms.has(term)) || answer.length >= 70;
  }).length;
  const vocabulary = new Set(answerWords.flat()).size;
  const vocabularyRatio = vocabulary / Math.max(totalWords, 1);
  const communication = clampScore(4 + (substantive / Math.max(answers.length, 1)) * 3 + Math.min(vocabularyRatio * 8, 2));
  const clarity = clampScore(4 + (substantive / Math.max(answers.length, 1)) * 3 - (fillerAnswers / Math.max(answers.length, 1)) * 2);
  const objectivity = clampScore(4 + Math.min(averageWords / 32, 3) - Math.max(0, averageWords - 115) / 55);
  const posture = clampScore(4 + (professionalAnswers / Math.max(answers.length, 1)) * 3 + (actionAnswers / Math.max(answers.length, 1)) * 2);
  const coherence = clampScore(4 + (answerCoverage / Math.max(answers.length, 1)) * 4 + (examples / Math.max(answers.length, 1)));
  const preparation = clampScore(4 + (examples / Math.max(answers.length, 1)) * 3 + (actionAnswers / Math.max(answers.length, 1)) * 2);
  const voice = interview.responseMode === "voice"
    ? clampScore(4 + (substantive / Math.max(answers.length, 1)) * 3 + (clarity / 3))
    : clampScore(5 + (clarity / 4));
  const overall = clampScore(
    communication * 0.16 + clarity * 0.16 + objectivity * 0.13 + posture * 0.13 +
    coherence * 0.16 + preparation * 0.16 + voice * 0.10,
  );
  const classification = overall >= 8.5 ? "muito-bom" : overall >= 6.5 ? "bom" : "precisa-melhorar";
  const answerCount = answers.length;
  const exampleRate = Math.round((examples / Math.max(answerCount, 1)) * 100);
  const substantiveRate = Math.round((substantive / Math.max(answerCount, 1)) * 100);
  const didWell = [
    `${substantive} de ${answerCount} respostas tiveram conteúdo suficiente para desenvolver uma ideia, em vez de apenas uma frase solta.`,
    `${examples} respostas trouxeram sinais de experiência, situação ou aprendizado; isso dá material concreto para o entrevistador lembrar.`,
    `${actionAnswers} respostas mostraram ações suas, o que ajuda a demonstrar iniciativa mesmo sem experiência formal.`,
    interview.responseMode === "voice"
      ? "Você escolheu responder por voz e revisou a transcrição antes do envio; isso aproxima o treino de uma conversa real."
      : "Você teve espaço para organizar as ideias por escrito antes de enviar, um bom jeito de construir segurança no começo.",
  ];
  const improve = [
    shortAnswers > 0
      ? `${shortAnswers} respostas ficaram curtas demais para sustentar um exemplo. Use contexto, o que você fez e o resultado.`
      : "Suas respostas tiveram bom desenvolvimento; agora refine as frases para chegar ao ponto mais cedo.",
    fillerAnswers > 0
      ? `${fillerAnswers} respostas usaram expressões vagas ou de hesitação. Troque “acho que” por uma afirmação acompanhada de um exemplo verdadeiro.`
      : "Não apareceram muitos sinais de hesitação no texto; mantenha essa segurança sem transformar a resposta em algo decorado.",
    answerCoverage < answerCount
      ? `${answerCount - answerCoverage} respostas não retomaram claramente o foco da pergunta. Comece respondendo diretamente e só depois explique.`
      : "Você retomou bem os temas das perguntas; continue abrindo a resposta com a ideia principal.",
    `A consistência de conteúdo ficou em ${substantiveRate}% e o uso de exemplos em ${exampleRate}%. Treine elevar os dois números juntos.`,
    interview.responseMode === "voice"
      ? "A análise de voz usa a transcrição, ritmo aproximado e sinais de clareza. O áudio bruto não é gravado; por isso não é possível avaliar timbre ou volume."
      : "Como este treino foi digitado, a nota de voz e entrega é uma estimativa de clareza textual; pratique a mesma resposta em voz alta para validar o ritmo.",
  ];
  const scoreMap = {
    comunicação: communication,
    clareza: clarity,
    objetividade: objectivity,
    postura: posture,
    coerência: coherence,
    preparação: preparation,
    "voz e entrega": voice,
  };
  const practice = [
    "Para perguntas de situação, responda em três movimentos: contexto, atitude que você tomou e resultado ou aprendizado.",
    "Grave uma nova tentativa e procure terminar cada resposta em até 90 segundos, sem cortar o exemplo principal.",
    interview.responseMode === "voice"
      ? "Na próxima rodada, faça uma pausa curta antes de responder e reduza palavras de apoio; o objetivo é soar claro, não perfeito."
      : "Na próxima rodada, leia suas respostas em voz alta e ajuste os trechos que ficam longos ou difíceis de falar.",
    `Sua nota geral foi ${overall}/10. O maior espaço de evolução agora está em ${Object.entries(scoreMap).sort(([, first], [, second]) => first - second)[0]?.[0] ?? "clareza"}.`,
  ];
  return {
    id: interview.id,
    classification,
    scores: {
      geral: overall,
      ...scoreMap,
    },
    didWell,
    improve,
    practice,
  };
}

function listFromLines(description: string, keywords: string[]) {
  const headingPattern = /(requisitos?|responsabilidades?|atribuições?|atividades?|benefícios?|experiência|escolaridade|formação|qualificações?|conhecimentos?)\s*:/gi;
  const parts: string[] = [];
  for (const rawLine of description.split(/\r?\n/)) {
    const line = clean(rawLine.replace(/^[-*•▪◦]\s*/, ""));
    const matches = [...line.matchAll(headingPattern)];
    if (matches.length) {
      matches.forEach((match, index) => {
        const start = (match.index ?? 0) + match[0].length;
        const end = matches[index + 1]?.index ?? line.length;
        const section = line.slice(start, end);
        const sectionParts = section.split(/[.;,]\s*/);
        const headingMatches = hasAny(lower(match[1] ?? ""), keywords);
        if (headingMatches) {
          parts.push(...sectionParts);
        } else {
          parts.push(...sectionParts.filter((part) => hasAny(lower(part), keywords)));
        }
      });
    } else if (hasAny(lower(line), keywords)) {
      parts.push(...line.split(/[.;,]\s*/));
    }
  }
  return unique(parts.map((part) => clean(part))).filter((part) => part.length > 4).slice(0, 10);
}

function extractJobField(description: string, labels: string[]) {
  const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:\\-]\\s*([^\\n|]+)`, "i");
  return clean(description.match(pattern)?.[1] ?? "");
}

function labelForFit(fit: number) {
  if (fit >= 80) return "Alta compatibilidade";
  if (fit >= 60) return "Compatibilidade moderada";
  return "Compatibilidade a desenvolver";
}

function isLikelyJobDescription(description: string) {
  const normalized = lower(clean(description));
  const words = normalized.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const jobSignals = [
    "vaga", "oportunidade", "cargo", "função", "posição", "empresa", "requisitos",
    "responsabilidades", "atribuições", "atividades", "benefícios", "salário",
    "remuneração", "experiência", "escolaridade", "formação", "horário", "contratação",
    "atendimento", "estágio", "aprendiz", "trabalho",
  ];
  const signalCount = jobSignals.filter((signal) => normalized.includes(signal)).length;
  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  const vowelWords = words.filter((word) => /[aeiouáéíóúãõâêô]/i.test(word)).length;
  const repeatedCharacters = /(.)\1{4,}/i.test(normalized);
  const mostlyPunctuation = normalized.replace(/[\p{L}\p{N}\s]/gu, "").length > normalized.length * 0.35;
  return (
    normalized.length >= 45 &&
    words.length >= 8 &&
    signalCount >= 2 &&
    uniqueRatio >= 0.35 &&
    vowelWords / words.length >= 0.55 &&
    !repeatedCharacters &&
    !mostlyPunctuation
  );
}

function compareRequirement(requirement: string, profileText: string) {
  const words = lower(requirement)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !["para", "como", "com", "dos", "das", "uma", "ter", "ser"].includes(word));
  const meaningful = words.slice(0, 7);
  const matches = meaningful.filter((word) => profileText.includes(word)).length;
  if (matches >= Math.max(1, Math.ceil(meaningful.length * 0.6))) return "met";
  if (matches > 0) return "partial";
  return "unknown";
}

function getId(value: string | string[]): string {
  const id = Array.isArray(value) ? value[0] : value;
  return /^[A-Za-z0-9:_-]{1,128}$/.test(id) ? id : "";
}

function friendlyError(res: Response, message: string) {
  res.status(400).json({ error: message });
}

function bodyKeys(req: Request, res: Response, allowed: readonly string[]): boolean {
  return rejectUnexpectedKeys(req, res, allowed);
}

function safeExternalUrl(value: string): boolean {
  return !value || isSafePublicHttpUrl(value);
}

function safeDate(value: string): boolean {
  return !value || DATE_RE.test(value);
}

function validateCurriculumSecurity(data: CurriculumData): boolean {
  const personal = data.personal;
  if (personal.name.length > 120 || personal.city.length > 120 ||
      personal.phone.length > 30 || personal.email.length > 254 ||
      (personal.email !== "" && !EMAIL_RE.test(personal.email)) ||
      (personal.phone !== "" && !PHONE_RE.test(personal.phone))) {
    return false;
  }
  if (data.links?.some((link) => !safeExternalUrl(link.url))) return false;
  return true;
}

function dashboard(ownerId: string, registeredName?: string) {
  const userCurriculums = curriculums.filter((item) => item.ownerId === ownerId);
  const userApplications = applications.filter((item) => item.ownerId === ownerId);
  const userAnalyses = jobAnalyses.filter((item) => item.ownerId === ownerId);
  const hasCurriculum = curriculums.some(
    (curriculum) => curriculum.ownerId === ownerId && curriculum.status === "pronto",
  );
  const hasInterview = interviews.some(
    (interview) => interview.ownerId === ownerId && interview.status === "completed",
  );
  const hasAnalysis = userAnalyses.length > 0;
  const hasApplication = userApplications.length > 0;
  const checklist = [
    { label: "Completar perfil", completed: userCurriculums.some((item) => Boolean(item.data.personal.name)) },
    { label: "Criar currículo", completed: hasCurriculum },
    { label: "Treinar entrevista", completed: hasInterview },
    { label: "Analisar vagas", completed: hasAnalysis },
    { label: "Registrar candidatura", completed: hasApplication },
    { label: "Acompanhar candidatura", completed: userApplications.some((item) =>
      Boolean(item.followUpDate) || item.status === "entrevista" || item.status === "segunda_etapa",
    ) },
  ];
  const progress = Math.round(
    (checklist.filter((item) => item.completed).length / checklist.length) * 100,
  );
  const next = checklist.find((item) => !item.completed);
  const nextStep = next?.label === "Criar currículo"
    ? {
        title: "Monte seu currículo",
        description: "Organize suas informações em um currículo claro e pronto para enviar.",
        href: "/curriculo",
      }
    : next?.label === "Treinar entrevista"
      ? {
          title: "Treine uma entrevista",
          description: "Faça uma simulação e receba um feedback para responder com mais confiança.",
          href: "/entrevista",
        }
      : next?.label === "Analisar vagas"
        ? {
            title: "Analise uma vaga",
            description: "Veja como seus pontos fortes conversam com uma oportunidade real.",
            href: "/analisador-vagas",
          }
        : {
            title: "Continue avançando",
            description: "Revise seu plano e escolha uma próxima ação para seguir em frente.",
            href: "/dashboard",
          };
  const summary = Object.fromEntries(
    [
      "quero_me_candidatar",
      "enviada",
      "aguardando",
      "entrevista",
      "segunda_etapa",
      "aprovado",
      "rejeitado",
      "encerrada",
    ].map((status) => [status, userApplications.filter((item) => item.status === status).length]),
  );
  return {
    userName: clean(registeredName ?? "") || userCurriculums[0]?.data.personal.name || "Você",
    progress,
    checklist,
    applicationSummary: summary,
    recentActivity: [
      ...(userApplications[0]
        ? [{ label: `Candidatura registrada em ${userApplications[0].company}`, time: "há pouco" }]
        : []),
      ...(userCurriculums[0]
        ? [{ label: "Currículo salvo no seu espaço", time: "hoje" }]
        : []),
      ...(userAnalyses[0]
        ? [{ label: "Uma vaga foi analisada", time: "hoje" }]
        : []),
    ],
    achievements: [
      { label: "Primeiro currículo", unlocked: userCurriculums.length > 0 },
      { label: "Primeira entrevista", unlocked: hasInterview },
      { label: "Primeira vaga analisada", unlocked: hasAnalysis },
      { label: "Primeira candidatura", unlocked: hasApplication },
      { label: "5 candidaturas", unlocked: userApplications.length >= 5 },
      { label: "10 candidaturas", unlocked: userApplications.length >= 10 },
    ],
    nextStep,
  };
}

router.get("/dashboard", (req, res): void => {
  res.json(GetDashboardResponse.parse(dashboard(req.auth!.userId, req.auth!.name)));
});

router.get("/curriculums", (req, res): void => {
  res.json(ListCurriculumsResponse.parse(curriculums.filter((item) => item.ownerId === req.auth!.userId)));
});

router.post("/curriculums", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => userRateKey(req, "curriculum-create"),
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 3,
  key: (req) => userRateKey(req, "curriculum-create"),
}), (req, res): void => {
  if (!bodyKeys(req, res, ["name", "objective", "template", "data"])) return;
  const parsed = CreateCurriculumBody.safeParse(req.body);
  if (!parsed.success) {
    friendlyError(res, "Confira os dados do currículo e tente novamente.");
    return;
  }
  if (parsed.data.name.length > 120 || parsed.data.objective.length > 2_000 ||
      !validateCurriculumSecurity(parsed.data.data)) {
    friendlyError(res, "Confira os limites e formatos dos dados do currículo.");
    return;
  }
  const curriculum: Curriculum = {
    id: newId("cv"),
    ...parsed.data,
    updatedAt: now(),
    status: "pronto",
  };
  const ownedCurriculum = { ...curriculum, ownerId: req.auth!.userId };
  curriculums.unshift(ownedCurriculum);
  res.status(201).json(CreateCurriculumResponse.parse(ownedCurriculum));
});

router.get("/curriculums/:id", (req, res): void => {
  const params = GetCurriculumParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível localizar este currículo.");
    return;
  }
  const curriculum = curriculums.find((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (!curriculum) {
    res.status(404).json({ error: "Currículo não encontrado." });
    return;
  }
  res.json(GetCurriculumResponse.parse(curriculum));
});

router.patch("/curriculums/:id", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  key: (req) => userRateKey(req, "curriculum-update"),
}), (req, res): void => {
  if (!bodyKeys(req, res, ["name", "objective", "template", "data"])) return;
  const params = UpdateCurriculumParams.safeParse({ id: getId(req.params.id) });
  const body = UpdateCurriculumBody.safeParse(req.body);
  if (!params.success || !body.success) {
    friendlyError(res, "Confira os dados do currículo e tente novamente.");
    return;
  }
  if ((body.data.name !== undefined && body.data.name.length > 120) ||
      (body.data.objective !== undefined && body.data.objective.length > 2_000) ||
      (body.data.data !== undefined && !validateCurriculumSecurity(body.data.data))) {
    friendlyError(res, "Confira os limites e formatos dos dados do currículo.");
    return;
  }
  const index = curriculums.findIndex((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (index < 0) {
    res.status(404).json({ error: "Currículo não encontrado." });
    return;
  }
  curriculums[index] = {
    ...curriculums[index],
    ...body.data,
    updatedAt: now(),
  } as OwnedCurriculum;
  res.json(UpdateCurriculumResponse.parse(curriculums[index]));
});

router.delete("/curriculums/:id", (req, res): void => {
  const params = DeleteCurriculumParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível excluir este currículo.");
    return;
  }
  const index = curriculums.findIndex((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (index < 0) {
    res.status(404).json({ error: "Currículo não encontrado." });
    return;
  }
  curriculums.splice(index, 1);
  res.status(204).send();
});

router.post("/curriculums/:id/duplicate", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => userRateKey(req, "curriculum-duplicate"),
}), (req, res): void => {
  const params = DuplicateCurriculumParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível duplicar este currículo.");
    return;
  }
  const original = curriculums.find((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (!original) {
    res.status(404).json({ error: "Currículo não encontrado." });
    return;
  }
  const copy: OwnedCurriculum = {
    ...original,
    id: newId("cv"),
    name: `${original.name} — cópia`,
    updatedAt: now(),
    status: "rascunho",
    ownerId: req.auth!.userId,
  };
  curriculums.unshift(copy);
  res.status(201).json(DuplicateCurriculumResponse.parse(copy));
});

router.get("/interviews", (req, res): void => {
  res.json(ListInterviewsResponse.parse(interviews.filter((item) => item.ownerId === req.auth!.userId)));
});

router.post("/interviews", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  key: (req) => userRateKey(req, "interview-create"),
}), antiAutomation({
  windowMs: 10 * 1000,
  burst: 3,
  key: (req) => userRateKey(req, "interview-create"),
}), (req, res): void => {
  if (!bodyKeys(req, res, ["role", "type", "responseMode"])) return;
  const parsed = CreateInterviewBody.safeParse(req.body);
  if (!parsed.success) {
    friendlyError(res, "Informe o cargo e o tipo de entrevista.");
    return;
  }
  if (parsed.data.role.length > 200 || parsed.data.type.length > 100) {
    friendlyError(res, "Confira os limites dos dados da entrevista.");
    return;
  }
  const questions = [...interviewQuestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 20);
  const interview: OwnedInterview = {
    id: newId("interview"),
    ownerId: req.auth!.userId,
    role: parsed.data.role,
    type: parsed.data.type,
    status: "active",
    question: questions[0],
    questionNumber: 1,
    totalQuestions: questions.length,
    startedAt: now(),
    responseMode: parsed.data.responseMode ?? "text",
    answers: [],
    questions,
  };
  interviews.unshift(interview);
  res.status(201).json(CreateInterviewResponse.parse(interview));
});

router.post("/interviews/:id/messages", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  key: (req) => userRateKey(req, "interview-message"),
}), (req, res): void => {
  if (!bodyKeys(req, res, ["answer"])) return;
  const params = SendInterviewMessageParams.safeParse({ id: getId(req.params.id) });
  const body = SendInterviewMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    friendlyError(res, "Escreva uma resposta antes de continuar.");
    return;
  }
  const interview = interviews.find((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (!interview || interview.status !== "active") {
    res.status(404).json({ error: "Simulação não encontrada." });
    return;
  }
  interview.answers.push(body.data.answer);
  const nextQuestionNumber = interview.questionNumber + 1;
  const completed = nextQuestionNumber > interview.totalQuestions;
  interview.questionNumber = nextQuestionNumber;
  interview.question = completed ? "" : interview.questions[nextQuestionNumber - 1];
  res.json(
    SendInterviewMessageResponse.parse({
      question: completed ? null : interview.question,
      questionNumber: nextQuestionNumber,
      completed,
    }),
  );
});

router.post("/interviews/:id/finish", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  key: (req) => userRateKey(req, "interview-finish"),
}), (req, res): void => {
  const params = FinishInterviewParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível finalizar esta simulação.");
    return;
  }
  const interview = interviews.find((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (!interview) {
    res.status(404).json({ error: "Simulação não encontrada." });
    return;
  }
  interview.status = "completed";
  const result: InterviewResult = evaluateInterview(interview);
  res.json(FinishInterviewResponse.parse(result));
});

router.get("/job-analyses", (req, res): void => {
  res.json(ListJobAnalysesResponse.parse(jobAnalyses.filter((item) => item.ownerId === req.auth!.userId)));
});

router.post("/job-analyses", rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  key: (req) => userRateKey(req, "job-analysis"),
}), antiAutomation({
  windowMs: 60 * 1000,
  burst: 3,
  key: (req) => userRateKey(req, "job-analysis"),
}), (req, res): void => {
  if (!bodyKeys(req, res, ["company", "role", "description"])) return;
  const parsed = CreateJobAnalysisBody.safeParse(req.body);
  if (!parsed.success || (!parsed.data.description && !parsed.data.role && !parsed.data.company)) {
    friendlyError(res, "Informe pelo menos o cargo, a empresa ou a descrição da vaga.");
    return;
  }
  const currentDay = new Date().toISOString().slice(0, 10);
  if (analysisUsage.day !== currentDay) {
    analysisUsage.day = currentDay;
    analysisUsage.dayCount = 0;
  }
  if (Date.now() - analysisUsage.hourStartedAt >= 60 * 60 * 1000) {
    analysisUsage.hourStartedAt = Date.now();
    analysisUsage.hour = 0;
  }
  if (analysisUsage.dayCount >= JOB_ANALYSIS_DAILY_LIMIT ||
      analysisUsage.hour >= JOB_ANALYSIS_HOURLY_LIMIT ||
      analysisUsage.total >= GLOBAL_JOB_ANALYSIS_LIMIT) {
    friendlyError(res, "Você atingiu o limite de análises por enquanto. Tente novamente mais tarde.");
    return;
  }

  const input = parsed.data;
  const description = clean(input.description ?? "");
  const text = lower(description);
  if (description && !isLikelyJobDescription(description)) {
    const rejected: OwnedJobAnalysis = {
      id: newId("analysis"),
      ownerId: req.auth!.userId,
      role: clean(input.role ?? "") || "Descrição rejeitada",
      company: clean(input.company ?? "") || "Entrada inválida",
      location: "",
      salary: "",
      education: "",
      experience: "",
      requirements: [],
      responsibilities: [],
      skills: [],
      benefits: [],
      fit: 0,
      compatibilityLabel: "Descrição inválida",
      scoreBreakdown: {
        education: 0,
        experience: 0,
        skills: 0,
        knowledge: 0,
        mandatory: 0,
      },
      strengths: [],
      partial: [],
      notFound: [],
      recommendations: [
        "Cole a descrição original da vaga, sem brincadeiras ou texto aleatório.",
        "Inclua pelo menos o cargo, as atividades e os requisitos da oportunidade.",
      ],
      attentionSignals: [],
      summary: "Nota 0/100. A descrição foi reprovada porque não apresenta sinais suficientes de uma vaga de emprego real.",
      limitations: [
        "Não foi possível comparar seu perfil porque o texto informado não parece uma descrição de vaga.",
      ],
      profileSources: [],
      gaps: [],
      createdAt: now(),
    };
    jobAnalyses.unshift(rejected);
    res.status(201).json(CreateJobAnalysisResponse.parse(rejected));
    return;
  }
  const curriculum = curriculums.find((item) => item.ownerId === req.auth!.userId && item.status === "pronto") ??
    curriculums.find((item) => item.ownerId === req.auth!.userId);
  const profile = curriculum?.data;
  const profileText = lower([
    curriculum?.objective,
    profile?.personal.name,
    profile?.personal.city,
    profile?.profile,
    ...(profile?.skills ?? []),
    ...(profile?.education ?? []).flatMap((item) => [item.level, item.status, item.institution ?? ""]),
    ...(profile?.courses ?? []).flatMap((item) => [item.name, item.institution, item.year]),
    ...(profile?.experiences ?? []).flatMap((item) => [item.type, item.description]),
  ].join(" "));

  const role = clean(input.role ?? "") ||
    extractJobField(description, ["cargo", "função", "posição"]) ||
    (text.match(/(?:vaga|oportunidade)\s+(?:para|de)\s+([^\n,.;]+)/i)?.[1] ?? "Oportunidade analisada");
  const company = clean(input.company ?? "") ||
    extractJobField(description, ["empresa", "companhia"]) ||
    "Empresa não informada";
  const location = extractJobField(description, ["local", "localização", "cidade", "região"]);
  const salary = extractJobField(description, ["salário", "remuneração", "bolsa"]) ||
    (description.match(/r\$\s?[\d.,]+\s*(?:a\s*r\$\s?[\d.,]+)?/i)?.[0] ?? "");
  const education = listFromLines(description, ["ensino", "escolaridade", "formação", "graduação", "técnico"]);
  const experience = listFromLines(description, ["experiência", "vivência", "tempo de atuação"]);
  const requirements = listFromLines(description, ["requisito", "necessário", "obrigatório", "qualificação", "desejável"]);
  const responsibilities = listFromLines(description, ["responsabilidade", "atribuições", "atividades", "você fará", "rotina"]);
  const benefits = listFromLines(description, ["benefício", "vale", "auxílio", "assistência", "refeição", "transporte"]);
  const knownSkills = [
    "comunicação", "atendimento", "organização", "excel", "word", "powerpoint",
    "pacote office", "informática", "vendas", "negociação", "digitação",
    "trabalho em equipe", "redes sociais", "controle de estoque", "inglês",
  ];
  const skills = unique(knownSkills.filter((skill) => text.includes(skill)).map((skill) => skill[0].toUpperCase() + skill.slice(1)));
  const knowledge = skills.filter((skill) => ["Excel", "Word", "Powerpoint", "Pacote office", "Informática", "Inglês"].includes(skill));
  const inferredRequirements = unique([...education, ...experience, ...requirements, ...skills]).slice(0, 14);
  const met: string[] = [];
  const partial: string[] = [];
  const notFound: string[] = [];
  inferredRequirements.forEach((requirement) => {
    const result = compareRequirement(requirement, profileText);
    if (result === "met") met.push(requirement);
    else if (result === "partial") partial.push(requirement);
    else notFound.push(requirement);
  });

  const educationScore = education.length
    ? Math.round((education.filter((item) => compareRequirement(item, profileText) === "met").length / education.length) * 100)
    : 60;
  const experienceScore = experience.length
    ? profile?.experiences?.length ? 100 : 50
    : 100;
  const skillsScore = skills.length
    ? Math.round((skills.filter((item) => compareRequirement(item, profileText) === "met").length / skills.length) * 100)
    : 60;
  const knowledgeScore = knowledge.length
    ? Math.round((knowledge.filter((item) => compareRequirement(item, profileText) === "met").length / knowledge.length) * 100)
    : 60;
  const mandatoryScore = inferredRequirements.length
    ? Math.round((met.length + partial.length * 0.5) / inferredRequirements.length * 100)
    : 60;
  const scoreBreakdown = {
    education: educationScore,
    experience: experienceScore,
    skills: skillsScore,
    knowledge: knowledgeScore,
    mandatory: mandatoryScore,
  };
  const fit = Math.round(
    educationScore * 0.2 +
    experienceScore * 0.2 +
    skillsScore * 0.25 +
    knowledgeScore * 0.15 +
    mandatoryScore * 0.2,
  );
  const strengths = unique([
    ...met,
    ...(profile?.skills ?? []).filter((skill) => text.includes(lower(skill))),
  ]).slice(0, 8);
  const limitations = unique([
    !description ? "A análise foi feita apenas com o cargo e/ou empresa informados." : "",
    !curriculum ? "Não encontramos um currículo salvo para comparação." : "",
    !(profile?.profile || profile?.skills?.length || profile?.education?.length)
      ? "Seu perfil ainda tem poucas informações preenchidas; o índice pode mudar quando você adicionar mais dados."
      : "",
    !experience.length && !skills.length && !requirements.length
      ? "A descrição não trouxe requisitos suficientes para uma comparação detalhada."
      : "",
  ]);
  const attentionSignals = unique([
    hasAny(text, ["taxa", "pague", "pagamento", "depósito", "pix"]) ? "A vaga menciona taxa ou pagamento. Vale verificar esta informação antes de prosseguir." : "",
    hasAny(text, ["senha", "cartão", "cpf", "documento", "dados bancários"]) ? "A vaga solicita dados sensíveis. Vale confirmar o canal e a necessidade antes de enviar." : "",
  ]);
  const recommendations = unique([
    ...notFound.slice(0, 4).map((item) => `Seu currículo não menciona ${item}. Adicione somente se você realmente possui esse conhecimento.`),
    ...partial.slice(0, 3).map((item) => `Se você já teve contato com ${item}, explique essa experiência com um exemplo curto e verdadeiro.`),
    "Revise os requisitos obrigatórios e confirme as informações da vaga antes de se candidatar.",
  ]).slice(0, 6);
  const completedInterviews = interviews.filter((item) => item.ownerId === req.auth!.userId && item.status === "completed");
  if (completedInterviews.length > 0) {
    limitations.push("Resultados de entrevistas simuladas foram considerados apenas como contexto complementar.");
  }
  const analysis: OwnedJobAnalysis = {
    id: newId("analysis"),
    ownerId: req.auth!.userId,
    role,
    company,
    location,
    salary,
    education: education.join(" · "),
    experience: experience.join(" · "),
    requirements: inferredRequirements,
    responsibilities,
    skills,
    benefits,
    fit,
    compatibilityLabel: labelForFit(fit),
    scoreBreakdown,
    strengths,
    partial,
    notFound,
    recommendations,
    attentionSignals,
    limitations,
    profileSources: unique([
      profile ? "Currículo salvo" : "",
      completedInterviews.length ? "Entrevistas simuladas concluídas" : "",
    ]),
    gaps: unique([...partial, ...notFound]),
    summary: `Este índice compara seu perfil com os requisitos informados na vaga. Ele não prevê a decisão da empresa. ${labelForFit(fit)} com base nas informações disponíveis.`,
    createdAt: now(),
  };
  analysisUsage.dayCount += 1;
  analysisUsage.hour += 1;
  analysisUsage.total += 1;
  jobAnalyses.unshift(analysis);
  res.status(201).json(CreateJobAnalysisResponse.parse(analysis));
});

router.delete("/job-analyses/:id", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  key: (req) => userRateKey(req, "job-analysis-delete"),
}), (req, res): void => {
  const params = DeleteJobAnalysisParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível excluir esta análise.");
    return;
  }
  const index = jobAnalyses.findIndex((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (index < 0) {
    res.status(404).json({ error: "Análise não encontrada." });
    return;
  }
  jobAnalyses.splice(index, 1);
  res.status(204).send();
});

router.get("/applications", (req, res): void => {
  res.json(ListApplicationsResponse.parse(applications.filter((item) => item.ownerId === req.auth!.userId)));
});

router.post("/applications", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  key: (req) => userRateKey(req, "application-create"),
}), (req, res): void => {
  if (!bodyKeys(req, res, [
    "company", "role", "location", "status", "appliedAt", "jobUrl", "salary", "notes", "followUpDate",
  ])) return;
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    friendlyError(res, "Preencha empresa, cargo e data da candidatura.");
    return;
  }
  if (parsed.data.company.length > 200 || parsed.data.role.length > 200 ||
      parsed.data.location.length > 200 || parsed.data.salary.length > 200 ||
      parsed.data.notes.length > 10_000 || !safeExternalUrl(parsed.data.jobUrl) ||
      !safeDate(parsed.data.appliedAt) || !safeDate(parsed.data.followUpDate)) {
    friendlyError(res, "Confira os limites e formatos da candidatura.");
    return;
  }
  const application: OwnedApplication = {
    id: newId("application"),
    ownerId: req.auth!.userId,
    company: parsed.data.company,
    role: parsed.data.role,
    location: parsed.data.location,
    status: parsed.data.status,
    appliedAt: parsed.data.appliedAt,
    jobUrl: parsed.data.jobUrl,
    salary: parsed.data.salary,
    notes: parsed.data.notes ?? "",
    followUpDate: parsed.data.followUpDate,
  };
  applications.unshift(application);
  res.status(201).json(CreateApplicationResponse.parse(application));
});

router.patch("/applications/:id", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  key: (req) => userRateKey(req, "application-update"),
}), (req, res): void => {
  if (!bodyKeys(req, res, [
    "company", "role", "location", "status", "appliedAt", "jobUrl", "salary", "notes", "followUpDate",
  ])) return;
  const params = UpdateApplicationParams.safeParse({ id: getId(req.params.id) });
  const body = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    friendlyError(res, "Confira os dados da candidatura e tente novamente.");
    return;
  }
  if ((body.data.company !== undefined && body.data.company.length > 200) ||
      (body.data.role !== undefined && body.data.role.length > 200) ||
      (body.data.location !== undefined && body.data.location.length > 200) ||
      (body.data.salary !== undefined && body.data.salary.length > 200) ||
      (body.data.notes !== undefined && body.data.notes.length > 10_000) ||
      (body.data.jobUrl !== undefined && !safeExternalUrl(body.data.jobUrl)) ||
      (body.data.appliedAt !== undefined && !safeDate(body.data.appliedAt)) ||
      (body.data.followUpDate !== undefined && !safeDate(body.data.followUpDate))) {
    friendlyError(res, "Confira os limites e formatos da candidatura.");
    return;
  }
  const index = applications.findIndex((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (index < 0) {
    res.status(404).json({ error: "Candidatura não encontrada." });
    return;
  }
  applications[index] = { ...applications[index], ...body.data };
  res.json(UpdateApplicationResponse.parse(applications[index]));
});

router.delete("/applications/:id", rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  key: (req) => userRateKey(req, "application-delete"),
}), (req, res): void => {
  const params = DeleteApplicationParams.safeParse({ id: getId(req.params.id) });
  if (!params.success) {
    friendlyError(res, "Não foi possível excluir esta candidatura.");
    return;
  }
  const index = applications.findIndex((item) => item.id === params.data.id && item.ownerId === req.auth!.userId);
  if (index < 0) {
    res.status(404).json({ error: "Candidatura não encontrada." });
    return;
  }
  applications.splice(index, 1);
  res.status(204).send();
});

export default router;