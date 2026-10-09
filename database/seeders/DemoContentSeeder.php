<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoContentSeeder extends Seeder
{
    public function run(): void
    {
        $roles = Role::pluck('id', 'name');

        // --- Utilizadores demo (password local: "password") ---
        $admin = User::firstOrCreate(
            ['email' => 'admin@tacademy.pt'],
            [
                'role_id' => $roles['admin'],
                'name' => 'Admin T.Academy',
                'password' => Hash::make('password'),
                'level' => 'gold',
                'email_verified_at' => now(),
            ]
        );

        $formador = User::firstOrCreate(
            ['email' => 'formador@tacademy.pt'],
            [
                'role_id' => $roles['formador'],
                'name' => 'João Formador',
                'password' => Hash::make('password'),
                'level' => 'silver',
                'email_verified_at' => now(),
            ]
        );

        $aluno = User::firstOrCreate(
            ['email' => 'aluno1@tacademy.pt'],
            [
                'role_id' => $roles['aluno'],
                'name' => 'Maria Aluna',
                'password' => Hash::make('password'),
                'streak_days' => 12,
                'last_active_at' => now(),
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'aluno2@tacademy.pt'],
            [
                'role_id' => $roles['aluno'],
                'name' => 'Pedro Aluno',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        // --- Categorias (cor + ícone para as "prateleiras") ---
        $diagnostico = Category::firstOrCreate(['slug' => 'diagnostico-automovel'], [
            'name' => 'Diagnóstico Automóvel',
            'color_hex' => '#2F6FED',
            'icon' => 'wrench-screwdriver',
        ]);

        $eletronica = Category::firstOrCreate(['slug' => 'eletronica-automovel'], [
            'name' => 'Eletrónica Automóvel',
            'color_hex' => '#22D3EE',
            'icon' => 'cpu-chip',
        ]);

        $gestao = Category::firstOrCreate(['slug' => 'gestao-de-oficina'], [
            'name' => 'Gestão de Oficina',
            'color_hex' => '#E8940F',
            'icon' => 'briefcase',
        ]);

        // --- Curso 1: completo com módulos e lições ---
        $this->createCourse(
            category: $diagnostico,
            instructor: $formador,
            title: 'Diagnóstico de Sistemas OBD-II',
            description: 'Aprende a interpretar códigos de avaria, usar o scanner OBD-II e diagnosticar falhas em sistemas de injeção modernos.',
            level: 'intermedio',
            price: 49.90,
            modules: [
                'Fundamentos do OBD-II' => [
                    ['O que é o OBD-II', 'video_upload', 480],
                    ['A tomada de diagnóstico e os protocolos', 'video_upload', 620],
                ],
                'Leitura e interpretação de códigos' => [
                    ['Códigos P, B, C e U', 'video_upload', 540],
                    ['Dados em tempo real (live data)', 'video_upload', 700],
                    ['Caso prático: falha de sonda lambda', 'avatar', 600],
                ],
            ],
        );

        // --- Curso 2: completo com módulos e lições ---
        $this->createCourse(
            category: $eletronica,
            instructor: $formador,
            title: 'Introdução à Eletrónica Automóvel',
            description: 'Bases de eletricidade e eletrónica aplicadas ao automóvel: multímetro, circuitos, sensores e atuadores.',
            level: 'iniciante',
            price: 39.90,
            modules: [
                'Eletricidade base' => [
                    ['Tensão, corrente e resistência', 'video_upload', 500],
                    ['Usar o multímetro', 'video_upload', 640],
                ],
                'Sensores e atuadores' => [
                    ['Tipos de sensores', 'video_upload', 560],
                    ['Atuadores e relés', 'video_upload', 520],
                ],
            ],
        );

        // --- Cursos placeholder (dados de exemplo — substituir/acrescentar depois) ---
        $this->quickCourse($diagnostico, $formador, 'Diagnóstico de Falhas Elétricas', 'intermedio', 44.90);
        $this->quickCourse($diagnostico, $formador, 'Scanner e Osciloscópio na Prática', 'avancado', 69.90);
        $this->quickCourse($eletronica, $formador, 'Redes CAN Bus no Automóvel', 'avancado', 59.90);
        $this->quickCourse($eletronica, $formador, 'Baterias e Sistemas de Carga', 'iniciante', 29.90);
        $this->quickCourse($gestao, $formador, 'Gestão de Oficina Moderna', 'iniciante', 34.90);
        $this->quickCourse($gestao, $formador, 'Atendimento e Fidelização de Clientes', 'iniciante', 24.90);
        $this->quickCourse($gestao, $formador, 'Orçamentação e Faturação', 'intermedio', 39.90);

        $this->enrollWithProgress($aluno);
    }

    /**
     * Curso de exemplo com um módulo e 3 lições — para popular o catálogo.
     */
    private function quickCourse(Category $category, User $instructor, string $title, string $level, float $price): void
    {
        $this->createCourse(
            category: $category,
            instructor: $instructor,
            title: $title,
            description: 'Descrição de exemplo — a atualizar com o conteúdo real do curso.',
            level: $level,
            price: $price,
            modules: [
                'Módulo 1' => [
                    ['Introdução', 'video_upload', 420],
                    ['Conceitos essenciais', 'video_upload', 540],
                    ['Caso prático', 'video_upload', 600],
                ],
            ],
        );
    }

    /**
     * Inscreve o aluno demo no 1.º curso e marca o primeiro módulo como concluído,
     * para o dashboard nascer com um "a continuar" e um anel de progresso reais.
     */
    private function enrollWithProgress(User $aluno): void
    {
        $course = Course::where('slug', Str::slug('Diagnóstico de Sistemas OBD-II'))->first();

        if (! $course) {
            return;
        }

        Enrollment::firstOrCreate(
            ['user_id' => $aluno->id, 'course_id' => $course->id],
            ['source' => 'manual', 'status' => 'active', 'enrolled_at' => now()->subDays(5)],
        );

        // Conclui as lições do primeiro módulo.
        $firstModule = $course->modules()->orderBy('order_index')->first();

        if ($firstModule) {
            foreach ($firstModule->lessons as $lesson) {
                LessonProgress::firstOrCreate(
                    ['user_id' => $aluno->id, 'lesson_id' => $lesson->id],
                    ['status' => 'completed', 'progress_percent' => 100, 'completed_at' => now()->subDays(2)],
                );
            }
        }
    }

    /**
     * @param  array<string, array<int, array{0:string,1:string,2:int}>>  $modules
     */
    private function createCourse(
        Category $category,
        User $instructor,
        string $title,
        string $description,
        string $level,
        float $price,
        array $modules,
    ): void {
        $course = Course::firstOrCreate(['slug' => Str::slug($title)], [
            'category_id' => $category->id,
            'instructor_id' => $instructor->id,
            'title' => $title,
            'description' => $description,
            'level' => $level,
            'status' => 'published',
            'price' => $price,
            'currency' => 'EUR',
        ]);

        $totalMinutes = 0;
        $moduleIndex = 0;

        foreach ($modules as $moduleTitle => $lessons) {
            $module = Module::firstOrCreate(
                ['course_id' => $course->id, 'title' => $moduleTitle],
                ['order_index' => $moduleIndex++],
            );

            $lessonIndex = 0;
            foreach ($lessons as [$lessonTitle, $contentType, $seconds]) {
                Lesson::firstOrCreate(
                    ['module_id' => $module->id, 'title' => $lessonTitle],
                    [
                        'content_type' => $contentType,
                        'duration_seconds' => $seconds,
                        'order_index' => $lessonIndex++,
                    ],
                );
                $totalMinutes += (int) ceil($seconds / 60);
            }
        }

        $course->update(['duration_minutes' => $totalMinutes]);
    }
}
