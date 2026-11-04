<?php

namespace App\Http\Controllers;

use App\Services\StudentArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Início: o dashboard em painéis (ver PRODUCT.md, "Nova aparência da plataforma"). */
class DashboardController extends Controller
{
    public function __invoke(Request $request, StudentArea $area): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard', [
            'courses' => $area->courses($user),
            'resume' => $area->resume($user),
            'pending' => $area->pending($user),
            'results' => $area->results($user, 3),
            'notes' => $area->notes($user),
            'messages' => $area->messages($user),
            'suggestions' => $area->suggestions($user),
            'alexUrl' => $area->alexUrl($user),
            'savedLayout' => $area->layout($user, 'home'),
        ]);
    }
}
