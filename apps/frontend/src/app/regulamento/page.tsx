'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion';

const PIX_COPIA_COLA =
  '00020126360014BR.GOV.BCB.PIX0114+5583988269825520400005303986540550.005802BR5901N6001C62150511BolaoTrovao6304793E';

function RegulamentoConteudo() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/login';
  const [copiado, setCopiado] = useState(false);

  async function copiarPix() {
    await navigator.clipboard.writeText(PIX_COPIA_COLA);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-yellow-400">Regulamento</h1>
          <Link href={from} className="text-sm text-gray-400 hover:text-white">
            Voltar
          </Link>
        </div>

        <div className="rounded-xl bg-gray-900 px-6">
          <Accordion defaultValue={['disposicoes-gerais']}>

            {/* 1. Disposições Gerais */}
            <AccordionItem value="disposicoes-gerais">
              <AccordionTrigger>Disposições Gerais</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-3">
                  <p>
                    Este bolão tem intuito exclusivo de diversão e entretenimento entre amigos e
                    familiares, sem fins lucrativos.
                  </p>
                  <p>
                    Ao participar, o usuário aceita este regulamento e isenta os organizadores de
                    qualquer responsabilidade material ou moral.
                  </p>
                  <p>
                    É permitida uma aposta por jogo, podendo ser alterada quantas vezes desejar até{' '}
                    <strong className="text-white">1 hora antes</strong> do início da partida. O
                    sistema encerra as apostas automaticamente; nenhuma alteração é permitida após o
                    corte.
                  </p>
                  <p>
                    Os palpites dos demais participantes ficam visíveis{' '}
                    <strong className="text-white">somente após</strong> o encerramento das apostas
                    daquele jogo.
                  </p>
                  <p>
                    <strong className="text-white">Limite de apostas idênticas:</strong> máximo de{' '}
                    <strong className="text-white">18 apostas com o mesmo placar</strong> na fase de
                    grupos e <strong className="text-white">32</strong> na fase eliminatória por
                    usuário.
                  </p>
                  <p>
                    Participantes sem pagamento confirmado (nos bolões que cobram taxa) serão
                    removidos do bolão.
                  </p>
                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 2. Valor e Pagamento */}
            <AccordionItem value="valor-pagamento">
              <AccordionTrigger>Valor e Pagamento</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-5">

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Global</p>
                    <p className="mt-1">
                      <strong className="text-white">Gratuito.</strong> Sem taxa de inscrição e sem
                      premiação.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Família Trovão</p>
                    <p className="mt-1">
                      <strong className="text-white">Taxa de inscrição:</strong> R$ 50,00
                    </p>
                    <p className="mt-1">
                      <strong className="text-white">Chave PIX (telefone):</strong>{' '}
                      <span className="font-mono">83988269825</span>
                    </p>
                    <div className="mt-3">
                      <p className="mb-1 text-xs text-gray-400">PIX Copia e Cola:</p>
                      <div className="flex items-start gap-2 rounded-lg bg-gray-800 p-3">
                        <p className="flex-1 break-all font-mono text-xs text-gray-300">
                          {PIX_COPIA_COLA}
                        </p>
                        <button
                          onClick={copiarPix}
                          className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            copiado
                              ? 'bg-green-700 text-green-100'
                              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          }`}
                        >
                          {copiado ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                    <p className="mt-2">
                      Após o pagamento, avisar Fred Farias via WhatsApp:{' '}
                      <strong className="text-white">(83) 98826-9825</strong>
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Outros Bolões</p>
                    <p className="mt-1">
                      Valor e forma de pagamento combinados previamente com Fred Farias via
                      WhatsApp{' '}
                      <strong className="text-white">(83) 98826-9825</strong>. A precificação e
                      premiação são definidas exclusivamente pelo{' '}
                      <strong className="text-white">moderador do bolão</strong>.
                    </p>
                    <p className="mt-2 rounded-lg bg-gray-800 p-3 text-xs text-gray-400">
                      Fred Farias não tem qualquer responsabilidade legal sobre bolões de terceiros.
                      O intuito é puramente recreativo.
                    </p>
                  </div>

                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 3. Sistema de Pontuação */}
            <AccordionItem value="pontuacao">
              <AccordionTrigger>Sistema de Pontuação</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    Pontuação universal para todos os bolões. Os pontos{' '}
                    <strong className="text-white">não são cumulativos</strong> — o máximo por jogo
                    é o placar exato × o peso daquele jogo.
                  </p>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="pb-2 text-left text-gray-400">Acerto</th>
                        <th className="pb-2 text-right text-gray-400">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {[
                        ['Placar exato do jogo', '10'],
                        ['Placar exato do vencedor (sem acertar o do perdedor)', '6'],
                        ['Empate correto (sem acertar o placar exato)', '5'],
                        ['Placar exato do perdedor (sem acertar o do vencedor)', '4'],
                        ['Vencedor correto (sem acertar nenhum placar)', '2'],
                      ].map(([label, pts]) => (
                        <tr key={label}>
                          <td className="py-2 text-gray-300">{label}</td>
                          <td className="py-2 text-right font-bold text-yellow-400">{pts} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div>
                    <p className="mb-2 font-semibold text-white">Multiplicadores de Peso</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="pb-2 text-left text-gray-400">Situação</th>
                          <th className="pb-2 text-right text-gray-400">Peso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {[
                          ['Jogos de seleções ex-campeãs mundiais', 'x2'],
                          ['Jogos do Brasil (qualquer fase)', 'x3'],
                          ['Todos os jogos da 2ª fase (mata-mata)', 'x2'],
                          ['Brasil na 2ª fase', 'x3'],
                        ].map(([label, peso]) => (
                          <tr key={label}>
                            <td className="py-2 text-gray-300">{label}</td>
                            <td className="py-2 text-right font-bold text-yellow-400">{peso}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <p className="mb-2 font-semibold text-white">Limite de Apostas Idênticas</p>
                    <ul className="list-disc space-y-1 pl-4">
                      <li>
                        Fase de grupos: máximo de{' '}
                        <strong className="text-white">18 apostas com o mesmo placar</strong>
                      </li>
                      <li>
                        Fase eliminatória: máximo de{' '}
                        <strong className="text-white">32 apostas com o mesmo placar</strong>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionPanel>
            </AccordionItem>

            {/* 4. Premiação */}
            <AccordionItem value="premiacao">
              <AccordionTrigger>Premiação</AccordionTrigger>
              <AccordionPanel>
                <div className="space-y-5">

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Global</p>
                    <p className="mt-1">
                      <strong className="text-white">Sem premiação.</strong> Participação gratuita,
                      sem distribuição de prêmios.
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Bolão Família Trovão</p>
                    <p className="mt-1 mb-2">
                      Os 5 participantes com maior pontuação ao fim do bolão recebem:
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="pb-2 text-left text-gray-400">Posição</th>
                          <th className="pb-2 text-right text-gray-400">% do total arrecadado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {[
                          ['1º lugar', '45%'],
                          ['2º lugar', '25%'],
                          ['3º lugar', '15%'],
                          ['4º lugar', '10%'],
                          ['5º lugar', '5%'],
                        ].map(([pos, pct]) => (
                          <tr key={pos}>
                            <td className="py-2 font-medium text-white">{pos}</td>
                            <td className="py-2 text-right text-yellow-400">{pct}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold text-white">
                        Critérios de desempate (em ordem):
                      </p>
                      <ol className="list-decimal space-y-1 pl-4 text-xs">
                        <li>Maior número de placares exatos</li>
                        <li>Maior número de acertos do placar do vencedor</li>
                        <li>E assim sucessivamente, seguindo a ordem da tabela de pontuação</li>
                        <li>
                          Persistindo o empate: a premiação das posições empatadas é somada e
                          dividida igualmente
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-yellow-400">Outros Bolões</p>
                    <p className="mt-1">
                      Premiação definida exclusivamente pelo moderador. Fred Farias não tem
                      responsabilidade sobre a distribuição de prêmios de bolões de terceiros.
                    </p>
                  </div>

                </div>
              </AccordionPanel>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </div>
  );
}

export default function RegulamentoPage() {
  return (
    <Suspense>
      <RegulamentoConteudo />
    </Suspense>
  );
}
