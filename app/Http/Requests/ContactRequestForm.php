<?php

namespace App\Http\Requests;

use App\Models\ContactRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ContactRequestForm extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Com sessão, o nome e o email vêm sempre da conta (o formulário nem os mostra). */
    protected function prepareForValidation(): void
    {
        if ($user = $this->user()) {
            $this->merge(['name' => $user->name, 'email' => $user->email]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(array_keys(ContactRequest::TYPES))],
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'company' => ['nullable', 'required_if:type,empresa', 'string', 'max:150'],
            'team_size' => ['nullable', Rule::in(array_keys(ContactRequest::TEAM_SIZES))],
            'course_id' => ['nullable', Rule::exists('courses', 'id')->where('status', 'published')],
            'message' => ['required', 'string', 'min:5', 'max:3000'],
            'participants' => ['nullable', 'string', 'max:6000'], // empresa: "nome, email" por linha
            'consent' => ['accepted'],
            // Armadilha para bots: campo escondido que tem de vir vazio
            'website' => ['prohibited'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => __('Escreve o teu nome.'),
            'name.min' => __('Escreve o teu nome.'),
            'email.required' => __('Escreve o teu email.'),
            'email.email' => __('Escreve um email válido, ex.: nome@oficina.pt.'),
            'company.required_if' => __('Indica o nome da empresa ou oficina.'),
            'message.required' => __('Escreve a tua pergunta ou pedido.'),
            'message.min' => __('Escreve a tua pergunta ou pedido.'),
            'consent.accepted' => __('Para respondermos, precisamos que aceites o uso dos teus dados.'),
        ];
    }
}
