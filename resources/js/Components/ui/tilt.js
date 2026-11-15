// Cartões de curso (catálogo e "Os meus cursos"): inclinação 3D com reflexo a seguir o rato.
// O cartão é o elemento com os eventos; o primeiro filho é a parte que se inclina e que leva
// as variáveis --gx/--gy do reflexo. Só com rato e sem "reduzir movimento".
const moves = () => window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;

export function tilt(e) {
    if (!moves()) return;
    const el = e.currentTarget.firstElementChild;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transition = 'transform .15s ease-out';
    el.style.transform = `translateY(-6px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg)`;
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
}

export function untilt(e) {
    const el = e.currentTarget.firstElementChild;
    el.style.transition = '';
    el.style.transform = '';
}
