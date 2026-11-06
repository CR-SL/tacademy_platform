<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\CourseMessageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Instructor\CourseBuilderController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\Learn\CourseController as LearnCourseController;
use App\Http\Controllers\Learn\LessonController;
use App\Http\Controllers\PanelLayoutController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicCourseController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\Staff\RequestController;
use App\Http\Controllers\Staff\TeamController as StaffTeamController;
use App\Http\Controllers\StudentAreaController;
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

// Páginas em painéis do aluno, disposição das caixas e mensagens com o formador
Route::middleware(['auth', 'verified'])->prefix('plataforma')->group(function () {
    Route::get('/meus-cursos', [StudentAreaController::class, 'courses'])->name('student.courses');
    Route::get('/avaliacoes', [StudentAreaController::class, 'assessments'])->name('student.assessments');
    Route::get('/documentos', [StudentAreaController::class, 'documents'])->name('student.documents');
    Route::put('/paineis/{view}', [PanelLayoutController::class, 'update'])->middleware('throttle:120,1')->name('panels.update');
    Route::delete('/paineis/{view}', [PanelLayoutController::class, 'destroy'])->middleware('throttle:120,1')->name('panels.destroy');
    Route::post('/mensagens', [CourseMessageController::class, 'store'])->middleware('throttle:30,1')->name('messages.store');
    Route::post('/mensagens/lidas', [CourseMessageController::class, 'read'])->middleware('throttle:120,1')->name('messages.read');
});

// Página do curso e da aula do aluno
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/plataforma/cursos/{course:slug}', LearnCourseController::class)->name('learn.course');
    Route::get('/plataforma/cursos/{course:slug}/aulas/{lesson}', [LessonController::class, 'show'])->name('learn.lesson');
    Route::middleware('throttle:120,1')->prefix('plataforma/aulas/{lesson}')->name('learn.')->group(function () {
        Route::post('/progresso', [LessonController::class, 'progress'])->name('progress');
        Route::post('/perguntas/{check}', [LessonController::class, 'check'])->name('check');
        Route::post('/quiz', [LessonController::class, 'quiz'])->name('quiz');
        Route::post('/notas', [LessonController::class, 'storeNote'])->name('notes.store');
        Route::delete('/notas/{note}', [LessonController::class, 'destroyNote'])->name('notes.destroy');
    });
});

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
        Route::get('/cursos/{course}/alunos', 'students')->name('courses.students');
        Route::post('/cursos/{course}/alunos/{student}/presenca', 'attendance')->middleware('throttle:120,1')->name('courses.attendance');
        Route::post('/uploads', 'upload')->middleware('throttle:60,1')->name('uploads');
        // Vídeo da aula, enviado aos pedaços (cada pedido fica abaixo dos limites do PHP e do proxy)
        Route::post('/videos', 'uploadVideo')->middleware('throttle:1200,1')->name('videos');
    });

// Compra a título pessoal (pagamento simulado → pedido "Pago" que o Gestor de Cursos autoriza)
Route::post('/cursos/{course:slug}/comprar', [PurchaseController::class, 'store'])
    ->middleware(['auth', 'verified', 'throttle:10,1'])
    ->name('courses.purchase');

// "Equipa": só o team leader, e só a sua equipa
Route::middleware(['auth', 'verified', 'role:team_leader'])->group(function () {
    Route::get('/equipa', [TeamController::class, 'show'])->name('team.show');
    Route::post('/equipa/pedidos', [TeamController::class, 'requestChange'])->middleware('throttle:10,1')->name('team.request');
    Route::post('/equipa/lembretes', [TeamController::class, 'remind'])->middleware('throttle:10,1')->name('team.remind');
    Route::post('/equipa/atribuir', [TeamController::class, 'assign'])->middleware('throttle:10,1')->name('team.assign');
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
