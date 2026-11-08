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
use Illuminate\Support\Facades\Password;
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

        $user = User::create([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'password' => Hash::make(Str::random(40)), // define a sua no convite
            'role_id' => Role::where('name', $data['role'])->value('id'),
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $token = Password::broker()->createToken($user);
        $url = url(route('password.reset', ['token' => $token, 'email' => $user->email], false));
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

        $user->forceFill([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'role_id' => Role::where('name', $data['role'])->value('id'),
        ])->save();

        return back()->with('status', __('Alterações guardadas.'));
    }

    /** Desativar: a pessoa deixa de conseguir entrar. */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->id === $request->user()->id, 422, __('Não podes desativar a tua própria conta.'));
        if ($user->isAdmin()) {
            $this->keepOneAdmin($user);
        }
        \Illuminate\Support\Facades\DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();

        return back()->with('status', __(':name já não consegue entrar. Podes reativar a conta quando quiseres.', ['name' => $user->name]));
    }

    public function restore(int $id): RedirectResponse
    {
        $user = User::onlyTrashed()->findOrFail($id);
        $user->restore();

        return back()->with('status', __('Conta de :name reativada.', ['name' => $user->name]));
    }

    /** Permissões por perfil (o admin tem sempre todas). */
    public function permissions(Request $request): RedirectResponse
    {
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

    private function keepOneAdmin(User $user): void
    {
        $admins = User::whereHas('role', fn ($q) => $q->where('name', 'admin'))->whereKeyNot($user->id)->count();
        if ($admins === 0) {
            throw ValidationException::withMessages(['role' => __('A plataforma precisa de pelo menos um admin.')]);
        }
    }
}
