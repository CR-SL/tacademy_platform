<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\AlexController;
use App\Http\Controllers\Admin\AreaController;
use App\Http\Controllers\Admin\PeopleController as AdminPeopleController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CourseViewController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\CourseMessageController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Instructor\CourseBuilderController;
use App\Http\Controllers\Instructor\HomeController as InstructorHomeController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Learn\CourseController as LearnCourseController;
use App\Http\Controllers\Learn\LessonController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\PanelLayoutController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicCourseController;
use App\Http\Controllers\PurchaseController;
use App\Http\Controllers\Staff\RequestController;
use App\Http\Controllers\Staff\TeamController as StaffTeamController;
use App\Http\Controllers\StudentAreaController;
use App\Http\Controllers\Team\TeamController;
use Illuminate\Support\Facades\Route;

// Entrada da plataforma: quem já tem sessão vai para o Início (middleware guest).
// O website (landing Blade) deixou de estar em /; os ficheiros ficam até ser retirado de vez.
Route::get('/', [AuthenticatedSessionController::class, 'create'])->middleware('guest')->name('home');
Route::permanentRedirect('/home', '/');

// Língua da plataforma (botão PT · EN e Definições); funciona com e sem sessão
Route::put('/lingua', LocaleController::class)->middleware('throttle:30,1')->name('locale');

// As páginas públicas antigas (Blade) saíram a 2026-11-10: a plataforma é só uma app.
// Os links antigos continuam a funcionar e levam ao catálogo e aos contactos da plataforma.
Route::permanentRedirect('/cursos', '/plataforma/cursos');
Route::permanentRedirect('/contactos', '/plataforma/contactos');

// Catálogo e contactos abertos a quem ainda não tem conta; comprar pede sessão
Route::get('/plataforma/cursos', CatalogController::class)->name('catalog');
Route::get('/plataforma/contactos', [ContactController::class, 'show'])->name('contacts');
Route::post('/plataforma/contactos', [ContactController::class, 'store'])->middleware('throttle:5,1')->name('contacts.store');

Route::get('/dashboard', DashboardController::class)
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

// Clique num curso do catálogo (para as estatísticas da Administração)
Route::post('/plataforma/cursos/{course:slug}/visto', CourseViewController::class)
    ->middleware(['auth', 'throttle:120,1'])
    ->name('catalog.view');

// Páginas em painéis do aluno, disposição das caixas e mensagens com o formador
Route::middleware(['auth', 'verified'])->prefix('plataforma')->group(function () {
    Route::get('/meus-cursos', [StudentAreaController::class, 'courses'])->name('student.courses');
    Route::get('/avaliacoes', [StudentAreaController::class, 'assessments'])->name('student.assessments');
    Route::get('/documentos', [StudentAreaController::class, 'documents'])->name('student.documents');
    Route::get('/certificados', [StudentAreaController::class, 'certificates'])->name('student.certificates');
    Route::put('/paineis/{view}', [PanelLayoutController::class, 'update'])->middleware('throttle:120,1')->name('panels.update');
    Route::delete('/paineis/{view}', [PanelLayoutController::class, 'destroy'])->middleware('throttle:120,1')->name('panels.destroy');
    Route::post('/mensagens', [CourseMessageController::class, 'store'])->middleware('throttle:30,1')->name('messages.store');
    Route::post('/mensagens/lidas', [CourseMessageController::class, 'read'])->middleware('throttle:120,1')->name('messages.read');
    // Conversas com o Alex (Tavus): o limite diário está no AlexService; aqui só se trava o abuso de pedidos
    Route::post('/alex/conversas', [AlexController::class, 'store'])->middleware('throttle:10,1')->name('alex.start');
    Route::post('/alex/conversas/{conversation}/terminar', [AlexController::class, 'end'])->middleware('throttle:30,1')->name('alex.end');
});

// Avisos do Tavus sobre as conversas do Alex (assinados; sem sessão nem CSRF)
Route::post('/webhooks/tavus', [AlexController::class, 'webhook'])->middleware('throttle:120,1')->name('alex.webhook');

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

// Avaliações do formador (navegação "só o seu trabalho")
Route::middleware(['auth', 'verified', 'can:viewAny,App\Models\Course'])
    ->prefix('formador')->name('instructor.')->controller(InstructorHomeController::class)
    ->group(function () {
        // O Início do formador passou para o Início de todos (/dashboard), com ?conversa=… das mensagens
        Route::get('/', fn (\Illuminate\Http\Request $r) => redirect('/dashboard'.($r->getQueryString() ? '?'.$r->getQueryString() : '')))->name('home');
        Route::get('/avaliacoes', 'assessments')->name('assessments');
    });

// Compra a título pessoal (pagamento simulado → pedido "Pago" que o Gestor de Cursos autoriza)
Route::post('/cursos/{course:slug}/comprar', [PurchaseController::class, 'store'])
    ->middleware(['auth', 'verified', 'throttle:10,1'])
    ->name('courses.purchase');

// "Equipa": só o team leader, e só a sua equipa
Route::middleware(['auth', 'verified', 'can:equipa'])->group(function () {
    Route::get('/equipa', [TeamController::class, 'show'])->name('team.show');
    Route::post('/equipa/pedidos', [TeamController::class, 'requestChange'])->middleware('throttle:10,1')->name('team.request');
    Route::post('/equipa/lembretes', [TeamController::class, 'remind'])->middleware('throttle:10,1')->name('team.remind');
    Route::post('/equipa/atribuir', [TeamController::class, 'assign'])->middleware('throttle:10,1')->name('team.assign');
});

// "Pedidos" e "Equipas": Gestor de Cursos e admin
Route::middleware(['auth', 'verified'])->prefix('gestao')->name('staff.')->group(function () {
    Route::middleware('can:pedidos')->group(function () {
        Route::get('/pedidos', [RequestController::class, 'index'])->name('requests.index');
        Route::patch('/pedidos/{contactRequest}', [RequestController::class, 'update'])->name('requests.update');
        Route::post('/pedidos/{contactRequest}/responder', [RequestController::class, 'reply'])->name('requests.reply');
        Route::post('/pedidos/{contactRequest}/equipa', [RequestController::class, 'createTeam'])->name('requests.team');
        Route::post('/pedidos/{contactRequest}/autorizar', [RequestController::class, 'authorizePurchase'])->name('requests.authorize');
    });
    Route::middleware('can:equipas')->group(function () {
        Route::get('/equipas', [StaffTeamController::class, 'index'])->name('teams.index');
        Route::get('/equipas/{company}', [StaffTeamController::class, 'show'])->name('teams.show');
        Route::put('/equipas/{company}', [StaffTeamController::class, 'update'])->name('teams.update');
    });
});

// Administração: estatísticas, catálogo, pessoas e permissões (cada secção pede a sua permissão)
Route::middleware(['auth', 'verified'])->prefix('administracao')->name('admin.')->group(function () {
    Route::get('/cursos/{course}', [AdminController::class, 'course'])->middleware('can:estatisticas')->name('course');
    Route::post('/pessoas', [AdminPeopleController::class, 'store'])->middleware(['can:pessoas', 'throttle:30,1'])->name('people.store');
    Route::put('/pessoas/{user}', [AdminPeopleController::class, 'update'])->middleware('can:pessoas')->name('people.update');
    Route::delete('/pessoas/{user}', [AdminPeopleController::class, 'destroy'])->middleware('can:pessoas')->name('people.destroy');
    Route::post('/pessoas/{id}/reativar', [AdminPeopleController::class, 'restore'])->middleware('can:pessoas')->name('people.restore');
    Route::put('/permissoes', [AdminPeopleController::class, 'permissions'])->middleware('can:pessoas')->name('permissions');
    Route::middleware('can:cursos.todos')->group(function () {
        Route::post('/areas', [AreaController::class, 'store'])->name('areas.store');
        Route::put('/areas/{category}', [AreaController::class, 'update'])->name('areas.update');
        Route::delete('/areas/{category}', [AreaController::class, 'destroy'])->name('areas.destroy');
    });
    Route::get('/{section?}', [AdminController::class, 'index'])->whereIn('section', AdminController::SECTIONS)->name('index');
});

Route::middleware('auth')->group(function () {
    // Definições (conta, aparência). /profile ficou como endereço antigo e leva para aqui.
    Route::get('/definicoes', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::put('/definicoes/tema', [ProfileController::class, 'theme'])->name('profile.theme');
    Route::put('/definicoes/notificacoes', [ProfileController::class, 'notifications'])->name('profile.notifications');
    Route::redirect('/profile', '/definicoes');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
