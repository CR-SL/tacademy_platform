// Protótipos do login — formulário de demonstração (não autentica nada).
// Escreve a palavra-passe "erro" para ver o estado de erro.
window.LoginDemo = function ({ onSubmit, onError, onSuccess } = {}) {
    const form = document.querySelector('[data-login]');
    const pass = form.querySelector('[name=password]');
    const err = form.querySelector('.lg-err');
    const btn = form.querySelector('.lg-submit');
    const label = btn.textContent;

    form.querySelector('[data-toggle-pass]')?.addEventListener('click', (e) => {
        const show = pass.type === 'password';
        pass.type = show ? 'text' : 'password';
        e.currentTarget.textContent = show ? 'ESCONDER' : 'MOSTRAR';
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        err.textContent = '';
        const email = form.querySelector('[name=email]').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !pass.value) {
            err.textContent = 'Escreve o teu email e a palavra-passe.';
            form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
            return;
        }
        btn.disabled = true;
        btn.textContent = 'A ENTRAR…';
        onSubmit?.();
        setTimeout(() => {
            btn.disabled = false;
            if (pass.value === 'erro') {
                btn.textContent = label;
                err.textContent = 'Email ou palavra-passe incorretos.';
                form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
                onError?.();
            } else {
                btn.textContent = 'BEM-VINDO ✓';
                onSuccess?.();
            }
        }, 1800);
    });
};

// Formulário comum aos três conceitos
window.loginFormHTML = (title = 'Bem-vindo de volta.', lead = 'Entra para continuar a tua formação.') => `
<form class="lg-form" data-login novalidate>
    <h1>${title}</h1>
    <p class="lead">${lead}</p>
    <div class="lg-field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" placeholder="nome@oficina.pt"></div>
    <div class="lg-field"><label for="password">Palavra-passe <a href="#">Esqueceste-te?</a></label>
        <div class="lg-pass"><input id="password" name="password" type="password" autocomplete="current-password"><button type="button" data-toggle-pass>MOSTRAR</button></div>
    </div>
    <div class="lg-row"><label><input type="checkbox"> Manter sessão iniciada</label></div>
    <span class="lg-err" role="alert"></span>
    <button class="btn btn-accent cut-8 lg-submit" type="submit">ENTRAR ▶</button>
    <p class="lg-alt">Ainda não tens conta? <a href="#">Criar conta</a></p>
    <p class="demo-note">Demonstração: escreve a palavra-passe «erro» para veres o estado de erro.</p>
</form>`;
