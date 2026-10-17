<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Instructor\CourseBuilderController;
use App\Http\Controllers\LandingController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicCourseController;
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

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
