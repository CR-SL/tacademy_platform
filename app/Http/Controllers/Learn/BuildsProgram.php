<?php

namespace App\Http\Controllers\Learn;

use App\Models\Course;
use App\Models\LessonProgress;
use App\Models\User;
use Illuminate\Support\Collection;

/** Programa do curso (módulos e aulas com o estado de cada uma) para a página do curso e da aula. */
trait BuildsProgram
{
    /**
     * Aulas de vídeo começadas e por concluir: [lesson_id => ['at' => '7:42', 'of' => '12:00']].
     */
    protected function startedVideos(User $user, Collection $lessons): Collection
    {
        return LessonProgress::where('user_id', $user->id)
            ->whereIn('lesson_id', $lessons->pluck('id'))
            ->where('status', '!=', 'completed')
            ->where('last_position_seconds', '>', 0)
            ->get()
            ->mapWithKeys(function (LessonProgress $p) use ($lessons) {
                $lesson = $lessons->firstWhere('id', $p->lesson_id);
                if (! $lesson || ! $this->learning->isVideo($lesson)) {
                    return [];
                }
                $length = $this->learning->videoDuration($lesson, $p);

                return [$p->lesson_id => [
                    'at' => self::clock(min($p->last_position_seconds, $length ?: PHP_INT_MAX)),
                    'of' => $length ? self::clock($length) : null,
                ]];
            });
    }

    private static function clock(int $seconds): string
    {
        return intdiv($seconds, 60).':'.str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
    }

    protected function program(Course $course, Collection $lessons, Collection $done, array $access, ?int $currentId, ?Collection $started = null): array
    {
        $started ??= collect();

        return $lessons->groupBy(fn ($l) => $l->module->id)->map(function ($ls) use ($course, $done, $access, $currentId, $started) {
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
                        $this->learning->canOpen($access, $course, $l) => 'open',
                        default => 'locked',
                    },
                    'current' => $l->id === $currentId,
                    'sample' => $l->id === $course->sample_lesson_id,
                    'position' => $done->contains($l->id) ? null : ($started[$l->id] ?? null),
                ])->values(),
            ];
        })->values()->all();
    }
}
