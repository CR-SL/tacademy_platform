<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * Catálogo dentro da plataforma (/plataforma/cursos): o mesmo catálogo da landing (/cursos),
 * com a navbar da plataforma, para o aluno ver e comprar cursos sem sair.
 */
class CatalogController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Catalog', PublicCourseController::catalog());
    }
}
