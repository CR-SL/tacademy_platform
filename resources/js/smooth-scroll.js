// Scroll suave (subtil) nas páginas públicas: landing, cursos e contactos. A plataforma não o usa.
// Só atua na roda do rato/trackpad (no toque fica o scroll nativo) e fica desligado com "reduzir movimento".
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // O CSS das páginas públicas tem scroll-behavior: smooth (para as âncoras); com o Lenis a mover
    // a página, esse suavizar nativo faria cada passo "arrastar" — as âncoras passam a ser do Lenis.
    document.documentElement.style.scrollBehavior = 'auto';

    const lenis = new Lenis({
        lerp: 0.12, // subtil: tira os solavancos sem "arrastar" a página
        autoRaf: true,
        anchors: { offset: -66 }, // links #secção descontam a navbar fixa
        allowNestedScroll: true, // listas e painéis com scroll próprio continuam a funcionar
        // Painéis por cima da página (detalhe do curso, pesquisa, login) fazem o seu scroll nativo
        prevent: (node) => !!node.closest?.('[data-drawer], [data-sheet], [data-login-pop], [role="dialog"]'),
    });

    // Quando um painel bloqueia o scroll da página (body overflow: hidden), o Lenis também para
    const sync = () => (document.body.style.overflow === 'hidden' ? lenis.stop() : lenis.start());
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['style'] });
}
