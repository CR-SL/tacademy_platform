<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Curso de demonstração completo ("Mecânica Automóvel — Formação Completa"), escrito de raiz em português,
 * para experimentar todos os tipos de aula: vídeo por link, avatar IA, documento, texto e quiz.
 * Todos os vídeos usam o mesmo vídeo de exemplo. Os PDFs ficam no projeto em public/cursos-demo/.
 * Corre só uma vez (se o curso já existir não faz nada).
 */
class DemoCourseSeeder extends Seeder
{
    private const SLUG = 'mecanica-automovel-formacao-completa';

    private const VIDEO = 'https://www.youtube.com/watch?v=baKzmOEP9D8';

    private const AVATAR = 'https://example.com/avatar/tacademy-demo'; // a substituir pelo link real da plataforma do avatar

    public function run(): void
    {
        if (Course::withTrashed()->where('slug', self::SLUG)->exists()) {
            return;
        }
        $category = Category::where('slug', 'diagnostico-automovel')->first();
        $instructor = User::where('email', 'formador@tacademy.pt')->first();
        if (! $category) {
            return; // precisa das categorias do DemoContentSeeder
        }

        DB::transaction(function () use ($category, $instructor) {
            $course = Course::create([
                'category_id' => $category->id,
                'instructor_id' => $instructor?->id,
                'title' => 'Mecânica Automóvel — Formação Completa',
                'slug' => self::SLUG,
                'short_description' => 'Do chassis à eletricidade: as bases da mecânica automóvel, com segurança na oficina, travões, suspensão, motor e transmissão.',
                'description' => "Uma formação completa para quem está a começar na oficina ou quer consolidar as bases. Percorre os grandes sistemas do automóvel — estrutura, travagem, suspensão, motor, transmissão e sistema elétrico — sempre ligado ao trabalho real: como funciona, o que avaria e como verificar.\n\nCada módulo termina com um pequeno teste para consolidar o que aprendeste, e no fim há um teste final que dá acesso ao certificado T.Academy.",
                'learning_outcomes' => [
                    'Trabalhar em segurança na oficina e organizar desmontagens e montagens',
                    'Identificar os tipos de chassis, travões e suspensão e as suas avarias típicas',
                    'Explicar o funcionamento dos motores a 2 e a 4 tempos e da caixa manual',
                    'Aplicar a lei de Ohm e medir tensão, corrente e resistência com o multímetro',
                    'Diagnosticar o sistema de carga, o arranque, fusíveis e relés',
                ],
                'prerequisites' => 'Nenhum — curso de iniciação',
                'audience' => 'Aprendizes, técnicos em início de carreira e quem quer consolidar as bases da mecânica automóvel',
                'level' => 'iniciante',
                'thumbnail_url' => '/images/cursos/cta-motor.jpg',
                'status' => 'published',
                'price' => 149,
                'is_free' => false,
                'currency' => 'EUR',
                'access_months' => 12,
                'unlock_window' => 5, // ficam sempre 5 aulas por fazer abertas
                'certificate_enabled' => true,
                'certificate_min_progress' => 100,
                'certificate_min_score' => 70,
            ]);

            $minutes = 0;
            $first = null;
            foreach ($this->program() as $mi => [$title, $desc, $lessons]) {
                $module = Module::create(['course_id' => $course->id, 'title' => $title, 'description' => $desc, 'order_index' => $mi]);
                foreach ($lessons as $li => $l) {
                    [$type, $lTitle, $min] = $l;
                    $lesson = Lesson::create([
                        'module_id' => $module->id,
                        'title' => $lTitle,
                        'content_type' => $type,
                        'content_url' => $type === 'video_link' ? self::VIDEO : null,
                        'avatar_ref' => $type === 'avatar' ? self::AVATAR : null,
                        'body' => $type === 'text' ? $l[3] : null,
                        'duration_seconds' => $min * 60,
                        'order_index' => $li,
                    ]);
                    $minutes += $min;
                    $first ??= $lesson;

                    // Perguntas rápidas do fim do vídeo (mini-quiz: responder é obrigatório, acertar não)
                    if ($type === 'video_link') {
                        foreach ($this->checks()[$lTitle] ?? [] as $ci => [$question, $options, $correct, $explanation]) {
                            $lesson->checks()->create([
                                'question' => $question, 'options' => $options, 'correct' => $correct,
                                'explanation' => $explanation, 'order_index' => $ci,
                            ]);
                        }
                    }
                    if ($type === 'document') {
                        [$name, $path] = $l[3];
                        $lesson->attachments()->create(['name' => $name, 'path' => $path, 'size' => (int) @filesize(public_path(ltrim($path, '/'))), 'order_index' => 0]);
                    }
                    if ($type === 'quiz') {
                        $quiz = $lesson->quiz()->create(['title' => $lTitle, 'passing_score' => 70, 'max_attempts' => 3]);
                        foreach ($l[3] as $qi => [$question, $options, $correct]) {
                            $q = $quiz->questions()->create(['question' => $question, 'order_index' => $qi]);
                            foreach ($options as $oi => $text) {
                                $q->options()->create(['option_text' => $text, 'is_correct' => $oi === $correct]);
                            }
                        }
                    }
                }
            }

            $course->forceFill(['duration_minutes' => $minutes, 'sample_lesson_id' => $first?->id])->save();
        });
    }

    /** [título do módulo, descrição, [[tipo, título, minutos, extra], …]] */
    private function program(): array
    {
        $v = 'video_link';

        return [
            ['Introdução', 'Boas-vindas e como tirar o melhor partido da formação.', [
                [$v, 'Bem-vindo à formação', 4],
                ['text', 'Como funciona este curso', 3, "Esta formação está organizada em 10 módulos, do mais geral para o mais técnico. As aulas abrem por ordem: conclui cada uma para desbloquear a seguinte.\n\nNas aulas de vídeo, quando terminares, carrega em «Marcar como concluída». No fim de cada módulo há um pequeno teste (nota mínima de 70%, até 3 tentativas) e, no fim do curso, o teste final.\n\nPara obteres o certificado precisas de concluir todas as aulas e ter nota mínima de 70% nos testes.\n\nDica: tem um bloco de notas à mão — vais encontrar valores de referência (binários, tensões, calibres) que dá jeito ter sempre por perto na oficina."],
            ]],
            ['Princípios da reparação automóvel', 'Segurança, organização e método antes de pegar na primeira ferramenta.', [
                [$v, 'O que todo o técnico deve saber', 8],
                [$v, 'Regras de segurança na oficina', 9],
                [$v, 'A arte de desmontar e montar', 10],
                ['document', 'Ficha de segurança da oficina', 5, ['ficha-seguranca-oficina.pdf', '/cursos-demo/ficha-seguranca-oficina.pdf']],
                ['quiz', 'Teste: segurança e boas práticas', 5, [
                    ['Ao elevar um veículo para trabalhar por baixo, o que é obrigatório?', ['Apoiá-lo em cavaletes nos pontos indicados pelo fabricante', 'Deixá-lo apenas no macaco hidráulico', 'Desligar a bateria'], 0],
                    ['Antes de intervir num circuito elétrico, deve-se desligar…', ['O borne positivo da bateria', 'O borne negativo da bateria', 'Os faróis'], 1],
                    ['O que fazer ao óleo usado?', ['Deitar no esgoto com bastante água', 'Entregar como resíduo perigoso, no contentor próprio', 'Misturar com o combustível'], 1],
                    ['Ao desmontar um conjunto, é boa prática…', ['Fotografar e organizar as peças pela ordem de desmontagem', 'Juntar todos os parafusos numa só caixa', 'Apertar tudo no máximo ao voltar a montar'], 0],
                ]],
            ]],
            ['Chassis', 'A estrutura do automóvel: tipos, vantagens e onde se usam.', [
                [$v, 'O que é o chassis', 6],
                [$v, 'Chassis de longarinas (escada)', 5],
                [$v, 'Chassis de espinha central', 4],
                [$v, 'Monobloco', 6],
                [$v, 'Chassis tubular', 5],
                ['quiz', 'Teste: chassis', 4, [
                    ['Qual o tipo de chassis mais usado nos automóveis ligeiros atuais?', ['Monobloco', 'Longarinas (escada)', 'Tubular'], 0],
                    ['O chassis de longarinas é típico de…', ['Carros de competição', 'Pick-ups, camiões e todo-o-terreno', 'Citadinos elétricos'], 1],
                    ['O chassis tubular é usado sobretudo em…', ['Veículos de competição e desportivos artesanais', 'Autocarros', 'Carrinhas de distribuição'], 0],
                ]],
            ]],
            ['Travões', 'Do pedal à roda: sistema hidráulico, tambores e discos.', [
                [$v, 'Como funcionam os travões', 8],
                [$v, 'Travões de tambor', 9],
                [$v, 'Travões de disco', 10],
                ['quiz', 'Teste: travões', 5, [
                    ['Num sistema hidráulico, o pedal atua diretamente sobre…', ['A bomba de travão (cilindro mestre)', 'A bomba da direção', 'O alternador'], 0],
                    ['Os travões de disco dissipam melhor o calor do que os de tambor.', ['Verdadeiro', 'Falso'], 0],
                    ['Um pedal de travão «esponjoso» indica normalmente…', ['Ar no circuito hidráulico', 'Discos novos', 'Pneus com pressão a mais'], 0],
                    ['Nos travões de tambor, o atrito é feito por…', ['Pastilhas contra um disco', 'Maxilas (calços) contra o tambor', 'O cabo do travão de mão'], 1],
                ]],
            ]],
            ['Suspensão', 'Os principais esquemas de suspensão e como reconhecê-los.', [
                [$v, 'Os 8 tipos de suspensão', 9],
                [$v, 'Suspensão de duplos triângulos', 6],
                [$v, 'Suspensão multibraço', 6],
                [$v, 'Eixo rígido', 7],
                [$v, 'Suspensão McPherson', 6],
                [$v, 'Suspensão independente', 6],
                [$v, 'Suspensão pneumática', 7],
                ['quiz', 'Teste: suspensão', 4, [
                    ['A suspensão McPherson junta num só conjunto…', ['O amortecedor e a mola, servindo também de pivô da direção', 'A caixa e o diferencial', 'O radiador e a ventoinha'], 0],
                    ['Numa suspensão independente…', ['Cada roda move-se sem afetar diretamente a do lado oposto', 'As duas rodas estão ligadas por um eixo rígido', 'Não existem amortecedores'], 0],
                    ['A suspensão pneumática usa…', ['Foles de ar no lugar das molas helicoidais', 'Molas de lâmina', 'Apenas barras de torção'], 0],
                ]],
            ]],
            ['Motor', 'Como o motor transforma combustível em movimento.', [
                [$v, 'Combustão interna vs. externa', 6],
                [$v, 'Motor a 2 tempos', 8],
                [$v, 'Motor a 4 tempos', 9],
                ['avatar', 'Pergunta ao formador virtual', 5],
                ['quiz', 'Teste: motor', 4, [
                    ['Qual a ordem dos tempos num motor a 4 tempos?', ['Admissão, compressão, expansão, escape', 'Compressão, admissão, escape, expansão', 'Admissão, escape, compressão, expansão'], 0],
                    ['Num motor a 2 tempos, um ciclo completo faz-se em…', ['Uma volta da cambota', 'Duas voltas da cambota', 'Quatro voltas da cambota'], 0],
                    ['Num motor de combustão externa o combustível é queimado…', ['Dentro dos cilindros', 'Fora do motor, aquecendo um fluido (ex.: máquina a vapor)', 'No tubo de escape'], 1],
                ]],
            ]],
            ['Transmissão', 'A caixa manual por dentro: veios, engrenagens e sincronização.', [
                [$v, 'Caixa manual: visão geral', 8],
                [$v, 'Os veios da caixa', 6],
                [$v, 'Embraiagem de garras', 5],
                [$v, 'Sincronizadores', 7],
                [$v, 'A marcha-atrás', 5],
                ['quiz', 'Teste: transmissão', 4, [
                    ['Os sincronizadores servem para…', ['Igualar velocidades antes de engrenar, evitando «arranhar»', 'Aumentar a potência do motor', 'Arrefecer o óleo da caixa'], 0],
                    ['Na marcha-atrás, o sentido de rotação inverte-se graças a…', ['Uma engrenagem intermédia (carreto louco)', 'O diferencial', 'A embraiagem'], 0],
                    ['O veio que recebe o movimento vindo da embraiagem é o…', ['Veio primário (de entrada)', 'Veio de transmissão traseiro', 'Semieixo'], 0],
                ]],
            ]],
            ['Fundamentos de eletricidade', 'Tensão, corrente, resistência e potência — a base de todo o diagnóstico elétrico.', [
                [$v, 'O que é a eletricidade', 6],
                [$v, 'A corrente elétrica', 5],
                [$v, 'Condutores e isoladores', 5],
                [$v, 'Potência: o watt', 4],
                [$v, 'Intensidade: o ampere', 5],
                [$v, 'Tensão: o volt', 5],
                [$v, 'Corrente alternada e contínua', 6],
                ['text', 'A lei de Ohm na prática', 6, "Três grandezas que vais medir todos os dias:\n• Tensão (V, volt) — a «pressão» elétrica. Mede-se em paralelo.\n• Corrente (I, ampere) — o caudal de eletricidade. Mede-se em série.\n• Resistência (R, ohm) — a oposição à passagem da corrente. Mede-se com o circuito desligado.\n\nLei de Ohm: V = R × I. Logo, I = V ÷ R e R = V ÷ I.\nPotência: P = V × I (em watts).\n\nExemplo 1 — Uma lâmpada de 55 W num circuito de 12 V consome I = 55 ÷ 12 ≈ 4,6 A. Um fusível de 10 A protege-a com folga.\n\nExemplo 2 — Uma bobina de relé com 80 Ω alimentada a 12 V consome I = 12 ÷ 80 = 0,15 A.\n\nNa oficina: uma queda de tensão superior a 0,5 V num cabo ou ligação com o circuito a funcionar indica mau contacto ou oxidação — é das avarias mais comuns e das mais fáceis de encontrar com o multímetro."],
                ['quiz', 'Teste: fundamentos de eletricidade', 5, [
                    ['A tensão mede-se em…', ['Volts (V)', 'Amperes (A)', 'Watts (W)'], 0],
                    ['Com 12 V aplicados a uma resistência de 6 Ω passa uma corrente de…', ['2 A', '72 A', '0,5 A'], 0],
                    ['Uma lâmpada de 12 V que consome 5 A tem uma potência de…', ['60 W', '17 W', '2,4 W'], 0],
                    ['A bateria do automóvel fornece corrente…', ['Contínua (DC)', 'Alternada (AC)'], 0],
                ]],
            ]],
            ['Sistemas elétricos do automóvel', 'Carga, arranque, centralina, segurança e iluminação.', [
                [$v, 'O papel da eletricidade no automóvel', 6],
                [$v, 'Antirroubo e segurança', 6],
                [$v, 'A centralina (ECU)', 7],
                [$v, 'O sistema de carga', 8],
                [$v, 'O motor de arranque', 7],
                [$v, 'O sistema de iluminação', 6],
                ['quiz', 'Teste: sistemas elétricos', 4, [
                    ['Com o motor a trabalhar, quem carrega a bateria e alimenta o sistema elétrico?', ['O alternador', 'O motor de arranque', 'A centralina'], 0],
                    ['Uma tensão de carga normal, medida na bateria com o motor ligado, é de cerca de…', ['13,8 a 14,7 V', '9 a 10 V', '24 V'], 0],
                    ['A centralina (ECU)…', ['Lê sensores e comanda atuadores, como injetores e ignição', 'Só controla os vidros elétricos', 'Substitui a bateria'], 0],
                ]],
            ]],
            ['Componentes elétricos e cablagem', 'Baterias, fusíveis, relés e outros componentes — e como testá-los.', [
                [$v, 'Componentes elétricos', 6],
                [$v, 'Baterias', 8],
                [$v, 'Interruptores', 5],
                [$v, 'Fusíveis de lâmina', 5],
                [$v, 'Besouros (sinais sonoros)', 4],
                [$v, 'Relés', 7],
                [$v, 'Resistências', 6],
                ['document', 'Guia rápido: fusíveis e relés', 4, ['tabela-fusiveis-reles.pdf', '/cursos-demo/tabela-fusiveis-reles.pdf']],
                ['quiz', 'Teste final', 10, [
                    ['Qual o calibre de um fusível de lâmina azul?', ['15 A', '10 A', '20 A'], 0],
                    ['Num relé, os terminais 85 e 86 correspondem…', ['À bobina de comando', 'À alimentação e à saída', 'À massa do chassis'], 0],
                    ['Se um fusível volta a queimar depois de substituído, deve-se…', ['Procurar o curto-circuito ou consumo anormal', 'Colocar um fusível de calibre maior', 'Ligar diretamente com um fio'], 0],
                    ['Num motor a 4 tempos, a ignição da mistura acontece…', ['No fim da compressão, iniciando a expansão', 'Durante a admissão', 'Durante o escape'], 0],
                    ['Qual destes é um sinal de ar no circuito de travões?', ['Pedal esponjoso', 'Volante a vibrar a alta velocidade', 'Luz da bateria acesa'], 0],
                    ['O monobloco caracteriza-se por…', ['A carroçaria e o chassis formarem uma só estrutura', 'Ter longarinas separadas da carroçaria', 'Ser feito de tubos soldados'], 0],
                    ['Com 12 V e 3 A, a potência é de…', ['36 W', '4 W', '15 W'], 0],
                    ['Antes de trabalhar debaixo de um carro elevado, deve-se…', ['Apoiá-lo em cavaletes', 'Confiar no macaco hidráulico', 'Desligar o rádio'], 0],
                ]],
            ]],
        ];
    }

    /** Perguntas rápidas por aula de vídeo: título => [[pergunta, opções, certa, explicação], …] */
    private function checks(): array
    {
        return [
            'Bem-vindo à formação' => [
                ['Quantos módulos tem esta formação?', ['5', '10', '20'], 1, 'São 10 módulos, do mais geral (segurança e estrutura) ao mais técnico (eletricidade).'],
                ['O que é preciso para obter o certificado?', ['Ver só os vídeos', 'Concluir todas as aulas e ter 70% nos testes', 'Responder às perguntas rápidas'], 1, 'As perguntas rápidas servem para fixar a matéria; o certificado depende das aulas concluídas e da nota dos testes.'],
            ],
            'O que todo o técnico deve saber' => [
                ['Antes de substituir uma peça, o técnico deve…', ['Confirmar a avaria com testes', 'Trocar logo a peça mais provável', 'Perguntar ao cliente o preço'], 0, 'Trocar peças «à sorte» custa tempo e dinheiro: primeiro observa-se e testa-se.'],
                ['O manual de reparação do fabricante serve para…', ['Consultar valores de referência e procedimentos', 'Nada, a experiência chega', 'Só para carros elétricos'], 0, 'Binários de aperto, folgas e esquemas mudam de modelo para modelo.'],
            ],
            'Regras de segurança na oficina' => [
                ['Qual destes é equipamento de proteção individual?', ['Óculos de proteção', 'Chave dinamométrica', 'Elevador'], 0, 'Óculos, luvas e calçado de segurança são EPI; as ferramentas não.'],
                ['O que se deve fazer antes de mexer em circuitos elétricos?', ['Desligar o borne negativo da bateria', 'Ligar o motor', 'Abrir as portas'], 0, 'Desligar o negativo evita curto-circuitos acidentais contra a massa do carro.'],
            ],
            'A arte de desmontar e montar' => [
                ['Uma boa forma de garantir uma montagem correta é…', ['Fotografar e organizar as peças pela ordem', 'Confiar na memória', 'Juntar tudo numa caixa'], 0, 'Fotografias e tabuleiros organizados poupam muito tempo na montagem.'],
                ['Os parafusos devem ser apertados…', ['Com o binário indicado pelo fabricante', 'Sempre no máximo', 'Só à mão'], 0, 'Aperto a mais parte roscas ou deforma peças; a menos pode soltar-se.'],
            ],
            'O que é o chassis' => [
                ['A principal função do chassis é…', ['Suportar os componentes e as cargas do veículo', 'Arrefecer o motor', 'Gerar eletricidade'], 0, 'É a estrutura onde assentam motor, suspensão, carroçaria e ocupantes.'],
                ['O chassis influencia a segurança em caso de colisão?', ['Sim', 'Não'], 0, 'A forma como a estrutura se deforma absorve energia e protege os ocupantes.'],
            ],
            'Chassis de longarinas (escada)' => [
                ['O chassis de longarinas é formado por…', ['Duas vigas longitudinais unidas por travessas', 'Uma única peça com a carroçaria', 'Uma rede de tubos finos'], 0, 'O desenho lembra uma escada — daí o nome.'],
                ['Uma vantagem deste chassis é…', ['Grande resistência para cargas e reboque', 'Ser o mais leve possível', 'Não precisar de carroçaria'], 0, 'Por isso é usado em pick-ups, camiões e todo-o-terreno.'],
            ],
            'Chassis de espinha central' => [
                ['Neste chassis, a estrutura principal é…', ['Um tubo central forte que liga a frente à traseira', 'Duas longarinas laterais', 'A própria carroçaria'], 0, 'O tubo central muitas vezes também aloja o veio de transmissão.'],
                ['O chassis de espinha central é comum em…', ['Alguns desportivos e veículos especiais', 'Todos os citadinos', 'Autocarros'], 0, 'É rígido à torção, mas pouco usado na produção em massa.'],
            ],
            'Monobloco' => [
                ['No monobloco…', ['Carroçaria e chassis formam uma só estrutura', 'O chassis é aparafusado à carroçaria', 'Não há estrutura metálica'], 0, 'É o tipo mais usado nos ligeiros atuais: leve e seguro.'],
                ['Um dano estrutural num monobloco deve ser reparado…', ['Com medição e banco de alinhamento', 'Só com massa e pintura', 'Não precisa de reparação'], 0, 'As cotas da estrutura afetam a geometria e a segurança passiva.'],
            ],
            'Chassis tubular' => [
                ['O chassis tubular é construído com…', ['Tubos soldados em treliça', 'Chapa estampada', 'Madeira'], 0, 'A treliça de tubos dá muita rigidez com pouco peso.'],
                ['Onde é mais usado?', ['Competição e desportivos artesanais', 'Camiões de longo curso', 'Carros de família'], 0, 'É caro de produzir, por isso fica reservado a séries pequenas.'],
            ],
            'Como funcionam os travões' => [
                ['O sistema de travagem transforma a energia do movimento em…', ['Calor', 'Eletricidade', 'Combustível'], 0, 'O atrito converte a energia cinética em calor — por isso os travões aquecem.'],
                ['O líquido de travões deve ser substituído porque…', ['Absorve humidade com o tempo', 'Evapora-se todos os meses', 'Muda de cor ao sol'], 0, 'A humidade baixa o ponto de ebulição e pode causar perda de travagem.'],
            ],
            'Travões de tambor' => [
                ['Nos travões de tambor, as maxilas…', ['Abrem contra o interior do tambor', 'Apertam um disco', 'Ficam fora da roda'], 0, 'Os cilindros de roda empurram as maxilas contra o tambor.'],
                ['Ainda é comum encontrar travões de tambor…', ['No eixo traseiro de alguns ligeiros', 'Na frente dos desportivos', 'Em nenhum carro atual'], 0, 'Atrás o esforço de travagem é menor e o tambor integra bem o travão de mão.'],
            ],
            'Travões de disco' => [
                ['Nos travões de disco, o atrito é feito entre…', ['As pastilhas e o disco', 'As maxilas e o tambor', 'O pneu e a estrada'], 0, 'A pinça aperta as pastilhas contra as duas faces do disco.'],
                ['Um disco empenado provoca normalmente…', ['Vibração no pedal ou no volante ao travar', 'Luz do óleo acesa', 'Consumo excessivo'], 0, 'A espessura irregular faz a pinça «bater» a cada volta.'],
            ],
            'Os 8 tipos de suspensão' => [
                ['A suspensão serve para…', ['Manter as rodas em contacto com a estrada e dar conforto', 'Aumentar a potência', 'Travar o carro'], 0, 'Absorve irregularidades e mantém a aderência dos pneus.'],
                ['Molas e amortecedores têm a mesma função?', ['Não: a mola suporta, o amortecedor controla a oscilação', 'Sim, são a mesma peça', 'Só existem em camiões'], 0, 'Sem amortecedor, a mola continuaria a oscilar depois de cada lomba.'],
            ],
            'Suspensão de duplos triângulos' => [
                ['Este esquema usa…', ['Dois braços em forma de triângulo por roda', 'Um eixo rígido', 'Apenas um amortecedor'], 0, 'Os triângulos superior e inferior controlam bem a geometria da roda.'],
                ['Uma vantagem é…', ['Bom controlo da inclinação da roda em curva', 'Ser o esquema mais barato', 'Não ter casquilhos'], 0, 'Por isso é comum em desportivos e SUV de gama alta.'],
            ],
            'Suspensão multibraço' => [
                ['A suspensão multibraço usa…', ['Três ou mais braços por roda', 'Uma única barra', 'Molas de lâmina'], 0, 'Cada braço controla um movimento, afinando conforto e estabilidade.'],
                ['Um ponto a vigiar nestas suspensões é…', ['O desgaste dos vários casquilhos', 'A pressão do óleo do motor', 'O nível do líquido do limpa-vidros'], 0, 'Muitos braços = muitos casquilhos; folgas dão ruídos e desgaste irregular dos pneus.'],
            ],
            'Eixo rígido' => [
                ['No eixo rígido…', ['As duas rodas estão ligadas por um eixo comum', 'Cada roda é independente', 'Não há molas'], 0, 'Um solavanco numa roda afeta também a do lado oposto.'],
                ['É comum em…', ['Veículos de carga e todo-o-terreno', 'Carros de Fórmula 1', 'Motas'], 0, 'É simples, robusto e aguenta muita carga.'],
            ],
            'Suspensão McPherson' => [
                ['A McPherson junta…', ['Amortecedor e mola num só conjunto, que também serve de pivô da direção', 'Caixa e diferencial', 'Radiador e ventoinha'], 0, 'É compacta e barata — a mais comum na frente dos ligeiros.'],
                ['Um ruído ao rodar o volante parado pode indicar…', ['Rolamento do apoio superior gasto', 'Pastilhas novas', 'Óleo do motor baixo'], 0, 'O apoio superior roda com a direção; quando gasto, estala ou range.'],
            ],
            'Suspensão independente' => [
                ['Numa suspensão independente…', ['Cada roda reage sem afetar diretamente a outra', 'As rodas estão soldadas ao chassis', 'Só a traseira tem molas'], 0, 'Melhora o conforto e a aderência em pisos irregulares.'],
                ['McPherson e duplos triângulos são suspensões…', ['Independentes', 'De eixo rígido'], 0, 'Ambas permitem que cada roda trabalhe por si.'],
            ],
            'Suspensão pneumática' => [
                ['Na suspensão pneumática, as molas são substituídas por…', ['Foles de ar', 'Barras de torção', 'Blocos de borracha'], 0, 'Um compressor enche os foles e permite ajustar a altura.'],
                ['Um carro com suspensão pneumática «em baixo» de manhã indica…', ['Fuga de ar num fole ou nas tubagens', 'Pneus novos', 'Bateria carregada'], 0, 'Durante a noite o ar escapa e o carro desce.'],
            ],
            'Combustão interna vs. externa' => [
                ['Num motor de combustão interna, o combustível queima…', ['Dentro dos cilindros', 'Numa caldeira exterior', 'No escape'], 0, 'É o caso dos motores a gasolina e a gasóleo dos automóveis.'],
                ['Um exemplo de combustão externa é…', ['A máquina a vapor', 'O motor a gasóleo', 'O motor elétrico'], 0, 'O combustível aquece água numa caldeira e é o vapor que move o motor.'],
            ],
            'Motor a 2 tempos' => [
                ['Num motor a 2 tempos há explosão…', ['Em cada volta da cambota', 'De duas em duas voltas', 'De quatro em quatro voltas'], 0, 'Por isso é leve e potente para o tamanho, mas mais poluente.'],
                ['Muitos motores a 2 tempos lubrificam-se…', ['Com óleo misturado na gasolina', 'Com água', 'Sem qualquer óleo'], 0, 'É a «mistura» das motas pequenas e das motosserras.'],
            ],
            'Motor a 4 tempos' => [
                ['Qual é o tempo em que o pistão sobe e comprime a mistura?', ['Compressão', 'Admissão', 'Escape'], 0, 'Admissão → compressão → expansão (explosão) → escape.'],
                ['Num ciclo completo, a cambota dá…', ['Duas voltas', 'Uma volta', 'Quatro voltas'], 0, 'Cada tempo corresponde a meia volta da cambota.'],
            ],
            'Caixa manual: visão geral' => [
                ['A caixa de velocidades serve para…', ['Adaptar a força e a velocidade do motor às rodas', 'Arrefecer o motor', 'Carregar a bateria'], 0, 'As relações curtas dão força; as longas dão velocidade com menos rotação.'],
                ['Para engrenar uma mudança na caixa manual é preciso…', ['Carregar na embraiagem', 'Desligar o motor', 'Puxar o travão de mão'], 0, 'A embraiagem separa o motor da caixa durante a troca.'],
            ],
            'Os veios da caixa' => [
                ['O veio primário recebe o movimento…', ['Da embraiagem', 'Das rodas', 'Do alternador'], 0, 'É o veio de entrada da caixa.'],
                ['O veio secundário transmite o movimento…', ['Para o diferencial e as rodas', 'Para o motor de arranque', 'Para a bomba de água'], 0, 'É o veio de saída, com as engrenagens de cada mudança.'],
            ],
            'Embraiagem de garras' => [
                ['A embraiagem de garras liga…', ['Uma engrenagem ao veio através de dentes laterais', 'O motor à bateria', 'As duas rodas traseiras'], 0, 'Quando engata, a engrenagem passa a rodar solidária com o veio.'],
                ['Sem sincronização, engatar as garras a velocidades diferentes provoca…', ['Ruído e desgaste («arranhar»)', 'Mais potência', 'Menos consumo'], 0, 'É por isso que existem os sincronizadores.'],
            ],
            'Sincronizadores' => [
                ['O sincronizador iguala…', ['As velocidades da engrenagem e do veio antes de engatar', 'A pressão dos pneus', 'A temperatura do óleo'], 0, 'Funciona por atrito, como uma pequena embraiagem cónica.'],
                ['Uma mudança que «arranha» ao engatar pode indicar…', ['Sincronizador gasto', 'Pneus gastos', 'Bateria fraca'], 0, 'Também pode ser embraiagem que não desliga totalmente.'],
            ],
            'A marcha-atrás' => [
                ['A inversão do sentido de rotação na marcha-atrás é feita por…', ['Uma engrenagem intermédia (carreto louco)', 'O diferencial', 'O motor de arranque'], 0, 'O carreto intermédio inverte o sentido entre os veios.'],
                ['Porque é que a marcha-atrás «arranha» se engatada em andamento?', ['Muitas vezes não tem sincronizador', 'Porque tem óleo a mais', 'Porque o motor está frio'], 0, 'Deve engatar-se sempre com o carro parado.'],
            ],
            'O que é a eletricidade' => [
                ['A corrente elétrica é…', ['O movimento ordenado de eletrões', 'Calor a passar num fio', 'Um tipo de combustível'], 0, 'Os eletrões deslocam-se pelo condutor do negativo para o positivo.'],
                ['Para haver corrente é preciso…', ['Um circuito fechado', 'Um circuito aberto', 'Só um fio solto'], 0, 'Se o circuito abrir (fio partido, fusível queimado), a corrente para.'],
            ],
            'A corrente elétrica' => [
                ['A intensidade da corrente mede-se em…', ['Amperes', 'Volts', 'Ohms'], 0, 'O ampere mede a quantidade de corrente que passa.'],
                ['Para medir corrente, o amperímetro liga-se…', ['Em série com o circuito', 'Em paralelo com a bateria', 'Desligado do circuito'], 0, 'Ligado em paralelo, o amperímetro faz curto-circuito — cuidado!'],
            ],
            'Condutores e isoladores' => [
                ['Qual destes materiais é um bom condutor?', ['Cobre', 'Borracha', 'Plástico'], 0, 'Por isso os fios são de cobre e o revestimento é de plástico.'],
                ['O isolamento dos cabos serve para…', ['Evitar curto-circuitos e choques', 'Aumentar a corrente', 'Arrefecer o cobre'], 0, 'Isolamento danificado é uma causa frequente de avarias elétricas.'],
            ],
            'Potência: o watt' => [
                ['A potência elétrica calcula-se com…', ['P = V × I', 'P = V ÷ I', 'P = R + I'], 0, 'Tensão vezes corrente dá a potência em watts.'],
                ['Uma lâmpada de 21 W a 12 V consome cerca de…', ['1,75 A', '21 A', '252 A'], 0, 'I = P ÷ V = 21 ÷ 12 ≈ 1,75 A.'],
            ],
            'Intensidade: o ampere' => [
                ['Um consumidor que precisa de mais potência, à mesma tensão, puxa…', ['Mais corrente', 'Menos corrente', 'A mesma corrente'], 0, 'Com V fixo, a corrente aumenta com a potência.'],
                ['O fusível protege o circuito contra…', ['Corrente excessiva', 'Tensão baixa', 'Temperatura do motor'], 0, 'Funde quando a corrente passa o calibre, antes de os cabos aquecerem.'],
            ],
            'Tensão: o volt' => [
                ['A tensão de uma bateria de 12 V em repouso e carregada é de cerca de…', ['12,6 V', '10 V', '15 V'], 0, 'Abaixo de 12,4 V em repouso a bateria já está parcialmente descarregada.'],
                ['O voltímetro liga-se…', ['Em paralelo com o componente', 'Em série com o circuito', 'Sem tocar no circuito'], 0, 'Mede-se a diferença de tensão entre dois pontos.'],
            ],
            'Corrente alternada e contínua' => [
                ['O alternador produz inicialmente corrente…', ['Alternada, depois retificada para contínua', 'Contínua', 'Nenhuma'], 0, 'A ponte de díodos converte AC em DC para carregar a bateria.'],
                ['A corrente da bateria é…', ['Contínua', 'Alternada'], 0, 'Tem sempre o mesmo sentido: do positivo para o negativo pelo circuito.'],
            ],
            'O papel da eletricidade no automóvel' => [
                ['Qual destes sistemas depende da eletricidade?', ['Injeção, ignição e iluminação', 'Só o rádio', 'Nenhum, o carro é mecânico'], 0, 'Nos carros atuais quase todos os sistemas são controlados eletronicamente.'],
                ['A «massa» do automóvel é…', ['O retorno negativo pela carroçaria', 'O peso do carro', 'O cabo positivo'], 0, 'Uma má massa provoca avarias intermitentes difíceis de encontrar.'],
            ],
            'Antirroubo e segurança' => [
                ['O imobilizador impede o arranque se…', ['A chave não for reconhecida', 'O depósito estiver cheio', 'As luzes estiverem ligadas'], 0, 'Um chip na chave comunica com a centralina antes de autorizar o arranque.'],
                ['Ao substituir a centralina ou a chave pode ser preciso…', ['Codificar/programar os componentes', 'Trocar os pneus', 'Mudar o óleo'], 0, 'Sem programação o imobilizador continua a bloquear o motor.'],
            ],
            'A centralina (ECU)' => [
                ['A centralina recebe informação de…', ['Sensores', 'Pneus', 'Bancos'], 0, 'Lê sensores (temperatura, rotação, oxigénio…) e decide como comandar os atuadores.'],
                ['Os códigos de avaria ficam guardados…', ['Na memória da centralina', 'No painel de instrumentos apenas', 'Na bateria'], 0, 'Leem-se com o equipamento de diagnóstico pela ficha OBD.'],
            ],
            'O sistema de carga' => [
                ['Com o motor ligado, a tensão na bateria deve estar entre…', ['13,8 e 14,7 V', '9 e 10 V', '20 e 24 V'], 0, 'Abaixo disto o alternador não carrega; acima pode estragar a bateria.'],
                ['A luz da bateria acesa com o motor a trabalhar indica…', ['Problema no sistema de carga', 'Bateria nova', 'Óleo baixo'], 0, 'Pode ser alternador, correia ou ligações.'],
            ],
            'O motor de arranque' => [
                ['O motor de arranque consome uma corrente…', ['Muito elevada durante o arranque', 'Desprezável', 'Igual a uma lâmpada'], 0, 'Pode passar de 150 A — por isso precisa de cabos grossos e boa bateria.'],
                ['Ouvir só um «clique» ao rodar a chave pode indicar…', ['Bateria fraca ou má ligação', 'Pneus vazios', 'Filtro de ar sujo'], 0, 'O solenoide atua, mas não há corrente suficiente para o motor rodar.'],
            ],
            'O sistema de iluminação' => [
                ['Se só uma lâmpada de travagem não acende, a causa mais provável é…', ['A própria lâmpada ou o casquilho', 'O alternador', 'A centralina do motor'], 0, 'Se as duas falhassem, o mais provável seria o interruptor ou o fusível.'],
                ['Um pisca que pisca muito depressa indica normalmente…', ['Uma lâmpada fundida nesse lado', 'Bateria carregada', 'Pneus novos'], 0, 'A menor carga altera o ritmo do relé de pisca.'],
            ],
            'Componentes elétricos' => [
                ['Qual destes é um componente de proteção?', ['Fusível', 'Lâmpada', 'Motor do limpa-vidros'], 0, 'O fusível protege a cablagem contra sobrecorrentes.'],
                ['Um relé permite…', ['Comandar uma corrente forte com uma corrente fraca', 'Aumentar a tensão', 'Guardar energia'], 0, 'O interruptor do painel comanda o relé, e o relé alimenta o consumidor.'],
            ],
            'Baterias' => [
                ['A capacidade de uma bateria indica-se em…', ['Ampere-hora (Ah)', 'Watts', 'Volts'], 0, 'Ex.: 60 Ah. A corrente de arranque a frio (CCA) indica-se em amperes.'],
                ['Antes de desligar a bateria, desliga-se primeiro…', ['O borne negativo', 'O borne positivo', 'Tanto faz'], 0, 'Assim a chave não faz curto-circuito se tocar na carroçaria.'],
            ],
            'Interruptores' => [
                ['Um interruptor serve para…', ['Abrir ou fechar um circuito', 'Aumentar a corrente', 'Medir a tensão'], 0, 'Fechado deixa passar corrente; aberto interrompe-a.'],
                ['Um interruptor com mau contacto provoca…', ['Funcionamento intermitente ou queda de tensão', 'Mais potência', 'Nada'], 0, 'Mede-se a queda de tensão no interruptor com o circuito ligado.'],
            ],
            'Fusíveis de lâmina' => [
                ['Um fusível de lâmina amarelo tem…', ['20 A', '10 A', '30 A'], 0, 'Castanho claro 5 A, vermelho 10 A, azul 15 A, amarelo 20 A, verde 30 A.'],
                ['Pode substituir-se um fusível por um de calibre superior?', ['Não', 'Sim, se for maior é melhor'], 0, 'Um calibre maior deixa os cabos aquecer — risco de incêndio.'],
            ],
            'Besouros (sinais sonoros)' => [
                ['No automóvel, os besouros servem para…', ['Avisos sonoros (cinto, luzes, sensores)', 'Carregar a bateria', 'Arrefecer o motor'], 0, 'Alertam o condutor sem precisar de olhar para o painel.'],
                ['Um besouro que não toca pode ter…', ['Falta de alimentação, massa ou o próprio besouro avariado', 'Pneus gastos', 'Óleo velho'], 0, 'Testa-se aplicando 12 V diretamente.'],
            ],
            'Relés' => [
                ['Num relé de 4 pinos, os terminais 30 e 87 são…', ['A alimentação e a saída para o consumidor', 'A bobina', 'A massa'], 0, '85 e 86 são a bobina de comando.'],
                ['Ouvir o «clique» do relé garante que está bom?', ['Não, os contactos podem estar queimados', 'Sim, sempre'], 0, 'É preciso confirmar a continuidade entre 30 e 87 com a bobina alimentada.'],
            ],
            'Resistências' => [
                ['A resistência mede-se em…', ['Ohms (Ω)', 'Amperes', 'Watts'], 0, 'E mede-se sempre com o circuito desligado.'],
                ['Com 12 V e uma resistência de 4 Ω, a corrente é de…', ['3 A', '48 A', '0,33 A'], 0, 'I = V ÷ R = 12 ÷ 4 = 3 A.'],
            ],
        ];
    }
}
