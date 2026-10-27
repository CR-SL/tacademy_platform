<?php

namespace App\Http\Controllers\Learn;

use App\Models\Course;
use Illuminate\Support\Collection;

/** Programa do curso (módulos e aulas com o estado de cada uma) para a página do curso e da aula. */
trait BuildsProgram
{
    protected function program(Course $course, Collection $lessons, Collection $done, Collection $unlocked, array $access, ?int $currentId): array
    {
        return $lessons->groupBy(fn ($l) => $l->module->id)->map(function ($ls) use ($course, $done, $unlocked, $access, $currentId) {
            $module = $ls->first()->module;

            return [
                'title' => $module->title,
                'lessons' => $ls->map(fn ($l) => [
                    'ulid' => $l->ulid,
                    'title' => $l->title,
                    'type' => $l->content_type,
                    'minutes' => (int) round($l->duration_seconds / 60),
                    'status' => match (true) {
                        $done->contains($l->id) => 'done',
                        $this->learning->canOpen($access, $course, $l, $unlocked) => 'open',
                        default => 'locked',
                    },
                    'current' => $l->id === $currentId,
                    'sample' => $l->id === $course->sample_lesson_id,
                ])->values(),
            ];
        })->values()->all();
    }
}
