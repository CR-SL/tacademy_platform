<?php

namespace App\Support;

/**
 * Permissões da plataforma, atribuídas por perfil na Administração › Permissões.
 * O admin tem sempre todas. Os valores iniciais são os de antes de haver permissões configuráveis.
 */
class Permissions
{
    /** chave => o que deixa fazer (texto em português; traduz-se ao mostrar) */
    public const ALL = [
        'cursos.criar' => 'Criar e editar os próprios cursos',
        'cursos.publicar' => 'Publicar os próprios cursos no catálogo',
        'cursos.todos' => 'Editar qualquer curso do catálogo',
        'equipa' => 'Acompanhar a sua equipa, enviar lembretes e atribuir cursos',
        'pedidos' => 'Tratar pedidos e autorizar compras',
        'equipas' => 'Criar e gerir equipas de empresas',
        'estatisticas' => 'Ver a Administração e as estatísticas',
        'pessoas' => 'Gerir pessoas e permissões',
    ];

    public const DEFAULTS = [
        'aluno' => [],
        'formador' => ['cursos.criar', 'cursos.publicar'],
        'team_leader' => ['equipa'],
        'gestor_cursos' => ['pedidos', 'equipas'],
    ];

    /** Perfis pela ordem em que aparecem, com o nome a mostrar e uma frase. */
    public const ROLES = [
        'aluno' => ['Aluno', 'Vê o catálogo, compra e faz cursos.'],
        'formador' => ['Formador', 'Cria cursos no editor e confirma presenças.'],
        'team_leader' => ['Team leader', 'Acompanha a equipa da sua empresa.'],
        'gestor_cursos' => ['Gestor de cursos', 'Trata pedidos, equipas e compras.'],
        'admin' => ['Admin', 'Tem acesso a tudo.'],
    ];

    public static function keys(): array
    {
        return array_keys(self::ALL);
    }
}
