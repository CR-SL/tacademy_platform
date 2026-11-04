<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Enrollment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Mensagens entre o aluno e o formador do curso. O aluno só fala com o formador, para já. */
class CourseMessageController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'student_id' => ['nullable', 'integer', 'exists:users,id'],
            'body' => ['required', 'string', 'max:3000'],
        ], [
            'body.required' => 'Escreve a mensagem.',
        ]);

        $user = $request->user();
        $course = Course::findOrFail($data['course_id']);
        $asInstructor = $course->instructor_id === $user->id;
        $studentId = $asInstructor ? ($data['student_id'] ?? null) : $user->id;

        abort_unless($course->instructor_id && $studentId, 403);
        abort_if($studentId === $course->instructor_id, 403);
        abort_unless(Enrollment::where('user_id', $studentId)->where('course_id', $course->id)->exists(), 403);

        CourseMessage::create([
            'course_id' => $course->id,
            'student_id' => $studentId,
            'sender_id' => $user->id,
            'body' => $data['body'],
        ]);

        return back();
    }

    /** Marca como lidas as mensagens que a outra pessoa enviou nesta conversa. */
    public function read(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer'],
            'student_id' => ['required', 'integer'],
        ]);

        $user = $request->user();
        $course = Course::findOrFail($data['course_id']);
        abort_unless($data['student_id'] === $user->id || $course->instructor_id === $user->id, 403);

        CourseMessage::where('course_id', $course->id)
            ->where('student_id', $data['student_id'])
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return back();
    }
}
