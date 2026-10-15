// Dados dos protótipos da página pública "Cursos".
// ex:false = curso real da base de dados · ex:true = curso de EXEMPLO (só para mostrar o catálogo com mais áreas)
window.CURSOS = [
 {
  "t": "Diagnóstico de Sistemas OBD-II",
  "area": "dia",
  "lvl": "intermedio",
  "min": 50,
  "price": 49.9,
  "desc": "Aprende a interpretar códigos de avaria, usar o scanner OBD-II e diagnosticar falhas em sistemas de injeção modernos.",
  "mods": 2,
  "lessons": 5,
  "ai": true,
  "ex": false,
  "code": "DIA-01",
  "img": "/images/cursos/obd-ii.jpg"
 },
 {
  "t": "Introdução à Eletrónica Automóvel",
  "area": "ele",
  "lvl": "iniciante",
  "min": 39,
  "price": 39.9,
  "desc": "Bases de eletricidade e eletrónica aplicadas ao automóvel: multímetro, circuitos, sensores e atuadores.",
  "mods": 2,
  "lessons": 4,
  "ai": false,
  "ex": false,
  "code": "ELE-01",
  "img": "/images/cursos/eletronica-intro.jpg"
 },
 {
  "t": "Diagnóstico de Falhas Elétricas",
  "area": "dia",
  "lvl": "intermedio",
  "min": 26,
  "price": 44.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "DIA-02",
  "img": "/images/cursos/falhas-eletricas.jpg"
 },
 {
  "t": "Scanner e Osciloscópio na Prática",
  "area": "dia",
  "lvl": "avancado",
  "min": 26,
  "price": 69.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "DIA-03",
  "img": "/images/cursos/scanner-osciloscopio.jpg"
 },
 {
  "t": "Redes CAN Bus no Automóvel",
  "area": "ele",
  "lvl": "avancado",
  "min": 26,
  "price": 59.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "ELE-02",
  "img": "/images/cursos/can-bus.jpg"
 },
 {
  "t": "Baterias e Sistemas de Carga",
  "area": "ele",
  "lvl": "iniciante",
  "min": 26,
  "price": 29.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "ELE-03",
  "img": "/images/cursos/baterias-carga.jpg"
 },
 {
  "t": "Gestão de Oficina Moderna",
  "area": "ges",
  "lvl": "iniciante",
  "min": 26,
  "price": 34.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "GES-01",
  "img": "/images/cursos/gestao-oficina.jpg"
 },
 {
  "t": "Atendimento e Fidelização de Clientes",
  "area": "ges",
  "lvl": "iniciante",
  "min": 26,
  "price": 24.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "GES-02",
  "img": "/images/cursos/atendimento.jpg"
 },
 {
  "t": "Orçamentação e Faturação",
  "area": "ges",
  "lvl": "intermedio",
  "min": 26,
  "price": 39.9,
  "desc": "Descrição de exemplo — a atualizar com o conteúdo real do curso.",
  "mods": 1,
  "lessons": 3,
  "ai": false,
  "ex": false,
  "code": "GES-03",
  "img": "/images/cursos/orcamentacao.jpg"
 },
 {
  "t": "Veículos Híbridos e Elétricos",
  "area": "hev",
  "lvl": "intermedio",
  "min": 90,
  "price": 129.9,
  "desc": "Segurança em alta tensão, baterias de tração, inversores e diagnóstico de sistemas híbridos.",
  "mods": 4,
  "lessons": 12,
  "ai": true,
  "ex": true,
  "code": "HEV-01",
  "img": "/images/cursos/hibridos-eletricos.jpg"
 },
 {
  "t": "Manutenção de Baterias de Alta Tensão",
  "area": "hev",
  "lvl": "avancado",
  "min": 75,
  "price": 149.9,
  "desc": "Isolamento, balanceamento de células e procedimentos de desmontagem segura.",
  "mods": 3,
  "lessons": 9,
  "ai": false,
  "ex": true,
  "code": "HEV-02",
  "img": "/images/cursos/baterias-alta-tensao.jpg"
 },
 {
  "t": "Sistemas de Travagem e ABS",
  "area": "cha",
  "lvl": "iniciante",
  "min": 45,
  "price": 59.9,
  "desc": "Componentes de travagem, purga, ABS e diagnóstico de sensores de roda.",
  "mods": 3,
  "lessons": 8,
  "ai": false,
  "ex": true,
  "code": "CHA-01",
  "img": "/images/cursos/travagem-abs.jpg"
 },
 {
  "t": "Geometria de Suspensão e Direção",
  "area": "cha",
  "lvl": "avancado",
  "min": 60,
  "price": 89.9,
  "desc": "Alinhamento, ângulos de suspensão e direção assistida elétrica.",
  "mods": 3,
  "lessons": 10,
  "ai": true,
  "ex": true,
  "code": "CHA-02",
  "img": "/images/cursos/geometria-suspensao.jpg"
 },
 {
  "t": "Reparação de Colisões e Estrutura",
  "area": "car",
  "lvl": "iniciante",
  "min": 55,
  "price": 79.9,
  "desc": "Avaliação de danos, medição de estrutura e técnicas de endireitamento.",
  "mods": 3,
  "lessons": 9,
  "ai": false,
  "ex": true,
  "code": "CAR-01",
  "img": "/images/cursos/colisoes-estrutura.jpg"
 },
 {
  "t": "Pintura e Repintura Automóvel",
  "area": "car",
  "lvl": "avancado",
  "min": 80,
  "price": 99.9,
  "desc": "Preparação de superfícies, colorimetria e aplicação de vernizes.",
  "mods": 4,
  "lessons": 11,
  "ai": false,
  "ex": true,
  "code": "CAR-02",
  "img": "/images/cursos/pintura.jpg"
 },
 {
  "t": "Calibração de ADAS",
  "area": "seg",
  "lvl": "intermedio",
  "min": 50,
  "price": 79.9,
  "desc": "Câmaras, radares e calibração estática e dinâmica dos sistemas de assistência.",
  "mods": 3,
  "lessons": 8,
  "ai": true,
  "ex": true,
  "code": "SEG-01",
  "img": "/images/cursos/adas.jpg"
 },
 {
  "t": "Airbags e Sistemas de Retenção",
  "area": "seg",
  "lvl": "iniciante",
  "min": 35,
  "price": 49.9,
  "desc": "Funcionamento, manuseamento seguro e diagnóstico de sistemas SRS.",
  "mods": 2,
  "lessons": 6,
  "ai": false,
  "ex": true,
  "code": "SEG-02",
  "img": "/images/cursos/airbags.jpg"
 },
 {
  "t": "Climatização A/C",
  "area": "ele",
  "lvl": "intermedio",
  "min": 40,
  "price": 54.9,
  "desc": "Ciclo frigorífico, carga de gás e deteção de fugas.",
  "mods": 2,
  "lessons": 7,
  "ai": false,
  "ex": true,
  "code": "ELE-04",
  "img": "/images/cursos/climatizacao.jpg"
 }
];
window.AREAS = {
 "dia": {
  "name": "Diagnóstico",
  "code": "DIA",
  "icon": "<path d=\"M2 14h4l2-7 3 12 3-9 2 4h6\"/><rect x=\"1\" y=\"3\" width=\"22\" height=\"18\" rx=\"1\"/>"
 },
 "ele": {
  "name": "Eletrónica",
  "code": "ELE",
  "icon": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\"/><path d=\"M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4\"/><rect x=\"9.5\" y=\"9.5\" width=\"5\" height=\"5\"/>"
 },
 "ges": {
  "name": "Gestão de Oficina",
  "code": "GES",
  "icon": "<rect x=\"4\" y=\"3\" width=\"16\" height=\"19\"/><path d=\"M9 3V1.5h6V3M8 16v-3M12 16v-6M16 16v-4\"/>"
 },
 "hev": {
  "name": "Híbridos e Elétricos",
  "code": "HEV",
  "icon": "<path d=\"M13 2 5 14h6l-1 8 8-12h-6z\"/>"
 },
 "cha": {
  "name": "Chassis",
  "code": "CHA",
  "icon": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v7M12 15v7M2 12h7M15 12h7\"/>"
 },
 "car": {
  "name": "Carroçaria",
  "code": "CAR",
  "icon": "<path d=\"M2 16v-3l3-5h11l4 5h2v3\"/><circle cx=\"7\" cy=\"17\" r=\"2\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/>"
 },
 "seg": {
  "name": "Segurança",
  "code": "SEG",
  "icon": "<path d=\"M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z\"/><path d=\"M8 12l3 3 5-6\"/>"
 }
};
window.LEVELS = { iniciante: ['Iniciante', 1], intermedio: ['Intermédio', 2], avancado: ['Avançado', 3] };
window.areaIcon = (a, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${AREAS[a].icon}</svg>`;
window.euro = (v) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
window.dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
