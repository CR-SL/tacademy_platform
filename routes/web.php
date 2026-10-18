<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Instructor\CourseBuilderController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicCourseController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\Staff\RequestController;
use App\Http\Controllers\Staff\TeamController as StaffTeamController;
use App\Http\Controllers\Team\TeamController;
use Illuminate\Support\Facades\Route;

// Landing page pública (Blade). /home é um atalho para a mesma página.
Route::get('/', LandingController::class)->name('home');
Route::permanentRedirect('/home', '/');

// Catálogo público de cursos (Blade)
Route::get('/cursos', PublicCourseController::class)->name('courses');

// Contactos (público): formulário com limite de 5 envios por minuto por IP
Route::get('/contactos', [ContactController::class, 'show'])->name('contacts');
Route::post('/contactos', [ContactController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('contacts.store');

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Catálogo dentro da plataforma (com sessão). O /cursos é o catálogo público.
Route::get('/plataforma/cursos', CatalogController::class)
    ->middleware(['auth', 'verified'])
    ->name('catalog');

// "Os meus cursos": só formadores e admins (CoursePolicy + Gate::before do admin)
Route::middleware(['auth', 'verified', 'can:viewAny,App\Models\Course'])
    ->prefix('formador')->name('instructor.')->controller(CourseBuilderController::class)
    ->group(function () {
        Route::get('/cursos', 'index')->name('courses.index');
        Route::get('/cursos/novo', 'create')->name('courses.create');
        Route::post('/cursos', 'store')->name('courses.store');
        Route::get('/cursos/{course}/editar', 'edit')->name('courses.edit');
        Route::put('/cursos/{course}', 'update')->name('courses.update');
        Route::post('/cursos/{course}/publicar', 'publish')->name('courses.publish');
        Route::post('/cursos/{course}/rascunho', 'unpublish')->name('courses.unpublish');
        Route::delete('/cursos/{course}', 'destroy')->name('courses.destroy');
        Route::post('/uploads', 'upload')->middleware('throttle:60,1')->name('uploads');
    });

// Compra a título pessoal (pagamento simulado → pedido "Pago" que o Gestor de Cursos autoriza)
Route::post('/cursos/{course:slug}/comprar', [PurchaseController::class, 'store'])
    ->middleware(['auth', 'verified', 'throttle:10,1'])
    ->name('courses.purchase');

// "Equipa": só o team leader, e só a sua equipa
Route::middleware(['auth', 'verified', 'role:team_leader'])->group(function () {
    Route::get('/equipa', [TeamController::class, 'show'])->name('team.show');
    Route::post('/equipa/pedidos', [TeamController::class, 'requestChange'])->middleware('throttle:10,1')->name('team.request');
});

// "Pedidos" e "Equipas": Gestor de Cursos e admin
Route::middleware(['auth', 'verified', 'role:gestor_cursos,admin'])->prefix('gestao')->name('staff.')->group(function () {
    Route::get('/pedidos', [RequestController::class, 'index'])->name('requests.index');
    Route::patch('/pedidos/{contactRequest}', [RequestController::class, 'update'])->name('requests.update');
    Route::post('/pedidos/{contactRequest}/responder', [RequestController::class, 'reply'])->name('requests.reply');
    Route::post('/pedidos/{contactRequest}/equipa', [RequestController::class, 'createTeam'])->name('requests.team');
    Route::post('/pedidos/{contactRequest}/autorizar', [RequestController::class, 'authorizePurchase'])->name('requests.authorize');
    Route::get('/equipas', [StaffTeamController::class, 'index'])->name('teams.index');
    Route::get('/equipas/{company}', [StaffTeamController::class, 'show'])->name('teams.show');
    Route::put('/equipas/{company}', [StaffTeamController::class, 'update'])->name('teams.update');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
