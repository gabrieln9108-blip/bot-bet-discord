import { ArrowRight, Check, ClipboardCheck, Mic, RotateCcw, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import {
  getListInterviewsQueryKey,
  useCreateInterview,
  useFinishInterview,
  useListInterviews,
  useSendInterviewMessage,
} from '@workspace/api-client-react';
import type { Interview, InterviewResult } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type ResponseMode = 'text' | 'voice';
type InterviewWithResult = Interview & { result?: InterviewResult };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function speakQuestion(question: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

function getRecognition(): SpeechRecognitionLike | null {
  const browserWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Constructor = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
}

export default function InterviewSimulator() {
  const listQuery = useListInterviews();
  const create = useCreateInterview();
  const send = useSendInterviewMessage();
  const finish = useFinishInterview();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [active, setActive] = useState<Interview | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [role, setRole] = useState('');
  const [type, setType] = useState('primeiro emprego');
  const [mode, setMode] = useState<ResponseMode>('text');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const voicePrefix = useRef('');
  const keepListening = useRef(false);
  const history = (listQuery.data ?? []) as InterviewWithResult[];

  useEffect(() => () => {
    keepListening.current = false;
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const isVoiceSupported = useMemo(() => Boolean(
    typeof window !== 'undefined' &&
    ((window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition),
  ), []);

  const startListening = () => {
    if (listening) {
      keepListening.current = false;
      recognition.current?.stop();
      setListening(false);
      setVoiceNotice('Transcrição pausada. Você pode revisar o que já apareceu.');
      return;
    }
    const instance = getRecognition();
    if (!instance) {
      setVoiceNotice('Seu navegador não oferece reconhecimento de voz. Você pode continuar digitando.');
      return;
    }
    instance.lang = 'pt-BR';
    instance.continuous = true;
    instance.interimResults = true;
    voicePrefix.current = answer.trim();
    instance.onresult = event => {
      let finalText = '';
      let interimText = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? '';
        if (result?.isFinal) finalText += `${transcript} `;
        else interimText += `${transcript} `;
      }
      const liveText = [voicePrefix.current, finalText, interimText]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      setAnswer(liveText);
      setVoiceNotice(interimText.trim() ? 'Escrevendo enquanto você fala…' : 'Trecho transcrito. Continue falando ou revise.');
    };
    instance.onerror = () => {
      keepListening.current = false;
      setVoiceNotice('Não conseguimos ouvir agora. Confira a permissão do microfone ou digite sua resposta.');
      setListening(false);
    };
    instance.onend = () => {
      if (keepListening.current) {
        try {
          instance.start();
          return;
        } catch {
          keepListening.current = false;
        }
      }
      setListening(false);
      setVoiceNotice('Transcrição pausada. Revise o texto antes de enviar.');
    };
    recognition.current = instance;
    keepListening.current = true;
    setVoiceNotice('Pode falar. As palavras aparecerão aqui enquanto você responde.');
    setListening(true);
    instance.start();
  };

  const start = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { data: { role: role.trim(), type, responseMode: mode } },
      {
        onSuccess: item => {
          setActive(item);
          setResult(null);
          setAnswer('');
          setVoiceNotice('');
          client.invalidateQueries({ queryKey: getListInterviewsQueryKey() });
        },
      },
    );
  };

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (!active || !answer.trim()) return;
    keepListening.current = false;
    recognition.current?.stop();
    setListening(false);
    send.mutate(
      { id: active.id, data: { answer: answer.trim() } },
      {
        onSuccess: message => {
          setAnswer('');
          setVoiceNotice('');
          if (message.completed) {
            finish.mutate({
              id: active.id,
            }, {
              onSuccess: evaluation => {
                setResult(evaluation);
                setActive(null);
                client.invalidateQueries({ queryKey: getListInterviewsQueryKey() });
              },
            });
          } else {
            setActive(previous => previous ? {
              ...previous,
              question: message.question ?? '',
              questionNumber: message.questionNumber,
            } : previous);
          }
        },
      },
    );
  };

  const restart = () => {
    setResult(null);
    setAnswer('');
    setVoiceNotice('');
  };

  return <div className="page-wrap fade-up">
    <div className="section-head">
      <div><span className="eyebrow">Treino sem pressão</span><h1 className="display-title">Entrevista, uma pergunta por vez.</h1><p>Pratique para o primeiro emprego sem decorar respostas prontas. Cada simulação escolhe 20 perguntas variadas.</p></div>
    </div>
    {active ? <div className="card pad interview-session-card">
      <div className="interview-session-top"><span className="pill yellow">{active.role}</span><span className="muted" style={{ fontSize: '.75rem' }}>pergunta {active.questionNumber} de {active.totalQuestions}</span></div>
      <div className="progress-track" style={{ marginBottom: 30 }}><div className="progress-fill" style={{ width: `${(active.questionNumber / active.totalQuestions) * 100}%` }} /></div>
      <div className="interview-question-heading"><h2 className="display-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.3rem)' }}>{active.question}</h2><button type="button" className="button ghost" onClick={() => speakQuestion(active.question)}><Volume2 size={15} /> Ouvir pergunta</button></div>
      <form onSubmit={next}>
        <textarea className="textarea" required minLength={2} maxLength={2000} value={answer} onChange={event => setAnswer(event.target.value)} placeholder={mode === 'voice' ? 'Fale pelo microfone e acompanhe a transcrição aqui…' : 'Escreva do seu jeito. Não existe resposta perfeita.'} data-testid="input-interview-answer" />
        <div className="interview-tools">
          <div>{mode === 'voice' && <button type="button" className={`button ${listening ? 'accent' : 'ghost'}`} onClick={startListening}><Mic size={15} /> {listening ? 'Ouvindo…' : 'Responder por voz'}</button>}{voiceNotice && <span className="muted interview-voice-notice">{voiceNotice}</span>}</div>
          <div className="interview-actions"><button type="button" className="button ghost" onClick={() => setActive(null)}><X size={15} /> Sair</button><button className="button primary" type="submit" disabled={send.isPending || finish.isPending || !answer.trim()}>{send.isPending || finish.isPending ? 'Avaliando…' : 'Enviar resposta'} <ArrowRight size={15} /></button></div>
        </div>
        {mode === 'voice' && !isVoiceSupported && <p className="muted interview-voice-notice">Reconhecimento de voz não está disponível neste dispositivo. Digite normalmente para continuar.</p>}
      </form>
    </div> : result ? <div className="card pad interview-result-card">
      <span className="eyebrow">Prática concluída</span>
       <div className="interview-result-heading"><div><h2 className="display-title" style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: '10px 0' }}>{result.classification === 'muito-bom' ? 'Muito bom.' : result.classification === 'bom' ? 'Bom caminho.' : 'Precisa de prática.'}</h2><p className="muted">A nota considera o conteúdo das respostas, clareza, objetividade, postura, coerência e preparação.</p></div><div className="interview-overall-score"><strong>{result.scores.geral ?? 0}</strong><span>/10 geral</span></div></div>
       <p className="muted" style={{ margin: '18px 0 25px' }}>Este feedback orienta seu próximo treino e não é garantia de contratação.</p>
      <div className="interview-score-grid">{Object.entries(result.scores ?? {}).map(([label, score]) => <div key={label}><div className="score-label"><span>{label}</span><strong>{score}/10</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Number(score) * 10}%` }} /></div></div>)}</div>
      <div className="three-col interview-feedback-columns">{[['O que você fez bem', result.didWell], ['O que pode melhorar', result.improve], ['Dicas para a próxima', result.practice]].map(([title, items]) => <div key={title as string}><h3>{title as string}</h3>{(items as string[]).map((item, index) => <p key={`${item}-${index}`} className="muted feedback-item">• {item}</p>)}</div>)}</div>
      <div className="interview-actions"><button className="button accent" onClick={restart}>Praticar novamente <RotateCcw size={15} /></button><button className="button ghost" onClick={() => setLocation('/dashboard')}>Voltar ao dashboard</button></div>
    </div> : <div className="two-col">
      <form className="card pad" onSubmit={start} style={{ display: 'grid', gap: 17, alignSelf: 'start' }}>
        <span className="eyebrow">Nova simulação</span><h2 style={{ marginTop: -6 }}>Prepare uma conversa real</h2>
        <div><label className="label" htmlFor="interview-role">Para qual função?</label><input id="interview-role" className="input" required value={role} onChange={event => setRole(event.target.value)} placeholder="Ex.: atendente de loja" data-testid="input-interview-role" /></div>
        <div><label className="label" htmlFor="interview-type">Contexto</label><select id="interview-type" className="select" value={type} onChange={event => setType(event.target.value)}><option>primeiro emprego</option><option>estágio</option><option>jovem aprendiz</option></select></div>
        <fieldset className="mode-choice"><legend className="label">Como você quer responder?</legend><label className={`mode-option ${mode === 'text' ? 'selected' : ''}`}><input type="radio" name="response-mode" checked={mode === 'text'} onChange={() => setMode('text')} /><span><strong>Digitando</strong><small>Escreva e revise suas respostas.</small></span></label><label className={`mode-option ${mode === 'voice' ? 'selected' : ''}`}><input type="radio" name="response-mode" checked={mode === 'voice'} onChange={() => setMode('voice')} /><span><strong>Por voz</strong><small>Fale, confira a transcrição e envie.</small></span></label></fieldset>
        <button className="button primary" type="submit" disabled={create.isPending}>{create.isPending ? 'Preparando…' : 'Começar prática'} <ArrowRight size={15} /></button>
        <p className="muted interview-disclaimer">As perguntas são voltadas a entrevistas de primeiro emprego. A avaliação ajuda a praticar; não decide contratação.</p>
      </form>
      <div className="card pad"><div className="section-head"><div><h2>Seu histórico</h2><p>Sem dados fictícios: suas práticas aparecem aqui depois que você realizá-las.</p></div></div>{history.length ? history.slice(0, 8).map(item => <div key={item.id} className="activity-item"><span className={`activity-dot ${item.status === 'completed' ? 'done' : ''}`} /><div><p style={{ fontSize: '.84rem', fontWeight: 600 }}>{item.role}</p><span className="muted" style={{ fontSize: '.72rem' }}>{item.status === 'completed' ? 'Concluída' : 'Em andamento'} · {item.totalQuestions} perguntas · {item.responseMode === 'voice' ? 'por voz' : 'digitando'} · {new Date(item.startedAt).toLocaleDateString('pt-BR')}</span>{item.result?.improve?.length ? <p className="muted history-improve">Melhorar: {item.result.improve[0]}</p> : null}</div></div>) : <div className="empty-state" style={{ padding: '34px 12px' }}><span className="empty-icon"><ClipboardCheck size={19} /></span><p className="muted" style={{ fontSize: '.8rem' }}>Sua primeira prática estará aqui.</p></div>}</div>
    </div>}
  </div>;
}