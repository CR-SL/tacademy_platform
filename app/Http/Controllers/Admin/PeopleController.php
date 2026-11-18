<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\PlatformMail;
use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Administração › Pessoas e Permissões. A empresa de cada pessoa trata-se em Equipas (mexe nos cursos da equipa).
 * Desativar uma conta = a pessoa deixa de entrar (fica guardada e pode ser reativada).
 */
class PeopleController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')],
            'role' => ['required', Rule::in(array_keys(Permissions::ROLES))],
        ], [
            'email.unique' => __('Já existe uma conta com este email.'),
        ]);
        $this->guardRole($data['role'], null);
        $this->guardAdmin($request, $data['role'], null);

        $user = User::create([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'password' => Hash::make(Str::random(40)), // define a sua no convite
            'role_id' => Role::where('name', $data['role'])->value('id'),
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $url = \App\Support\InviteLink::url($user); // link do convite: 3 dias
        PlatformMail::inLocaleOf($user, fn () => PlatformMail::deliver($user->email, new PlatformMail(
            subjectLine: __('Tens uma conta na T.Academy'),
            heading: __('Olá :name, já tens acesso à T.Academy', ['name' => Str::before($user->name, ' ')]),
            lines: [__('Criámos-te uma conta na plataforma de cursos T.Academy.'), __('Define a tua palavra-passe para começar.')],
            actionText: __('Definir palavra-passe'),
            actionUrl: $url,
        )));

        return back()->with('status', __('Conta criada. :name recebeu um email para definir a palavra-passe.', ['name' => $user->name]));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in(array_keys(Permissions::ROLES))],
        ], [
            'email.unique' => __('Já existe uma conta com este email.'),
        ]);
        $me = $request->user();
        if ($user->id === $me->id && $data['role'] !== $user->role?->name) {
            throw ValidationException::withMessages(['role' => __('Não podes mudar o teu próprio perfil.')]);
        }
        if ($user->isAdmin() && $data['role'] !== 'admin') {
            $this->keepOneAdmin($user);
        }
        $this->guardRole($data['role'], $user);
        $this->guardAdmin($request, $data['role'], $user);

        $oldEmail = $user->email;
        $user->forceFill([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'role_id' => Role::where('name', $data['role'])->value('id'),
        ]);
        $emailChanged = $user->isDirty('email');
        if ($emailChanged) {
            // Email mudado pela gestão (auditoria, ponto 14): o novo tem de ser confirmado pela pessoa, e o antigo é avisado.
            // Assim, quem tem "pessoas" não consegue passar uma conta para um email seu sem a pessoa saber.
            $user->email_verified_at = null;
        }
        $user->save();

        if ($emailChanged) {
            try {
                $user->sendEmailVerificationNotification();
            } catch (\Throwable $e) {
                report($e); // a pessoa pode pedir outro na página de confirmação
            }
            PlatformMail::inLocaleOf($user, fn () => PlatformMail::deliver($oldEmail, new PlatformMail(
                subjectLine: __('O email da tua conta T.Academy mudou'),
                heading: __('Olá :name, o email da tua conta mudou', ['name' => Str::before($user->name, ' ')]),
                lines: [
                    __('A equipa da T.Academy mudou o email da tua conta para :email.', ['email' => $user->email]),
                    __('Se não pediste esta mudança, responde a este email ou fala connosco.'),
                ],
            )));

            return back()->with('status', __('Alterações guardadas. :name tem de confirmar o email novo; o antigo foi avisado.', ['name' => $user->name]));
        }

        return back()->with('status', __('Alterações guardadas.'));
    }

    /** Desativar: a pessoa deixa de conseguir entrar. */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->id === $request->user()->id, 422, __('Não podes desativar a tua própria conta.'));
        abort_if($user->isAdmin() && ! $request->user()->isAdmin(), 403, __('Só um admin pode desativar a conta de outro admin.'));
        if ($user->isAdmin()) {
            $this->keepOneAdmin($user);
        }
        \Illuminate\Support\Facades\DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();

        return back()->with('status', __(':name já não consegue entrar. Podes reativar a conta quando quiseres.', ['name' => $user->name]));
    }

    public function restore(Request $request, int $id): RedirectResponse
    {
        $user = User::onlyTrashed()->findOrFail($id);
        // Apagada pela própria pessoa (RGPD): já não tem dados para reativar
        if ($user->isErased()) {
            return back()->withErrors(['person' => __('Esta conta foi apagada pela própria pessoa e não se pode reativar.')]);
        }
        abort_if($user->isAdmin() && ! $request->user()->isAdmin(), 403, __('Só um admin pode reativar a conta de um admin.'));
        $user->restore();

        return back()->with('status', __('Conta de :name reativada.', ['name' => $user->name]));
    }

    /** Permissões por perfil (o admin tem sempre todas). */
    public function permissions(Request $request): RedirectResponse
    {
        // Só o admin: quem tem "pessoas" podia dar ao seu perfil todas as permissões
        abort_unless($request->user()->isAdmin(), 403);
        $data = $request->validate([
            'role' => ['required', Rule::in(array_diff(array_keys(Permissions::ROLES), ['admin']))],
            'permissions' => ['present', 'array'],
            'permissions.*' => [Rule::in(Permissions::keys())],
        ]);
        $role = Role::firstOrCreate(['name' => $data['role']]);
        $role->forceFill(['permissions' => array_values(array_unique($data['permissions']))])->save();

        return back()->with('status', __('Permissões de :role guardadas.', ['role' => __(Permissions::ROLES[$data['role']][0])]));
    }

    /** Um team leader acompanha a equipa da sua empresa: sem empresa, o perfil não faz sentido. */
    private function guardRole(string $role, ?User $user): void
    {
        if ($role === 'team_leader' && ! $user?->company_id) {
            throw ValidationException::withMessages(['role' => __('Um team leader tem de pertencer a uma equipa. Trata disso em Equipas.')]);
        }
    }

    /**
     * Quem tem a permissão "pessoas" mas não é admin gere as outras contas, mas não cria admins, não promove
     * ninguém a admin e não mexe em contas de admin (senão podia tornar-se admin a si próprio).
     */
    private function guardAdmin(Request $request, string $role, ?User $user): void
    {
        if ($request->user()->isAdmin()) return;
        if ($role === 'admin' || $user?->isAdmin()) {
            throw ValidationException::withMessages(['role' => __('Só um admin pode dar o perfil de admin ou alterar a conta de um admin.')]);
        }
    }

    private function keepOneAdmin(User $user): void
    {
        $admins = User::whereHas('role', fn ($q) => $q->where('name', 'admin'))->whereKeyNot($user->id)->count();
        if ($admins === 0) {
            throw ValidationException::withMessages(['role' => __('A plataforma precisa de pelo menos um admin.')]);
        }
    }
}
