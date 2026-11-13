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
        // Caixas de aprender no Início (2026-11-10): os seus cursos, continuar, notas, resultados, sugestões
        'aprender' => 'Fazer cursos (as caixas de aluno no Início)',
        'cursos.criar' => 'Criar e editar os próprios cursos',
        'cursos.publicar' => 'Publicar os próprios cursos no catálogo',
        'cursos.todos' => 'Editar qualquer curso do catálogo',
        'cursos.alex' => 'Ligar o formador IA (Alex) nos cursos',
        'equipa' => 'Acompanhar a sua equipa, enviar lembretes e atribuir cursos',
        'pedidos' => 'Tratar pedidos e autorizar compras',
        'equipas' => 'Criar e gerir equipas de empresas',
        'estatisticas' => 'Ver a Administração e as estatísticas',
        'pessoas' => 'Gerir pessoas e permissões',
    ];

    public const DEFAULTS = [
        'aluno' => ['aprender'],
        'formador' => ['cursos.criar', 'cursos.publicar'],
        'team_leader' => ['aprender', 'equipa'],
        'gestor_cursos' => ['pedidos', 'equipas', 'cursos.alex'],
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
